import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

let client: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function database() {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  client = drizzle(neon(connectionString), { schema });
  return client;
}
