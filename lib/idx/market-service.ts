/**
 * IDX Market Service
 *
 * Data source is Yahoo Finance (see lib/idx/yahoo-provider.ts) because
 * idx.co.id blocks server-side Node requests via Cloudflare TLS fingerprinting.
 * The emiten universe comes from the static snapshot in lib/idx/emiten.ts.
 *
 * The public method names are unchanged so existing callers keep working.
 */

import { IDX_EMITEN, findEmiten } from "./emiten";
import { getChart, getQuote, getQuotes, getCandles, searchIdxStocks } from "./yahoo-provider";
import type {
	StockQuote,
	MarketIndex,
	TopGainer,
	TopLoser,
	CompanyProfile,
	DailyOHLC,
} from "./types";

/**
 * Indices Yahoo exposes for Jakarta. IHSG is ^JKSE; the LQ45 index itself is
 * not consistently available, so only the ones that actually resolve are here.
 */
const INDEX_SYMBOLS: Array<{ yahoo: string; symbol: string; name: string }> = [
	{ yahoo: "^JKSE", symbol: "COMPOSITE", name: "IHSG" },
	{ yahoo: "^JKLQ45", symbol: "LQ45", name: "LQ45" },
];

/**
 * Liquid large caps used for the movers board. Scanning all 962 emiten on every
 * request would be ~962 Yahoo calls; this covers the names retail traders
 * actually watch. Widen it once quotes are cached in Postgres.
 */
const MOVERS_UNIVERSE = [
	"BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "UNTR", "ICBP", "INDF", "KLBF",
	"AMRT", "ADRO", "ANTM", "PTBA", "ITMG", "INCO", "MDKA", "SMGR", "INTP", "CPIN",
	"JPFA", "GGRM", "HMSP", "UNVR", "MYOR", "AKRA", "PGAS", "EXCL", "ISAT", "TOWR",
	"MIKA", "SIDO", "TPIA", "BRPT", "BRIS", "ARTO", "BBTN", "BJBR", "MEDC", "ELSA",
	"AADI", "BREN", "CUAN", "PANI", "DSSA", "AMMN", "RAJA", "BUKA", "GOTO", "EMTK",
];

function toStockQuote(q: {
	symbol: string;
	company: string;
	price: number;
	previousClose: number;
	change: number;
	changePercent: number;
	dayHigh: number;
	dayLow: number;
	open: number;
	volume: number;
	tradingDate: string;
}): StockQuote {
	const emiten = findEmiten(q.symbol);
	return {
		symbol: q.symbol,
		company: q.company || emiten?.name || q.symbol,
		price: q.price,
		change: q.change,
		changePercent: q.changePercent,
		volume: q.volume,
		value: q.price * q.volume, // Yahoo reports no turnover; approximate it
		frequency: 0, // not available from Yahoo
		open: q.open,
		high: q.dayHigh,
		low: q.dayLow,
		previousClose: q.previousClose,
		listedShares: 0, // not available from Yahoo chart meta
		foreignNetBuy: 0, // IDX-only metric, no public source
		tradingDate: q.tradingDate,
		timestamp: new Date(),
	};
}

export class IDXMarketService {
	/** Every listed emiten, profile-only (no prices). */
	getEmitenList(): CompanyProfile[] {
		return IDX_EMITEN.map((e) => ({
			symbol: e.symbol,
			name: e.name,
			sector: e.sector ?? "",
			industry: e.industry ?? e.subSector ?? "",
			subIndustry: e.subSector ?? "",
			listedDate: e.listedDate ?? "",
			listingBoard: e.board ?? undefined,
			website: e.website ?? undefined,
		}));
	}

	async getStockQuote(symbol: string): Promise<StockQuote | null> {
		const q = await getQuote(symbol);
		return q ? toStockQuote(q) : null;
	}

	/**
	 * Quotes for the liquid universe. This is NOT all 962 emiten — fetching
	 * those live would mean ~962 upstream calls per invocation.
	 */
	async getStockList(symbols: string[] = MOVERS_UNIVERSE): Promise<StockQuote[]> {
		const quotes = await getQuotes(symbols);
		return quotes.map(toStockQuote);
	}

	async getDailyOHLC(symbol: string, range = "6mo"): Promise<DailyOHLC[]> {
		const candles = await getCandles(symbol, range);
		return candles.map((c) => ({
			date: c.date,
			symbol: symbol.trim().toUpperCase(),
			open: c.open,
			high: c.high,
			low: c.low,
			close: c.close,
			volume: c.volume,
			value: c.close * c.volume,
			frequency: 0,
			foreignNetBuy: 0,
		}));
	}

	/** Quote + history in a single upstream call. */
	async getQuoteWithHistory(symbol: string, range = "6mo") {
		const chart = await getChart(symbol, range);
		if (!chart) return null;
		return { quote: toStockQuote(chart.quote), candles: chart.candles };
	}

	async getIndices(): Promise<MarketIndex[]> {
		const results = await Promise.allSettled(
			INDEX_SYMBOLS.map(async (idx) => {
				const chart = await getChart(idx.yahoo, "5d");
				if (!chart) return null;
				return {
					symbol: idx.symbol,
					name: idx.name,
					value: chart.quote.price,
					change: chart.quote.change,
					changePercent: chart.quote.changePercent,
					volume: chart.quote.volume,
					timestamp: new Date(),
				} satisfies MarketIndex;
			}),
		);
		return results
			.filter(
				(r): r is PromiseFulfilledResult<MarketIndex> =>
					r.status === "fulfilled" && r.value !== null,
			)
			.map((r) => r.value);
	}

	private async movers(): Promise<StockQuote[]> {
		const list = await this.getStockList();
		return list.filter((s) => s.previousClose > 0 && s.price > 0);
	}

	async getTopGainers(limit = 10): Promise<TopGainer[]> {
		return (await this.movers())
			.sort((a, b) => b.changePercent - a.changePercent)
			.slice(0, limit)
			.map(({ symbol, company, price, changePercent, volume }) => ({
				symbol,
				company,
				price,
				changePercent,
				volume,
			}));
	}

	async getTopLosers(limit = 10): Promise<TopLoser[]> {
		return (await this.movers())
			.sort((a, b) => a.changePercent - b.changePercent)
			.slice(0, limit)
			.map(({ symbol, company, price, changePercent, volume }) => ({
				symbol,
				company,
				price,
				changePercent,
				volume,
			}));
	}

	/** Local match on the emiten snapshot first, Yahoo search as fallback. */
	async searchStocks(query: string, limit = 10) {
		const q = query.trim().toUpperCase();
		if (!q) return [];

		const local = IDX_EMITEN.filter(
			(e) => e.symbol.includes(q) || e.name.toUpperCase().includes(q),
		)
			.slice(0, limit)
			.map((e) => ({
				symbol: e.symbol,
				name: e.name,
				sector: e.sector ?? undefined,
				industry: e.industry ?? undefined,
			}));

		return local.length > 0 ? local : searchIdxStocks(query, limit);
	}

	async getCompanyProfiles(): Promise<CompanyProfile[]> {
		return this.getEmitenList();
	}
}

export const idxMarketService = new IDXMarketService();
