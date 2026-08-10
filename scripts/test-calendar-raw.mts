import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 15 });

const recent = await sql`
	select d.symbol, p.name, p.sector, d.ex_dividend_date, d.amount, d.type, d.payment_date
	from idx_dividends d
	left join idx_company_profiles p on p.symbol = d.symbol
	order by d.ex_dividend_date desc
	limit 10
`;
console.log(`recent: ${recent.length} rows`);
for (const r of recent) console.log(`  ${r.symbol.padEnd(6)} ${String(r.ex_dividend_date).padEnd(12)} ${String(r.amount).padStart(10)} ${r.type}  ${r.name?.slice(0, 30) ?? "-"}`);

const upcoming = await sql`
	select d.symbol, p.name, d.ex_dividend_date, d.amount, d.type
	from idx_dividends d
	left join idx_company_profiles p on p.symbol = d.symbol
	where d.ex_dividend_date >= to_char(now(), 'YYYY-MM-DD')
	order by d.ex_dividend_date asc
	limit 10
`;
console.log(`\nupcoming: ${upcoming.length} rows`);

await sql.end();
process.exit(0);
