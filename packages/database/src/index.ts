import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: "../../.env" });
config();

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ticketing";

export const sql = postgres(connectionString, {
  max: Number(process.env.DB_POOL_SIZE ?? 10),
});

export const db = drizzle(sql, { schema });

export * from "./schema";
export type Database = typeof db;
