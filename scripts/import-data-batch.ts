import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.SUPABASE_DATABASE_URL?.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});

function escapeValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "object" && !Array.isArray(val))
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  if (Array.isArray(val))
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return val.toString();
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function importData() {
  if (!fs.existsSync("database-export.json")) {
    console.error("database-export.json not found.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync("database-export.json", "utf-8"));
  const client = await pool.connect();

  const orderedTables = [
    "users",
    "sessions",
    "automations",
    "suggestions",
    "activity_log",
    "x_tokens",
    "automation_queue",
  ];

  const BATCH_SIZE = 500;

  try {
    for (const table of orderedTables) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        console.log(`Skipping ${table}: no data`);
        continue;
      }

      const existingCount = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      if (parseInt(existingCount.rows[0].count) > 0) {
        console.log(`Skipping ${table}: already has ${existingCount.rows[0].count} rows`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(", ");

      let imported = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valueRows = batch.map((row: any) => {
          const values = columns.map((col) => escapeValue(row[col]));
          return `(${values.join(", ")})`;
        });

        const query = `INSERT INTO "${table}" (${columnList}) VALUES ${valueRows.join(", ")} ON CONFLICT DO NOTHING`;
        try {
          await client.query(query);
          imported += batch.length;
        } catch (err: any) {
          console.error(`Error batch inserting into ${table} at row ${i}: ${err.message}`);
          for (const row of batch) {
            const values = columns.map((col) => escapeValue(row[col]));
            try {
              await client.query(
                `INSERT INTO "${table}" (${columnList}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING`
              );
              imported++;
            } catch {}
          }
        }

        if (rows.length > BATCH_SIZE) {
          process.stdout.write(`\r  ${table}: ${imported}/${rows.length}`);
        }
      }

      console.log(`\nImported ${imported} rows into ${table}`);

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
