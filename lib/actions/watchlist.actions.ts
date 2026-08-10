"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */


import { and, eq } from "drizzle-orm";
import { db, schema } from "@/database/db";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { fetchJSON } from "@/lib/finnhub/fetch";
import { idxMarketService } from "@/lib/idx/market-service";
import { idxCompanyService } from "@/lib/idx/company-service";
import { getStockQuote, getCompanyProfile } from "@/lib/market-unified";
import { formatMarketCapValue } from "@/lib/utils";
import { randomUUID } from "node:crypto";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";

/**
 * Determine market type based on symbol format
 */
import { findEmiten } from "@/lib/idx/emiten";

/** Return IDX only for symbols present in the IDX static emiten snapshot. */
function detectMarket(symbol: string): "US" | "IDX" {
	return findEmiten(symbol.toUpperCase().trim()) ? "IDX" : "US";
}

export async function getSessionUserId(): Promise<string | null> {
	const session = await auth.api.getSession({ headers: await headers() });
	return session?.user?.id ?? null;
}

export async function getWatchlistSymbolsForUser(userId: string): Promise<{symbol: string; market?: "US" | "IDX"}[]> {
	const rows = await db
		.select({ symbol: schema.watchlist.symbol, market: schema.watchlist.market })
		.from(schema.watchlist)
		.where(eq(schema.watchlist.userId, userId));
	
	return rows.map(row => ({
		symbol: row.symbol,
		market: row.market as "US" | "IDX" || "US"
	}));
}

export async function getWatchlistSymbols(): Promise<{symbol: string; market?: "US" | "IDX"}[]> {
	const userId = await getSessionUserId();
	return userId ? getWatchlistSymbolsForUser(userId) : [];
}

export async function addToWatchlist(symbol: string, company: string) {
	const userId = await getSessionUserId();
	if (!userId) return { success: false, error: "Not authenticated" };
	
	const normalized = symbol.trim().toUpperCase();
	const market = detectMarket(normalized);
	
	if (!normalized || normalized.length > 20) return { success: false, error: "Invalid symbol" };

	try {
		await db.insert(schema.watchlist).values({
			id: randomUUID(), 
			userId, 
			symbol: normalized,
			market,
			company: company.trim().slice(0, 200) || normalized,
		}).onConflictDoNothing();
		
		revalidatePath("/watchlist");
		return { success: true, market };
	} catch (err) {
		console.error("addToWatchlist", err);
		return { success: false, error: "Failed to add to watchlist" };
	}
}

export async function removeFromWatchlist(symbol: string) {
	const userId = await getSessionUserId();
	if (!userId) return { success: false, error: "Not authenticated" };
	
	const market = detectMarket(symbol);
	
	try {
		await db.delete(schema.watchlist).where(and(
			eq(schema.watchlist.userId, userId),
			eq(schema.watchlist.symbol, symbol.trim().toUpperCase()),
			eq(schema.watchlist.market, market),
		));
		
		revalidatePath("/watchlist");
		return { success: true };
	} catch (err) {
		console.error("removeFromWatchlist", err);
		return { success: false, error: "Failed to remove from watchlist" };
	}
}

export async function isSymbolInWatchlist(symbol: string): Promise<boolean> {
	const userId = await getSessionUserId();
	if (!userId) return false;
	
	const market = detectMarket(symbol);
	
	const rows = await db.select({ id: schema.watchlist.id }).from(schema.watchlist).where(and(
		eq(schema.watchlist.userId, userId),
		eq(schema.watchlist.symbol, symbol.trim().toUpperCase()),
		eq(schema.watchlist.market, market),
	)).limit(1);
	
	return rows.length > 0;
}

export async function getUserWatchlist(): Promise<StockWithData[]> {
	const userId = await getSessionUserId();
	if (!userId) return [];
	
	const items = await db.select().from(schema.watchlist).where(eq(schema.watchlist.userId, userId));
	if (!items.length) return items.map((item) => ({
		userId: item.userId, 
		symbol: item.symbol, 
		company: item.company, 
		addedAt: item.addedAt,
		market: item.market,
	}));

	const enriched = await Promise.allSettled(items.map(async (item) => {
		const sym = item.symbol;
		const market = item.market || detectMarket(sym);
		
		let quote: unknown = null;
		let profile: unknown = null;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const metrics = null;
		
		if (market === "IDX") {
			// Use IDX service
			const [quoteResult, profileResult] = await Promise.all([
				idxMarketService.getStockQuote(sym),
				idxCompanyService.getCompanyProfile(sym),
			]);
			
			quote = quoteResult;
			profile = profileResult;
			
			if (!quote) {
				return {
					userId: item.userId,
					symbol: sym,
					company: typeof profile === 'object' && profile !== null ? (profile as any).name : item.company,
					addedAt: item.addedAt,
					market,
					currentPrice: undefined,
					changePercent: undefined,
					priceFormatted: undefined,
					changeFormatted: undefined,
					isIdx: true,
				};
			}
			
			const currentPrice = Number((quote as any).price) || undefined;
			const changePercent = Number((quote as any).changePercent) || undefined;
			
			return {
				userId: item.userId,
				symbol: sym,
				company: typeof profile === 'object' && profile !== null ? (profile as any).name : (quote as any).company || item.company,
				addedAt: item.addedAt,
				market,
				currentPrice,
				changePercent,
				priceFormatted: currentPrice != null ? `Rp ${currentPrice.toFixed(2)}` : undefined,
				changeFormatted: changePercent != null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%` : undefined,
				volume: (quote as any).volume,
				value: (quote as any).value,
				isIdx: true,
			};
		} else {
			// Use Finnhub for US/global
			const [quoteResult, profileResult, metricsResult] = await Promise.allSettled([
				fetchJSON<Record<string, unknown>>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_API_KEY}`, 60),
				fetchJSON<Record<string, unknown>>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_API_KEY}`, 3600),
				fetchJSON<Record<string, unknown>>(`${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${FINNHUB_API_KEY}`, 3600),
			]);
			
			const q = quoteResult.status === "fulfilled" ? quoteResult.value : null;
			const p = profileResult.status === "fulfilled" ? profileResult.value : null;
			const m = metricsResult.status === "fulfilled" ? metricsResult.value : null;
			const currentPrice = q?.c != null ? Number(q.c) : undefined;
			const changePercent = q?.dp != null ? Number(q.dp) : undefined;
			// Finnhub profile2 reports marketCapitalization in millions USD.
			const marketCapRaw = p?.marketCapitalization != null ? Number(p.marketCapitalization) * 1_000_000 : undefined;
			const metricObj = m?.metric as Record<string, unknown> | undefined;
			const peRaw = metricObj?.peBasicExclExtraTTM != null ? Number(metricObj.peBasicExclExtraTTM) : undefined;
			
			return {
				userId: item.userId, 
				symbol: sym, 
				company: p?.name ? String(p.name) : item.company, 
				addedAt: item.addedAt,
				market,
				currentPrice, 
				changePercent,
				priceFormatted: currentPrice != null ? `$${currentPrice.toFixed(2)}` : undefined,
				changeFormatted: changePercent != null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%` : undefined,
				marketCap: marketCapRaw != null ? formatMarketCapValue(marketCapRaw) : undefined,
				peRatio: peRaw != null ? peRaw.toFixed(2) : "N/A",
				isIdx: false,
			};
		}
	}));
	
	return enriched.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<StockWithData>).value);
}
