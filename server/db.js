import pg from "pg";
const { Pool } = pg;

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "graphqldemo",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection not established
};

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

// Test connection function
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as now");
    console.log("✅ Database connected successfully at:", result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    return false;
  }
}

// Query helper with logging
let queryCount = 0;

export async function query(text, params) {
  queryCount++; // Increment every time a query hits Postgres
  const start = Date.now();
  const result = await pool.query(text, params);
  console.log(`[Query #${queryCount}] Duration: ${Date.now() - start}ms`);
  return result;
}

export const getQueryCount = () => queryCount;
export const resetQueryCount = () => {
  queryCount = 0;
};

// Transaction helper
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Close pool gracefully
export async function closePool() {
  await pool.end();
  console.log("Database pool closed");
}

export default { pool, query, withTransaction, testConnection, closePool };
