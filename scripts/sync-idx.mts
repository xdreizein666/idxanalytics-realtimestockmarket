/**
 * Manual IDX sync runner: pnpm run sync:idx
 * Proves the live IDX endpoints work and the data actually lands in Postgres.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { syncDailyQuotes, syncMarketIndices, syncCompanyProfiles, syncFundamentals, syncDividends } =
	await import("../lib/idx/sync-service");

const mode = process.argv[2] ?? "all";
const symbolArgs = process.argv.slice(3).filter((a) => !a.startsWith("-"));
console.log("mode:", mode);

if (mode === "all" || mode === "quotes") console.log(await syncDailyQuotes());
if (mode === "all" || mode === "indices") console.log(await syncMarketIndices());
if (mode === "all" || mode === "profiles") console.log(await syncCompanyProfiles());
if (mode === "all" || mode === "fundamentals")
	console.log(await syncFundamentals(symbolArgs.length > 0 ? symbolArgs : undefined));
if (mode === "all" || mode === "dividends")
	console.log(await syncDividends(symbolArgs.length > 0 ? symbolArgs : undefined));

process.exit(0);
