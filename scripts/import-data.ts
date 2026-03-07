import pg from "pg";
import fs from "fs";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function importData() {
  if (!fs.existsSync("database-export.json")) {
    console.error("database-export.json not found. Run export first.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync("database-export.json", "utf-8"));
  const client = await pool.connect();

  const orderedTables = [
    "users",
    "sessions",
    "suggestions",
    "activity_log",
    "x_tokens",
    "automations",
    "automation_queue",
  ];

  try {
    for (const table of orderedTables) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        console.log(`Skipping ${table}: no data`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(", ");

      for (const row of rows) {
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
          if (typeof val === "number") return val.toString();
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        const query = `INSERT INTO "${table}" (${columnList}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING`;
        try {
          await client.query(query);
        } catch (err: any) {
          console.error(`Error inserting into ${table}: ${err.message}`);
        }
      }

      console.log(`Imported ${rows.length} rows into ${table}`);
    }

    for (const table of orderedTables) {
      try {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1)) WHERE pg_get_serial_sequence('"${table}"', 'id') IS NOT NULL`
        );
      } catch {}
    }

    console.log("\nData import complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

importData().catch(console.error);
