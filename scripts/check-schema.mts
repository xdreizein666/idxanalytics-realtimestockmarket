import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const cols = await sql`
	select column_name from information_schema.columns
	where table_name = 'idx_financial_ratios' and column_name = 'dividend_yield'
`;
console.log("dividend_yield column present:", cols.length === 1);

const counts = await sql`
	select
		(select count(*) from idx_financial_ratios) as ratios,
		(select count(*) from idx_dividends) as dividends
`;
console.log("idx_financial_ratios rows:", counts[0].ratios);
console.log("idx_dividends rows:", counts[0].dividends);

await sql.end();
