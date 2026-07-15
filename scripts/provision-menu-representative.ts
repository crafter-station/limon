import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashRepresentativeToken } from "../src/lib/menus";

const [restaurantId, displayName] = process.argv.slice(2);
if (!restaurantId || !displayName) {
  throw new Error(
    'Usage: bun run menu:provision -- <restaurant-id> "Representative name"',
  );
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");
const token = randomBytes(32).toString("base64url");
await neon(connectionString)`
  INSERT INTO menu_representatives (
    id, restaurant_id, display_name, token_hash
  ) VALUES (
    ${crypto.randomUUID()}, ${restaurantId}, ${displayName},
    ${hashRepresentativeToken(token)}
  )
`;
console.log(`Representative: ${displayName}`);
console.log(`Restaurant: ${restaurantId}`);
console.log(`One-time access token: ${token}`);
