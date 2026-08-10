import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

console.log("Checking quotes for BBCA:");
const results = await sql`
	select date, open, high, low, close, volume 
	from idx_daily_quotes where symbol = 'BBCA' order by date desc limit 20`;

if (results.length === 0) {
	console.log("No data found for BBCA");
} else {
	console.log(`Found ${results.length} rows:`);
	for (const r of results) {
		console.log(r.date, "O:", r.open, "H:", r.high, "L:", r.low, "C:", r.close, "V:", r.volume);
	}
}

await sql.end();
