import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is not configured.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL },
  casing: "snake_case",
  tablesFilter: ["restaurants", "generation_rate_limits", "generated_menus"],
  strict: true,
});
