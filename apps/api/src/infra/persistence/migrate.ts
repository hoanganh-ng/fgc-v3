import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "kysely";
import { loadConfig } from "../../config.js";
import { createDatabase } from "./database.js";

const config = loadConfig();
const db = createDatabase(config.DATABASE_URL);
const migrationsDir = join(process.cwd(), "migrations");

try {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const migrationSql = await readFile(join(migrationsDir, file), "utf8");
    await sql.raw(migrationSql).execute(db);
    console.log(`Applied ${file}`);
  }
} finally {
  await db.destroy();
}
