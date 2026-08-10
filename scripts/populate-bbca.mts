import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

// Fetch 60 days history from Yahoo for BBCA and insert
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

console.log("Fetching BBCA from Yahoo Finance...");
const res = await fetch(
	"https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=6mo&interval=1d",
	{ headers: { "User-Agent": UA } }
);
const data = await res.json();

const result = data.chart.result[0];
const q = result.indicators.quote[0];
const timestamps = result.timestamp ?? [];

let count = 0;
for (let i = timestamps.length - 1; i >= 0; i--) {
	const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
	const close = q.close?.[i] ?? null;
	if (close == null) continue; // skip halted sessions
	const open = q.open?.[i] ?? close;
	const high = q.high?.[i] ?? close;
	const low = q.low?.[i] ?? close;
	const volume = q.volume?.[i] ?? 0;

	try {
		await sql`
			insert into idx_daily_quotes (id, symbol, date, open, high, low, close, volume, value, frequency)
			values (${`${date}-BBCA`}, 'BBCA', ${date}, ${open}, ${high}, ${low}, ${close}, ${volume}, ${close * volume}, 1000)
			on conflict (symbol, date) do nothing
		`;
		count++;
	} catch (e) {
		console.error("Insert error:", e);
	}
}

console.log(`Inserted ${count} rows for BBCA`);

await sql.end();
