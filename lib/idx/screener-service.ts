/**
 * Indonesian Stock Screener Service
 *
 * Screens IDX equities on fundamentals (PER, PBV, ROE, ROA, dividend yield),
 * sector, and market cap.
 *
 * Data flow: fundamentals are synced into idx_financial_ratios by
 * syncFundamentals() (see lib/idx/sync-service.ts) and read from Postgres here.
 * Screening 962 tickers live against Yahoo per request would be far too slow and
 * would get rate-limited, so the screener is DB-only by design.
 */

import { db } from "@/database/db";
import { idxCompanyProfiles, idxDailyQuotes, idxFinancialRatios } from "@/database/schema";
import { and, desc, eq, gte, isNotNull, lte, sql, type SQL } from "drizzle-orm";

export interface ScreenerFilters {
	sector?: string;
	minPer?: number;
	maxPer?: number;
	minPbv?: number;
	maxPbv?: number;
	minRoe?: number; // percent, e.g. 15 = 15%
	maxRoe?: number;
	minDividendYield?: number; // percent
	minMarketCap?: number; // IDR
	maxMarketCap?: number;
	sortBy?: "per" | "pbv" | "roe" | "dividendYield" | "marketCap";
	sortDir?: "asc" | "desc";
	limit?: number;
}

export interface ScreenerRow {
	symbol: string;
	name: string;
	sector: string | null;
	price: number | null;
	peRatio: number | null;
	pbvRatio: number | null;
	roe: number | null; // percent
	roa: number | null; // percent
	dividendYield: number | null; // percent
	eps: number | null;
	marketCap: number | null;
}

const SORT_COLUMNS = {
	per: idxFinancialRatios.peRatio,
	pbv: idxFinancialRatios.pbvRatio,
	roe: idxFinancialRatios.roe,
	dividendYield: idxFinancialRatios.dividendYield,
	marketCap: idxCompanyProfiles.marketCap,
} as const;

/**
 * Latest report row per symbol. idx_financial_ratios keeps history by
 * reportDate, so a plain join would multiply rows per ticker. The aggregate is
 * aliased away from "report_date" because reusing that name makes the join
 * predicate ambiguous against the base table's own column.
 */
const latestRatioDate = db
	.select({
		symbol: idxFinancialRatios.symbol,
		maxReportDate: sql<string>`max(${idxFinancialRatios.reportDate})`.as("max_report_date"),
	})
	.from(idxFinancialRatios)
	.groupBy(idxFinancialRatios.symbol)
	.as("latest_ratio");

/** Most recent close per symbol, for display alongside the ratios. */
const latestQuote = db
	.select({
		symbol: idxDailyQuotes.symbol,
		close: sql<number>`(array_agg(${idxDailyQuotes.close} order by ${idxDailyQuotes.date} desc))[1]`.as(
			"close",
		),
	})
	.from(idxDailyQuotes)
	.groupBy(idxDailyQuotes.symbol)
	.as("latest_quote");

export async function screenStocks(filters: ScreenerFilters = {}): Promise<ScreenerRow[]> {
	const conditions: SQL[] = [];

	if (filters.sector) conditions.push(eq(idxCompanyProfiles.sector, filters.sector));
	if (filters.minPer !== undefined) conditions.push(gte(idxFinancialRatios.peRatio, filters.minPer));
	if (filters.maxPer !== undefined) conditions.push(lte(idxFinancialRatios.peRatio, filters.maxPer));
	if (filters.minPbv !== undefined) conditions.push(gte(idxFinancialRatios.pbvRatio, filters.minPbv));
	if (filters.maxPbv !== undefined) conditions.push(lte(idxFinancialRatios.pbvRatio, filters.maxPbv));
	// ROE/yield are stored as percent, matching the filter inputs.
	if (filters.minRoe !== undefined) conditions.push(gte(idxFinancialRatios.roe, filters.minRoe));
	if (filters.maxRoe !== undefined) conditions.push(lte(idxFinancialRatios.roe, filters.maxRoe));
	if (filters.minDividendYield !== undefined)
		conditions.push(gte(idxFinancialRatios.dividendYield, filters.minDividendYield));
	if (filters.minMarketCap !== undefined)
		conditions.push(gte(idxCompanyProfiles.marketCap, filters.minMarketCap));
	if (filters.maxMarketCap !== undefined)
		conditions.push(lte(idxCompanyProfiles.marketCap, filters.maxMarketCap));

	const sortColumn = SORT_COLUMNS[filters.sortBy ?? "marketCap"];
	// A NULL ratio is "unknown", not "best" — keep those rows out of the top of the list.
	conditions.push(isNotNull(sortColumn));

	const orderBy = filters.sortDir === "asc" ? sortColumn : desc(sortColumn);
	const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

	const rows = await db
		.select({
			symbol: idxCompanyProfiles.symbol,
			name: idxCompanyProfiles.name,
			sector: idxCompanyProfiles.sector,
			marketCap: idxCompanyProfiles.marketCap,
			price: latestQuote.close,
			peRatio: idxFinancialRatios.peRatio,
			pbvRatio: idxFinancialRatios.pbvRatio,
			roe: idxFinancialRatios.roe,
			roa: idxFinancialRatios.roa,
			dividendYield: idxFinancialRatios.dividendYield,
			eps: idxFinancialRatios.eps,
		})
		.from(idxFinancialRatios)
		.innerJoin(
			latestRatioDate,
			and(
				eq(idxFinancialRatios.symbol, latestRatioDate.symbol),
				eq(idxFinancialRatios.reportDate, latestRatioDate.maxReportDate),
			),
		)
		.innerJoin(idxCompanyProfiles, eq(idxCompanyProfiles.symbol, idxFinancialRatios.symbol))
		.leftJoin(latestQuote, eq(latestQuote.symbol, idxFinancialRatios.symbol))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(orderBy)
		.limit(limit);

	return rows;
}

/** Sectors that actually have screenable rows, for the filter dropdown. */
export async function getScreenerSectors(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ sector: idxCompanyProfiles.sector })
		.from(idxCompanyProfiles)
		.where(isNotNull(idxCompanyProfiles.sector));

	return rows
		.map((r) => r.sector)
		.filter((s): s is string => Boolean(s))
		.sort();
}
