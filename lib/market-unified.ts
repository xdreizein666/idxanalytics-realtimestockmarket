/**
 * Unified Market Data Service
 * 
 * Provides a consistent interface for accessing market data from both
 * IDX (Indonesian Stock Exchange) and Finnhub (Global markets).
 * Automatically detects market source and routes queries appropriately.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { idxMarketService, idxCompanyService } from "@/lib/idx";
import { fetchJSON } from "@/lib/finnhub/fetch";
import type { StockQuote, CompanyProfile, FinancialRatio } from "@/lib/idx";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";

// Indonesian stocks typically have 4-character symbols
const isIDXSymbol = (symbol: string): boolean => {
	const cleanSymbol = symbol.toUpperCase().trim();
	return /^[A-Z]{2,6}$/.test(cleanSymbol); // Most IDX stocks are 4 chars
};

/**
 * Get stock quote - works for both IDX and Global markets
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
	const cleanSymbol = symbol.toUpperCase().trim();

	if (isIDXSymbol(cleanSymbol)) {
		// Route to IDX service
		return await idxMarketService.getStockQuote(cleanSymbol);
	} else {
		// Route to Finnhub
		try {
			const response = await fetchJSON<unknown>(
				`${FINNHUB_BASE_URL}/quote?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`
			);
			
			if (!response || !(response as any).c) return null;

			return {
				symbol: cleanSymbol,
				company: "", // Will be fetched separately
				price: Number((response as any).c) || 0,
				change: Number((response as any).d) || 0,
				changePercent: Number((response as any).dp) || 0,
				volume: Number((response as any).v) || 0,
				value: 0,
				frequency: 0,
				open: Number((response as any).o) || 0,
				high: Number((response as any).h) || 0,
				low: Number((response as any).l) || 0,
				previousClose: Number((response as any).pc) || 0,
				// IDX-only fields; Finnhub's /quote does not report them.
				listedShares: 0,
				foreignNetBuy: 0,
				tradingDate: new Date().toISOString().slice(0, 10),
				timestamp: new Date(),
			};
		} catch (error) {
			console.error(`[UNIFIED] Error fetching quote for ${cleanSymbol}:`, error);
			return null;
		}
	}
}

/**
 * Get company profile - works for both IDX and Global markets
 */
export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
	const cleanSymbol = symbol.toUpperCase().trim();

	if (isIDXSymbol(cleanSymbol)) {
		return await idxCompanyService.getCompanyProfile(cleanSymbol);
	} else {
		// Finnhub profile
		try {
			const response = await fetchJSON<unknown>(
				`${FINNHUB_BASE_URL}/stock/profile2?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`,
				3600
			);
			
			if (!response) return null;

			return {
				symbol: cleanSymbol,
				name: (response as any).name || "",
				sector: (response as any).sector || "",
				industry: (response as any).industry || "",
				subIndustry: "",
				website: (response as any).website || undefined,
				description: (response as any).description || undefined,
				listedDate: "",
				sharesOutstanding: Number((response as any).shareOutstanding) || 0,
				marketCap: Number((response as any).marketCapitalization) || 0,
				fiscalYearEnd: "",
			};
		} catch (error) {
			console.error(`[UNIFIED] Error fetching profile for ${cleanSymbol}:`, error);
			return null;
		}
	}
}

/**
 * Get financial ratios - IDX only currently
 */
export async function getFinancialRatios(symbol: string): Promise<FinancialRatio[]> {
	const cleanSymbol = symbol.toUpperCase().trim();

	if (isIDXSymbol(cleanSymbol)) {
		return await idxCompanyService.getFinancialRatios(cleanSymbol);
	} else {
		// Finnhub doesn't provide comprehensive fundamental ratios
		// Return empty array for now
		return [];
	}
}

/**
 * Get top gainers - specific per market
 */
export async function getTopGainers(market: "IDX" | "US" = "IDX", limit: number = 10) {
	if (market === "IDX") {
		return await idxMarketService.getTopGainers(limit);
	} else {
		// Finnhub US top gainers
		try {
			const response = await fetchJSON<unknown>(
				`${FINNHUB_BASE_URL}/stocks/get-gainers?token=${FINNHUB_API_KEY}`
			);
			
			if (!(response as any)?.data) return [];

			return (response as any).data.slice(0, limit).map((item: any) => ({
				symbol: item.symbol || "",
				name: item.description || "",
				price: 0,
				changePercent: 0,
				volume: 0,
			}));
		} catch (error) {
			console.error("[UNIFIED] Error fetching top gainers:", error);
			return [];
		}
	}
}

/**
 * Get top losers - specific per market
 */
export async function getTopLosers(market: "IDX" | "US" = "IDX", limit: number = 10) {
	if (market === "IDX") {
		return await idxMarketService.getTopLosers(limit);
	} else {
		// Finnhub US top losers
		try {
			const response = await fetchJSON<unknown>(
				`${FINNHUB_BASE_URL}/stocks/get-loosers?token=${FINNHUB_API_KEY}`
			);
			
			if (!(response as any)?.data) return [];

			return (response as any).data.slice(0, limit).map((item: any) => ({
				symbol: item.symbol || "",
				name: item.description || "",
				price: 0,
				changePercent: 0,
				volume: 0,
			}));
		} catch (error) {
			console.error("[UNIFIED] Error fetching top losers:", error);
			return [];
		}
	}
}

/**
 * Search stocks across both markets
 */
export async function searchStocks(query: string): Promise<Array<{
	symbol: string;
	name: string;
	exchange: string;
	type: string;
}>> {
	const cleanQuery = query.trim();
	const results: Array<{
		symbol: string;
		name: string;
		exchange: string;
		type: string;
	}> = [];

	// Search IDX if query looks like it could be IDX
	if (/^[a-zA-Z]+$/.test(cleanQuery) && cleanQuery.length <= 6) {
		try {
			const companies = await idxCompanyService.searchCompanies(cleanQuery);
			results.push(...companies.map(c => ({
				symbol: c.symbol,
				name: c.name,
				exchange: "IDX",
				type: "Stock"
			})));
		} catch (error) {
			console.error("[UNIFIED] IDX search failed:", error);
		}
	}

	// Always search Finnhub too
	try {
		const token = FINNHUB_API_KEY;
		if (token && cleanQuery) {
			const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(cleanQuery)}&token=${token}`;
			const data = await fetchJSON<unknown>(url, 1800);
			
			if ((data as any)?.result) {
				const finnhubResults = (data as any).result.map((r: any) => ({
					symbol: (r.symbol || "").toUpperCase(),
					name: r.description || (r.symbol || ""),
					exchange: "US",
					type: r.type || "Stock"
				})).filter((r: any) => r.symbol.length > 0);
				
				results.push(...finnhubResults);
			}
		}
	} catch (error) {
		console.error("[UNIFIED] Finnhub search failed:", error);
	}

	return results;
}

/**
 * Determine market type based on symbol
 */
export function detectMarket(symbol: string): "IDX" | "US" | "OTHER" {
	const cleanSymbol = symbol.toUpperCase().trim();
	
	if (isIDXSymbol(cleanSymbol)) {
		return "IDX";
	}
	
	// Could add more market detection logic here
	return "US"; // Default to US/global
}
