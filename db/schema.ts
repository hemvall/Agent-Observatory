// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
    lockedUntil: integer("locked_until").notNull().default(0),
  },
  (table) => [index("idx_runs_updated_at").on(table.updatedAt)],
);
