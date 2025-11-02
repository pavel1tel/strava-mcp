import { Pool } from 'pg';

// Database connection string
const DATABASE_URL = 'postgresql://postgres:bgYBFteXdtavkNORLLhRLxjtkmzsHjpG@crossover.proxy.rlwy.net:35171/railway';

// Create a connection pool
let pool: Pool | null = null;

/**
 * Gets or creates the database connection pool
 */
function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Railway PostgreSQL may require this
            }
        });
    }
    return pool;
}

/**
 * Ensures the strava_token table exists with the correct schema
 */
export async function ensureTableExists(): Promise<void> {
    const pool = getPool();
    try {
        // Create table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS strava_token (
                id INTEGER PRIMARY KEY DEFAULT 1,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_row CHECK (id = 1)
            )
        `);
        
        // Ensure only one row exists (delete any extra rows if table already had data)
        await pool.query(`
            DELETE FROM strava_token WHERE id != 1
        `);
        
        console.error('✅ Strava token table verified/created.');
    } catch (error) {
        console.error('Failed to ensure strava_token table exists:', error);
        throw error;
    }
}

/**
 * Loads tokens from the database and sets them in process.env
 * Falls back to existing env vars if DB tokens are not available
 */
export async function loadTokensFromDb(): Promise<void> {
    const pool = getPool();
    try {
        await ensureTableExists();
        
        const result = await pool.query(
            'SELECT access_token, refresh_token FROM strava_token WHERE id = 1 LIMIT 1'
        );

        if (result.rows.length > 0) {
            const { access_token, refresh_token } = result.rows[0];
            if (access_token && refresh_token) {
                process.env.STRAVA_ACCESS_TOKEN = access_token;
                process.env.STRAVA_REFRESH_TOKEN = refresh_token;
                console.error('✅ Tokens loaded from database.');
                return;
            }
        }

        // No tokens in DB, check if env vars exist as fallback
        if (process.env.STRAVA_ACCESS_TOKEN && process.env.STRAVA_REFRESH_TOKEN) {
            console.error('ℹ️ No tokens in database, using environment variables.');
        } else {
            console.error('⚠️ No tokens found in database or environment variables.');
        }
    } catch (error) {
        console.error('Failed to load tokens from database:', error);
        // Fall back to env vars if DB fails
        if (!process.env.STRAVA_ACCESS_TOKEN || !process.env.STRAVA_REFRESH_TOKEN) {
            console.error('⚠️ Using environment variables as fallback.');
        }
    }
}

/**
 * Saves tokens to the database (upsert - ensures only one row)
 * Also updates process.env
 */
export async function saveTokensToDb(accessToken: string, refreshToken: string): Promise<void> {
    const pool = getPool();
    try {
        await ensureTableExists();

        await pool.query(`
            INSERT INTO strava_token (id, access_token, refresh_token, updated_at)
            VALUES (1, $1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (id) 
            DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                updated_at = CURRENT_TIMESTAMP
        `, [accessToken, refreshToken]);

        // Also update process.env
        process.env.STRAVA_ACCESS_TOKEN = accessToken;
        process.env.STRAVA_REFRESH_TOKEN = refreshToken;

        console.error('✅ Tokens saved to database and environment variables.');
    } catch (error) {
        console.error('Failed to save tokens to database:', error);
        // Still update env vars even if DB save fails
        process.env.STRAVA_ACCESS_TOKEN = accessToken;
        process.env.STRAVA_REFRESH_TOKEN = refreshToken;
        throw error;
    }
}

/**
 * Closes the database connection pool (useful for cleanup)
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

