import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const counts = await sql`
	select
		(select count(*) from idx_dividends) as total,
		(select count(*) from idx_dividends where ex_dividend_date >= to_char(now(), 'YYYY-MM-DD')) as upcoming,
		(select count(distinct symbol) from idx_dividends) as symbols
`;
console.log("dividends:", counts[0]);

const upcoming = await sql`
	select symbol, ex_dividend_date, amount, type
	from idx_dividends
	where ex_dividend_date >= to_char(now(), 'YYYY-MM-DD')
	order by ex_dividend_date asc
	limit 10
`;
console.log("\nupcoming (next 10):");
for (const r of upcoming) console.log(r);

const recent = await sql`
	select symbol, ex_dividend_date, amount, type
	from idx_dividends
	order by ex_dividend_date desc
	limit 10
`;
console.log("\nmost recent (last 10):");
for (const r of recent) console.log(r);

await sql.end();
