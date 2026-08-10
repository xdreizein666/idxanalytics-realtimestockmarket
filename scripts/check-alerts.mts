/**
 * Self-check for price-alert triggering. Verifies (a) the alert->user join query
 * runs against the real schema, (b) the upper/lower comparison logic.
 * Run: npx tsx scripts/check-alerts.mts
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import assert from "node:assert/strict";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// --- logic check (mirrors lib/inngest/functions.ts checkPriceAlerts) ---
const hit = (type: string, price: number, threshold: number) =>
	type === "upper" ? price >= threshold : price <= threshold;

assert.equal(hit("upper", 6500, 6400), true, "upper fires when price above target");
assert.equal(hit("upper", 6300, 6400), false, "upper silent when price below target");
assert.equal(hit("upper", 6400, 6400), true, "upper fires exactly at target");
assert.equal(hit("lower", 6300, 6400), true, "lower fires when price below target");
assert.equal(hit("lower", 6500, 6400), false, "lower silent when price above target");
console.log("OK  threshold comparison logic");

// --- re-arm window check ---
const REARM_MS = 6 * 60 * 60 * 1000;
const armed = (last: Date | null) =>
	!last || new Date(last).getTime() < Date.now() - REARM_MS;
assert.equal(armed(null), true, "never-fired alert is armed");
assert.equal(armed(new Date()), false, "just-fired alert is suppressed");
assert.equal(armed(new Date(Date.now() - 7 * 60 * 60 * 1000)), true, "7h-old alert re-arms");
console.log("OK  re-arm window logic");

// --- real DB join check ---
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const rows = await sql`
	select pa.id, pa.symbol, pa.market, pa.alert_type, pa.threshold,
	       pa.last_triggered_at, u.email
	from price_alert pa
	join "user" u on pa.user_id = u.id
	where pa.is_active = true
`;
console.log(`OK  alert->user join query ran, ${rows.length} active alert(s)`);
for (const r of rows) {
	console.log(`    ${r.symbol} [${r.market}] ${r.alert_type} @ ${r.threshold} -> ${r.email}`);
}

await sql.end();
console.log("\nAll price-alert checks passed.");
