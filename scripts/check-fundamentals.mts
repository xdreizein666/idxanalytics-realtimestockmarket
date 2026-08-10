import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

console.log("--- idx_financial_ratios ---");
const ratios = await sql`select symbol, pe_ratio, pbv_ratio, roe, dividend_yield, eps from idx_financial_ratios order by symbol`;
for (const r of ratios) console.log(r);

console.log("\n--- idx_dividends (BBCA) ---");
const divs = await sql`select symbol, ex_dividend_date, amount from idx_dividends where symbol = 'BBCA' order by ex_dividend_date`;
for (const d of divs) console.log(d);

await sql.end();
