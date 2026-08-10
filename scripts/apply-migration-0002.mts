import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

await sql`ALTER TABLE "idx_financial_ratios" ADD COLUMN IF NOT EXISTS "dividend_yield" double precision`;
console.log("applied: dividend_yield");

const cols = await sql`
	select column_name from information_schema.columns
	where table_name = 'idx_financial_ratios' and column_name = 'dividend_yield'
`;
console.log("verified present:", cols.length === 1);

await sql.end();
