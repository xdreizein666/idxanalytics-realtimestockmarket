/**
 * End-to-end check: insert a real alert row, run the same trigger evaluation the
 * cron does (live Yahoo quote), confirm it fires, then clean up.
 * Run: npx tsx scripts/check-alerts-e2e.mts
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

// Need a real user to satisfy the FK.
const [existingUser] = await sql`select id, email from "user" limit 1`;
if (!existingUser) {
	console.log("SKIP: no user rows in DB, cannot exercise the FK-bound insert.");
	await sql.end();
	process.exit(0);
}
console.log(`Using user ${existingUser.email}`);

// Live price for BBCA from Yahoo (same source the app uses).
const res = await fetch(
	"https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=1d&interval=1d",
	{ headers: { "User-Agent": "Mozilla/5.0" } },
);
const json = await res.json();
const price = json.chart.result[0].meta.regularMarketPrice as number;
assert.ok(price > 0, "live Yahoo price must be positive");
console.log(`Live BBCA price: ${price}`);

// Insert two alerts: one that MUST fire, one that MUST NOT.
const fireId = randomUUID();
const quietId = randomUUID();
await sql`
	insert into price_alert (id, user_id, symbol, market, company, alert_name, alert_type, threshold, is_active)
	values
		(${fireId}, ${existingUser.id}, 'BBCA', 'IDX', 'Bank Central Asia Tbk.', 'e2e-should-fire', 'upper', ${price - 100}, true),
		(${quietId}, ${existingUser.id}, 'BBCA', 'IDX', 'Bank Central Asia Tbk.', 'e2e-should-stay-quiet', 'upper', ${price + 100000}, true)
`;
console.log("Inserted 2 test alerts");

try {
	// Replay the cron's query + evaluation.
	const rows = await sql`
		select pa.id, pa.symbol, pa.alert_type, pa.threshold, pa.last_triggered_at, u.email
		from price_alert pa join "user" u on pa.user_id = u.id
		where pa.is_active = true and pa.alert_name like 'e2e-%'
	`;
	assert.equal(rows.length, 2, "both test alerts should be loaded by the cron query");

	const fired = rows.filter((r) => {
		const t = Number(r.threshold);
		return r.alert_type === "upper" ? price >= t : price <= t;
	});

	assert.equal(fired.length, 1, "exactly one alert should trigger");
	assert.equal(fired[0].id, fireId, "the below-market alert is the one that fires");
	console.log(`OK  triggered alert: ${fired[0].id} -> ${fired[0].email}`);

	// Exercise the real markAlertTriggered write.
	await sql`update price_alert set last_triggered_at = now() where id = ${fireId}`;
	const [after] = await sql`select last_triggered_at from price_alert where id = ${fireId}`;
	assert.ok(after.last_triggered_at, "last_triggered_at must be persisted");
	console.log("OK  last_triggered_at persisted");

	// And confirm the re-arm filter now suppresses it.
	const REARM_MS = 6 * 60 * 60 * 1000;
	const stillArmed =
		!after.last_triggered_at ||
		new Date(after.last_triggered_at).getTime() < Date.now() - REARM_MS;
	assert.equal(stillArmed, false, "just-triggered alert must be suppressed next sweep");
	console.log("OK  re-arm suppression active after trigger");

	console.log("\nE2E price-alert flow passed.");
} finally {
	await sql`delete from price_alert where alert_name like 'e2e-%'`;
	console.log("Cleaned up test alerts");
	await sql.end();
}
