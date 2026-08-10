import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";

/**
 * The client is created lazily so `next build` (which imports pages to collect
 * metadata) does not require a live DATABASE_URL. The error surfaces on the
 * first actual query instead.
 *
 * `prepare: false` is required for Supabase's transaction pooler (PgBouncer),
 * which does not support prepared statements.
 * Source: https://orm.drizzle.team/docs/connect-supabase
 */
const globalForDb = globalThis as unknown as {
	drizzleDb?: ReturnType<typeof createDb>;
};

function createDb() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error(
			"DATABASE_URL must be set. Copy it from Supabase → Project Settings → Database → Connection string → Transaction pooler.",
		);
	}
	return drizzle(postgres(connectionString, { prepare: false, max: 5 }), {
		schema,
	});
}

function getDb() {
	if (!globalForDb.drizzleDb) globalForDb.drizzleDb = createDb();
	return globalForDb.drizzleDb;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
	get: (_target, prop) => Reflect.get(getDb(), prop),
});

export { schema };
