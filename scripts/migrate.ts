import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const sql = neon(connectionString);
const directory = join(import.meta.dir, "../db/migrations");
const files = (await readdir(directory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const migration = await readFile(join(directory, file), "utf8");
  const statements = migration
    .split(/^-- migrate:split\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${file}.`);
}

console.log("Neon schema is up to date.");
