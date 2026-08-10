/**
 * Self-check for the IDX screener: runs the real Drizzle query against Postgres
 * and asserts the filters/sorting behave.
 * Run: npx tsx scripts/check-screener.mts
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { screenStocks, getScreenerSectors } = await import("../lib/idx/screener-service");

// 1) unfiltered
const all = await screenStocks({ limit: 50 });
console.log(`unfiltered rows: ${all.length}`);
assert.ok(all.length > 0, "screener must return rows (run sync-idx fundamentals first)");
for (const r of all) {
	console.log(
		`  ${r.symbol.padEnd(6)} PER=${r.peRatio?.toFixed(2).padStart(7)} PBV=${r.pbvRatio?.toFixed(2).padStart(7)} ROE=${r.roe?.toFixed(1).padStart(7)}% DY=${r.dividendYield?.toFixed(2).padStart(6)}% cap=${r.marketCap ?? "-"}`,
	);
}

// 2) every row must carry the joined profile name
assert.ok(
	all.every((r) => typeof r.name === "string" && r.name.length > 0),
	"profile join must supply a company name",
);
console.log("OK  profile join populates name");

// 3) maxPer filter
const cheap = await screenStocks({ maxPer: 15, limit: 50 });
assert.ok(
	cheap.every((r) => r.peRatio !== null && r.peRatio <= 15),
	"maxPer must exclude rows above the cap",
);
console.log(`OK  maxPer=15 -> ${cheap.length} rows, all PER <= 15`);

// 4) minRoe filter (percent units)
const quality = await screenStocks({ minRoe: 15, limit: 50 });
assert.ok(
	quality.every((r) => r.roe !== null && r.roe >= 15),
	"minRoe must exclude rows below the floor",
);
console.log(`OK  minRoe=15 -> ${quality.length} rows, all ROE >= 15%`);

// 5) minDividendYield filter
const income = await screenStocks({ minDividendYield: 5, limit: 50 });
assert.ok(
	income.every((r) => r.dividendYield !== null && r.dividendYield >= 5),
	"minDividendYield must exclude rows below the floor",
);
console.log(`OK  minDividendYield=5 -> ${income.length} rows, all yield >= 5%`);

// 6) sorting, both directions
const byPerAsc = await screenStocks({ sortBy: "per", sortDir: "asc", limit: 50 });
const pers = byPerAsc.map((r) => r.peRatio!);
assert.deepEqual(pers, [...pers].sort((a, b) => a - b), "asc sort must be ascending");
console.log(`OK  sortBy=per asc -> ${pers.map((p) => p.toFixed(1)).join(", ")}`);

const byRoeDesc = await screenStocks({ sortBy: "roe", sortDir: "desc", limit: 50 });
const roes = byRoeDesc.map((r) => r.roe!);
assert.deepEqual(roes, [...roes].sort((a, b) => b - a), "desc sort must be descending");
console.log("OK  sortBy=roe desc is descending");

// 7) null ratios never occupy the sort column
assert.ok(
	byRoeDesc.every((r) => r.roe !== null),
	"rows with a null sort column must be excluded",
);
console.log("OK  null sort-column rows excluded");

// 8) limit is honoured and clamped
const two = await screenStocks({ limit: 2 });
assert.equal(two.length, 2, "limit must cap the result count");
console.log("OK  limit honoured");

// 9) sectors list
const sectors = await getScreenerSectors();
console.log(`OK  ${sectors.length} sector(s) available for the filter dropdown`);

console.log("\nAll screener checks passed.");
process.exit(0);
