/**
 * IDX Market Data Sync Service
 *
 * Pulls the daily trading summary from IDX and upserts it into Postgres.
 * Runs from the Inngest cron in lib/inngest/functions.ts.
 *
 * Note on dates: rows are keyed by the trading date reported BY IDX
 * (YYYY-MM-DD), not by "today". IDX publishes the previous session, so keying
 * on the local clock would silently write the wrong bucket on weekends and
 * holidays.
 */

import { idxMarketService } from "@/lib/idx/market-service";
import { getDividendHistory, getFundamentals } from "@/lib/idx/yahoo-provider";
import { db } from "@/database/db";
import { sql, eq } from "drizzle-orm";
import {
	idxDailyQuotes,
	idxMarketIndices,
	idxCompanyProfiles,
	idxFinancialRatios,
	idxDividends,
} from "@/database/schema";

/** Reference the row Postgres failed to insert, for ON CONFLICT DO UPDATE. */
const excluded = (column: string) => sql.raw(`excluded."${column}"`);

/** Postgres caps parameters per statement; chunk the multi-row inserts. */
const CHUNK = 500;

function chunked<T>(rows: T[], size = CHUNK): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
	return out;
}

export async function syncDailyQuotes(): Promise<{ synced: number; date: string }> {
	const stocks = await idxMarketService.getStockList();
	if (stocks.length === 0) {
		console.warn("[IDX-SYNC] getStockList returned nothing — skipping quotes");
		return { synced: 0, date: "" };
	}

	const date = stocks[0].tradingDate;
	const rows = stocks.map((s) => ({
		id: `${s.symbol}-${s.tradingDate}`,
		symbol: s.symbol,
		date: s.tradingDate,
		open: s.open,
		high: s.high,
		low: s.low,
		close: s.price,
		volume: Math.trunc(s.volume),
		value: s.value,
		frequency: Math.trunc(s.frequency),
		foreignNetBuy: s.foreignNetBuy,
	}));

	for (const batch of chunked(rows)) {
		await db
			.insert(idxDailyQuotes)
			.values(batch)
			.onConflictDoUpdate({
				target: [idxDailyQuotes.symbol, idxDailyQuotes.date],
				set: {
					open: excluded("open"),
					high: excluded("high"),
					low: excluded("low"),
					close: excluded("close"),
					volume: excluded("volume"),
					value: excluded("value"),
					frequency: excluded("frequency"),
					foreignNetBuy: excluded("foreign_net_buy"),
				},
			});
	}

	console.log(`[IDX-SYNC] ${rows.length} quotes upserted for ${date}`);
	return { synced: rows.length, date };
}

export async function syncMarketIndices(): Promise<{ synced: number }> {
	const indices = await idxMarketService.getIndices();
	if (indices.length === 0) {
		console.warn("[IDX-SYNC] getIndices returned nothing — skipping indices");
		return { synced: 0 };
	}

	const rows = indices.map((i) => {
		const date = i.timestamp.toISOString().slice(0, 10);
		return {
			id: `${i.symbol}-${date}`,
			symbol: i.symbol,
			name: i.name,
			date,
			value: i.value,
			change: i.change,
			changePercent: i.changePercent,
			volume: i.volume,
			frequency: 0,
		};
	});

	for (const batch of chunked(rows)) {
		await db.insert(idxMarketIndices).values(batch).onConflictDoNothing();
	}

	console.log(`[IDX-SYNC] ${rows.length} indices upserted`);
	return { synced: rows.length };
}

/**
 * Company profiles change rarely — run weekly, not with every quote sync.
 * Market cap is derived: listedShares (trading summary) x close price.
 */
export async function syncCompanyProfiles(): Promise<{ synced: number }> {
	const profiles = idxMarketService.getEmitenList();
	const stocks = await idxMarketService.getStockList();
	if (profiles.length === 0) {
		console.warn("[IDX-SYNC] emiten list is empty");
		return { synced: 0 };
	}

	const bySymbol = new Map(stocks.map((s) => [s.symbol, s]));
	const rows = profiles.map((p) => {
		const quote = bySymbol.get(p.symbol);
		return {
			symbol: p.symbol,
			name: p.name,
			sector: p.sector || null,
			industry: p.industry || null,
			subIndustry: p.subIndustry || null,
			listedDate: p.listedDate || null,
			sharesOutstanding: quote?.listedShares ?? null,
			marketCap: quote ? quote.listedShares * quote.price : null,
			fiscalYearEnd: null,
			website: p.website || null,
			description: p.description || null,
			updatedAt: new Date(),
		};
	});

	for (const batch of chunked(rows)) {
		await db
			.insert(idxCompanyProfiles)
			.values(batch)
			.onConflictDoUpdate({
				target: [idxCompanyProfiles.symbol],
				set: {
					name: excluded("name"),
					sector: excluded("sector"),
					industry: excluded("industry"),
					subIndustry: excluded("sub_industry"),
					listedDate: excluded("listed_date"),
					sharesOutstanding: excluded("shares_outstanding"),
					marketCap: excluded("market_cap"),
					website: excluded("website"),
					description: excluded("description"),
					updatedAt: excluded("updated_at"),
				},
			});
	}

	console.log(`[IDX-SYNC] ${rows.length} company profiles upserted`);
	return { synced: rows.length };
}

export async function syncAllMarketData() {
	const [quotes, indices] = await Promise.allSettled([
		syncDailyQuotes(),
		syncMarketIndices(),
	]);

	const result = {
		quotes: quotes.status === "fulfilled" ? quotes.value : { synced: 0, date: "" },
		indices: indices.status === "fulfilled" ? indices.value : { synced: 0 },
		failures: [quotes, indices]
			.filter((r): r is PromiseRejectedResult => r.status === "rejected")
			.map((r) => String(r.reason)),
	};

	if (result.failures.length > 0) console.error("[IDX-SYNC] failures:", result.failures);
	return result;
}

// ---------------------------------------------------------------------------
// Fundamentals + dividends (screener / dividend calendar inputs)
// ---------------------------------------------------------------------------

/** Yahoo throttles bursts, so fundamentals are fetched a few at a time. */
async function mapLimited<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const out: R[] = [];
	const queue = [...items];
	await Promise.all(
		Array.from({ length: Math.min(limit, queue.length) }, async () => {
			while (queue.length > 0) {
				const item = queue.shift();
				if (item === undefined) break;
				out.push(await fn(item));
			}
		}),
	);
	return out;
}

/**
 * Fundamentals for the screener. Ratios are stored as percent (ROE 21.8, not
 * 0.218) because that is what the screener filters and the UI display use.
 *
 * `symbols` defaults to the liquid subset rather than all 962 emiten: a full
 * sweep is ~962 authenticated Yahoo calls and most small caps return nulls.
 */
export async function syncFundamentals(symbols?: string[]): Promise<{ synced: number; skipped: number }> {
	const targets =
		symbols && symbols.length > 0
			? symbols.map((s) => s.toUpperCase())
			: (await idxMarketService.getStockList()).slice(0, 150).map((s) => s.symbol);

	if (targets.length === 0) return { synced: 0, skipped: 0 };

	const asPercent = (v: number | null) => (v === null ? null : v * 100);
	const today = new Date().toISOString().slice(0, 10);

	/**
	 * Yahoo's bookValue for some .JK tickers is denominated inconsistently with
	 * the IDR quote (BREN: bookValue 0.005 against a 3510 price), which yields a
	 * priceToBook in the hundreds of thousands. Storing that would poison every
	 * PBV sort and filter, so an implausible ratio is recorded as unknown (null)
	 * rather than as a number. Verified against Yahoo 2026-08.
	 */
	const MAX_PLAUSIBLE_PBV = 100;
	const MAX_PLAUSIBLE_PER = 1000;
	const sane = (v: number | null, max: number) =>
		v === null || v <= 0 || v > max ? null : v;

	const fetched = await mapLimited(targets, 4, async (symbol) => {
		try {
			return await getFundamentals(symbol);
		} catch {
			return null;
		}
	});

	const rows = fetched
		.filter((f): f is NonNullable<typeof f> => f !== null)
		.map((f) => ({
			...f,
			peRatio: sane(f.peRatio, MAX_PLAUSIBLE_PER),
			pbvRatio: sane(f.pbvRatio, MAX_PLAUSIBLE_PBV),
		}))
		// A row with no PER and no PBV carries nothing the screener can filter on.
		.filter((f) => f.peRatio !== null || f.pbvRatio !== null)
		.map((f) => ({
			id: `${f.symbol}-${today}`,
			symbol: f.symbol,
			reportDate: today,
			period: null,
			peRatio: f.peRatio,
			pbvRatio: f.pbvRatio,
			roe: asPercent(f.roe),
			roa: asPercent(f.roa),
			netMargin: asPercent(f.netMargin),
			eps: f.eps,
			dividendYield: asPercent(f.dividendYield),
			updatedAt: new Date(),
		}));

	for (const batch of chunked(rows)) {
		await db
			.insert(idxFinancialRatios)
			.values(batch)
			.onConflictDoUpdate({
				target: [idxFinancialRatios.id],
				set: {
					peRatio: excluded("pe_ratio"),
					pbvRatio: excluded("pbv_ratio"),
					roe: excluded("roe"),
					roa: excluded("roa"),
					netMargin: excluded("net_margin"),
					eps: excluded("eps"),
					dividendYield: excluded("dividend_yield"),
					updatedAt: excluded("updated_at"),
				},
			});
	}

	const skipped = targets.length - rows.length;
	console.log(`[IDX-SYNC] ${rows.length} fundamentals upserted (${skipped} without usable ratios)`);

	// Market cap belongs to the profile row, and Yahoo reports it directly.
	// syncCompanyProfiles can only derive it from listedShares, which the Yahoo
	// backend doesn't supply — so it lands as 0 and would break screener sorting.
	const caps = fetched.filter(
		(f): f is NonNullable<typeof f> => f !== null && f.marketCap !== null && f.marketCap > 0,
	);
	for (const f of caps) {
		await db
			.update(idxCompanyProfiles)
			.set({ marketCap: f.marketCap, updatedAt: new Date() })
			.where(eq(idxCompanyProfiles.symbol, f.symbol));
	}
	if (caps.length > 0) console.log(`[IDX-SYNC] ${caps.length} market caps refreshed`);

	return { synced: rows.length, skipped };
}

/**
 * Dividend history. Yahoo's chart events give the ex-dividend date and amount
 * only, so announcement/record/payment dates are left null rather than guessed.
 */
export async function syncDividends(symbols?: string[]): Promise<{ synced: number }> {
	const targets =
		symbols && symbols.length > 0
			? symbols.map((s) => s.toUpperCase())
			: (await idxMarketService.getStockList()).slice(0, 150).map((s) => s.symbol);

	if (targets.length === 0) return { synced: 0 };

	const perSymbol = await mapLimited(targets, 6, async (symbol) => {
		const events = await getDividendHistory(symbol);
		return events.map((e) => ({
			id: `${symbol}-${e.date}`,
			symbol,
			announcementDate: e.date,
			exDividendDate: e.date,
			recordDate: null,
			paymentDate: null,
			amount: e.amount,
			type: "CASH",
			description: null,
		}));
	});

	const rows = perSymbol.flat();
	if (rows.length === 0) return { synced: 0 };

	for (const batch of chunked(rows)) {
		await db
			.insert(idxDividends)
			.values(batch)
			.onConflictDoUpdate({
				target: [idxDividends.id],
				set: {
					amount: excluded("amount"),
					exDividendDate: excluded("ex_dividend_date"),
				},
			});
	}

	console.log(`[IDX-SYNC] ${rows.length} dividend events upserted`);
	return { synced: rows.length };
}
