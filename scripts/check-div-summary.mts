import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const summary = await sql`
	select
		count(*)::int as total,
		count(*) filter (where ex_dividend_date >= to_char(now(), 'YYYY-MM-DD'))::int as upcoming,
		count(distinct symbol)::int as symbols
	from idx_dividends
`;
console.log("summary:", summary[0]);

await sql.end();
