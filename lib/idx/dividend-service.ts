/**
 * IDX Dividend Calendar Service
 *
 * Reads from idx_dividends (populated by syncDividends in sync-service.ts).
 * Yahoo's chart events=div only reports *historical* payouts, so the "upcoming"
 * section stays empty until a forward-looking source is wired; the page degrades
 * gracefully to a recent-history view.
 */

import { db } from "@/database/db";
import { idxDividends, idxCompanyProfiles } from "@/database/schema";
import { and, eq, gte, lte, desc, asc, sql, type SQL } from "drizzle-orm";

export interface DividendCalendarRow {
	symbol: string;
	name: string | null;
	sector: string | null;
	exDividendDate: string;
	amount: number;
	type: string;
	paymentDate: string | null;
}

export interface DividendCalendarResult {
	rows: DividendCalendarRow[];
	total: number;
}

/**
 * Dividends with ex-dividend date inside [from, to] (inclusive).
 * Dates are ISO strings (YYYY-MM-DD) matching how Yahoo reports them and how
 * syncDividends stores them.
 */
export async function getDividendCalendar(opts: {
	from: string;
	to: string;
	limit?: number;
}): Promise<DividendCalendarResult> {
	const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

	const rows = await db
		.select({
			symbol: idxDividends.symbol,
			name: idxCompanyProfiles.name,
			sector: idxCompanyProfiles.sector,
			exDividendDate: idxDividends.exDividendDate,
			amount: idxDividends.amount,
			type: idxDividends.type,
			paymentDate: idxDividends.paymentDate,
		})
		.from(idxDividends)
		.leftJoin(idxCompanyProfiles, eq(idxCompanyProfiles.symbol, idxDividends.symbol))
		.where(
			and(
				gte(idxDividends.exDividendDate, opts.from),
				lte(idxDividends.exDividendDate, opts.to),
			),
		)
		.orderBy(asc(idxDividends.exDividendDate), desc(idxDividends.amount))
		.limit(limit);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(idxDividends)
		.where(
			and(
				gte(idxDividends.exDividendDate, opts.from),
				lte(idxDividends.exDividendDate, opts.to),
			),
		);

	return { rows, total: count };
}

/** Recent N dividends across all symbols — for the "just went ex" section. */
export async function getRecentDividends(limit = 20): Promise<DividendCalendarRow[]> {
	const rows = await db
		.select({
			symbol: idxDividends.symbol,
			name: idxCompanyProfiles.name,
			sector: idxCompanyProfiles.sector,
			exDividendDate: idxDividends.exDividendDate,
			amount: idxDividends.amount,
			type: idxDividends.type,
			paymentDate: idxDividends.paymentDate,
		})
		.from(idxDividends)
		.leftJoin(idxCompanyProfiles, eq(idxCompanyProfiles.symbol, idxDividends.symbol))
		.orderBy(desc(idxDividends.exDividendDate))
		.limit(limit);

	return rows;
}

/** Full dividend history for a single ticker — used on the stock detail page. */
export async function getDividendsForSymbol(symbol: string, limit = 50): Promise<DividendCalendarRow[]> {
	const rows = await db
		.select({
			symbol: idxDividends.symbol,
			name: idxCompanyProfiles.name,
			sector: idxCompanyProfiles.sector,
			exDividendDate: idxDividends.exDividendDate,
			amount: idxDividends.amount,
			type: idxDividends.type,
			paymentDate: idxDividends.paymentDate,
		})
		.from(idxDividends)
		.leftJoin(idxCompanyProfiles, eq(idxCompanyProfiles.symbol, idxDividends.symbol))
		.where(eq(idxDividends.symbol, symbol.toUpperCase()))
		.orderBy(desc(idxDividends.exDividendDate))
		.limit(limit);

	return rows;
}

/**
 * Upcoming ex-dividend dates (today forward). Yahoo only reports historical
 * events, so this will return empty until a forward-looking source is wired.
 * Kept here so the UI can call it without knowing the data limitation.
 */
export async function getUpcomingDividends(limit = 20): Promise<DividendCalendarRow[]> {
	const today = new Date().toISOString().slice(0, 10);
	const rows = await db
		.select({
			symbol: idxDividends.symbol,
			name: idxCompanyProfiles.name,
			sector: idxCompanyProfiles.sector,
			exDividendDate: idxDividends.exDividendDate,
			amount: idxDividends.amount,
			type: idxDividends.type,
			paymentDate: idxDividends.paymentDate,
		})
		.from(idxDividends)
		.leftJoin(idxCompanyProfiles, eq(idxCompanyProfiles.symbol, idxDividends.symbol))
		.where(gte(idxDividends.exDividendDate, today))
		.orderBy(asc(idxDividends.exDividendDate))
		.limit(limit);

	return rows;
}
