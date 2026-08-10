import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

for (const t of [
	"idx_daily_quotes",
	"idx_market_indices",
	"idx_company_profiles",
	"idx_financial_ratios",
	"idx_dividends",
]) {
	const [{ n }] = await sql.unsafe(`select count(*)::int as n from "${t}"`);
	console.log(`${t.padEnd(24)} ${n} rows`);
}

console.log("\nSample quotes:");
for (const r of await sql`
	select symbol, date, open, high, low, close, volume
	from idx_daily_quotes order by close desc limit 5`) {
	console.log(" ", r.symbol, r.date, "O", r.open, "H", r.high, "L", r.low, "C", r.close, "V", r.volume);
}

console.log("\nIndices:");
for (const r of await sql`select symbol, name, date, value, change_percent from idx_market_indices`) {
	console.log(" ", r.symbol, r.name, r.date, r.value, `${Number(r.change_percent).toFixed(2)}%`);
}

console.log("\nProfiles sample:");
for (const r of await sql`
	select symbol, name, sector, market_cap from idx_company_profiles
	where market_cap is not null order by market_cap desc limit 5`) {
	console.log(" ", r.symbol, "|", r.sector, "|", r.name);
}

await sql.end();
