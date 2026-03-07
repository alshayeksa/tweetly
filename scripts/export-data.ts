import pg from "pg";
import fs from "fs";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function exportData() {
  const client = await pool.connect();
  try {
    const tables = [
      "users",
      "sessions",
      "suggestions",
      "activity_log",
      "x_tokens",
      "automations",
      "automation_queue",
    ];

    const data: Record<string, any[]> = {};

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT * FROM "${table}"`);
        data[table] = result.rows;
        console.log(`Exported ${result.rows.length} rows from ${table}`);
      } catch (err: any) {
        console.log(`Skipping ${table}: ${err.message}`);
        data[table] = [];
      }
    }

    fs.writeFileSync("database-export.json", JSON.stringify(data, null, 2));
    console.log("\nData exported to database-export.json");
  } finally {
    client.release();
    await pool.end();
  }
}

exportData().catch(console.error);
