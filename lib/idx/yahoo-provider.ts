/**
 * Yahoo Finance data provider for IDX (Jakarta) equities.
 *
 * WHY NOT idx.co.id: the official endpoints (/primary/TradingSummary/...) are
 * behind Cloudflare with TLS/JA3 fingerprinting. curl gets HTTP 200 while
 * Node's fetch/undici/http2 get 403 in the same second with identical headers —
 * so no header or cipher tweak fixes it from a Node server. Verified 2026-08.
 *
 * Yahoo serves the same instruments as `<CODE>.JK` (currency IDR, exchange JKT)
 * and responds fine to server-side Node requests.
 */

const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const ALLOWED_HOSTS = new Set([
	"query1.finance.yahoo.com",
	"query2.finance.yahoo.com",
]);

export interface IdxCandle {
	date: string; // YYYY-MM-DD
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface IdxQuote {
	symbol: string; // plain IDX code, e.g. "BBCA"
	company: string;
	price: number;
	previousClose: number;
	change: number;
	changePercent: number;
	dayHigh: number;
	dayLow: number;
	open: number;
	volume: number;
	currency: string;
	tradingDate: string; // YYYY-MM-DD
}

/** "BBCA" -> "BBCA.JK". Index symbols (^JKSE) and already-suffixed input pass through. */
export function toYahooSymbol(symbol: string): string {
	const clean = symbol.trim().toUpperCase();
	if (clean.startsWith("^") || clean.includes(".")) return clean;
	return `${clean}.JK`;
}

/** "BBCA.JK" -> "BBCA" */
export function fromYahooSymbol(symbol: string): string {
	return symbol.trim().toUpperCase().replace(/\.JK$/, "");
}

async function yahooFetch<T>(url: string, revalidateSeconds: number): Promise<T> {
	if (!ALLOWED_HOSTS.has(new URL(url).hostname)) {
		throw new Error("Only Yahoo Finance hosts are allowed");
	}
	const res = await fetch(url, {
		headers: { "User-Agent": UA, Accept: "application/json" },
		next: { revalidate: revalidateSeconds },
	});
	if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
	return (await res.json()) as T;
}

interface ChartResponse {
	chart: {
		result?: Array<{
			meta: {
				symbol: string;
				currency: string;
				regularMarketPrice: number;
				chartPreviousClose?: number;
				previousClose?: number;
				regularMarketDayHigh?: number;
				regularMarketDayLow?: number;
				regularMarketVolume?: number;
				longName?: string;
				shortName?: string;
			};
			timestamp?: number[];
			indicators: {
				quote: Array<{
					open?: (number | null)[];
					high?: (number | null)[];
					low?: (number | null)[];
					close?: (number | null)[];
					volume?: (number | null)[];
				}>;
			};
		}>;
		error?: { description?: string } | null;
	};
}

/**
 * One chart call gives both the live quote and the OHLCV history, so callers
 * that need both (stock detail page) pay a single request.
 */
export async function getChart(
	symbol: string,
	range = "6mo",
	interval = "1d",
): Promise<{ quote: IdxQuote; candles: IdxCandle[] } | null> {
	try {
		const y = toYahooSymbol(symbol);
		const data = await yahooFetch<ChartResponse>(
			`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=${range}&interval=${interval}`,
			300,
		);
		const result = data.chart?.result?.[0];
		if (!result) return null;

		const { meta } = result;
		const q = result.indicators.quote[0] ?? {};
		const stamps = result.timestamp ?? [];

		const candles: IdxCandle[] = [];
		for (let i = 0; i < stamps.length; i++) {
			const close = q.close?.[i];
			if (close == null) continue; // Yahoo emits nulls for halted sessions
			candles.push({
				date: new Date(stamps[i] * 1000).toISOString().slice(0, 10),
				open: q.open?.[i] ?? close,
				high: q.high?.[i] ?? close,
				low: q.low?.[i] ?? close,
				close,
				volume: q.volume?.[i] ?? 0,
			});
		}

		const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
		const price = meta.regularMarketPrice ?? candles.at(-1)?.close ?? 0;
		const change = previousClose > 0 ? price - previousClose : 0;

		return {
			quote: {
				symbol: fromYahooSymbol(meta.symbol),
				company: meta.longName ?? meta.shortName ?? "",
				price,
				previousClose,
				change,
				changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
				dayHigh: meta.regularMarketDayHigh ?? 0,
				dayLow: meta.regularMarketDayLow ?? 0,
				open: candles.at(-1)?.open ?? 0,
				volume: meta.regularMarketVolume ?? 0,
				currency: meta.currency ?? "IDR",
				tradingDate: candles.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
			},
			candles,
		};
	} catch (error) {
		console.error(`[IDX/yahoo] getChart(${symbol}) failed:`, error);
		return null;
	}
}

export async function getQuote(symbol: string): Promise<IdxQuote | null> {
	return (await getChart(symbol, "5d", "1d"))?.quote ?? null;
}

/** Daily OHLCV only. */
export async function getCandles(symbol: string, range = "6mo"): Promise<IdxCandle[]> {
	return (await getChart(symbol, range, "1d"))?.candles ?? [];
}

interface SearchResponse {
	quotes?: Array<{
		symbol?: string;
		exchange?: string;
		shortname?: string;
		longname?: string;
		quoteType?: string;
		sector?: string;
		industry?: string;
	}>;
}

export interface IdxSearchResult {
	symbol: string;
	name: string;
	sector?: string;
	industry?: string;
}

/** Search Jakarta-listed equities only. */
export async function searchIdxStocks(query: string, limit = 10): Promise<IdxSearchResult[]> {
	const q = query.trim();
	if (!q) return [];
	try {
		const data = await yahooFetch<SearchResponse>(
			`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${limit * 3}&newsCount=0`,
			1800,
		);
		return (data.quotes ?? [])
			.filter((r) => r.exchange === "JKT" && r.quoteType === "EQUITY" && r.symbol)
			.slice(0, limit)
			.map((r) => ({
				symbol: fromYahooSymbol(r.symbol!),
				name: r.longname ?? r.shortname ?? "",
				sector: r.sector,
				industry: r.industry,
			}));
	} catch (error) {
		console.error(`[IDX/yahoo] searchIdxStocks(${query}) failed:`, error);
		return [];
	}
}

/** Fetch many quotes with bounded concurrency (Yahoo throttles bursts). */
export async function getQuotes(symbols: string[], concurrency = 6): Promise<IdxQuote[]> {
	const out: IdxQuote[] = [];
	const queue = [...symbols];

	await Promise.all(
		Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
			while (queue.length > 0) {
				const symbol = queue.shift();
				if (!symbol) break;
				const quote = await getQuote(symbol);
				if (quote) out.push(quote);
			}
		}),
	);

	return out;
}

// ---------------------------------------------------------------------------
// Fundamentals (quoteSummary) — requires a session crumb, unlike chart/search.
// ---------------------------------------------------------------------------

interface CrumbSession {
	cookie: string;
	crumb: string;
	expiresAt: number;
}

let cachedSession: CrumbSession | null = null;

/** Yahoo's quoteSummary rejects anonymous calls; exchange a seed cookie for a crumb once, cache ~1h. */
async function getCrumbSession(): Promise<CrumbSession> {
	if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession;

	const seed = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
	const cookie = (seed.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
	if (!cookie) throw new Error("Yahoo did not set a session cookie");

	const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
		headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
	});
	const crumb = (await crumbRes.text()).trim();
	if (!crumbRes.ok || !crumb || crumb.includes("<")) throw new Error("Failed to obtain Yahoo crumb");

	cachedSession = { cookie, crumb, expiresAt: Date.now() + 55 * 60 * 1000 };
	return cachedSession;
}

export interface IdxFundamentals {
	symbol: string;
	peRatio: number | null;
	pbvRatio: number | null;
	roe: number | null; // fraction, e.g. 0.218 = 21.8%
	roa: number | null;
	netMargin: number | null;
	eps: number | null;
	dividendYield: number | null; // fraction
	marketCap: number | null;
}

interface QuoteSummaryResponse {
	quoteSummary: {
		result?: Array<{
			summaryDetail?: { trailingPE?: { raw?: number }; dividendYield?: { raw?: number } };
			defaultKeyStatistics?: { priceToBook?: { raw?: number }; trailingEps?: { raw?: number } };
			financialData?: {
				returnOnEquity?: { raw?: number };
				returnOnAssets?: { raw?: number };
				profitMargins?: { raw?: number };
			};
			price?: { marketCap?: { raw?: number } };
		}>;
		error?: { description?: string } | null;
	};
}

const FUNDAMENTALS_MODULES = "summaryDetail,defaultKeyStatistics,financialData,price";

/** PER/PBV/ROE/ROA/EPS/dividend yield/market cap for one IDX ticker. Session-authenticated Yahoo call. */
export async function getFundamentals(symbol: string): Promise<IdxFundamentals | null> {
	try {
		const { cookie, crumb } = await getCrumbSession();
		const ySymbol = toYahooSymbol(symbol);
		const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ySymbol}?modules=${FUNDAMENTALS_MODULES}&crumb=${encodeURIComponent(crumb)}`;

		const res = await fetch(url, {
			headers: { "User-Agent": UA, Cookie: cookie, Accept: "application/json" },
			next: { revalidate: 3600 },
		});
		if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);

		const data = (await res.json()) as QuoteSummaryResponse;
		const r = data.quoteSummary.result?.[0];
		if (!r) return null;

		return {
			symbol: fromYahooSymbol(ySymbol),
			peRatio: r.summaryDetail?.trailingPE?.raw ?? null,
			pbvRatio: r.defaultKeyStatistics?.priceToBook?.raw ?? null,
			roe: r.financialData?.returnOnEquity?.raw ?? null,
			roa: r.financialData?.returnOnAssets?.raw ?? null,
			netMargin: r.financialData?.profitMargins?.raw ?? null,
			eps: r.defaultKeyStatistics?.trailingEps?.raw ?? null,
			dividendYield: r.summaryDetail?.dividendYield?.raw ?? null,
			marketCap: r.price?.marketCap?.raw ?? null,
		};
	} catch (error) {
		console.error(`[IDX/yahoo] getFundamentals(${symbol}) failed:`, error);
		return null;
	}
}

// ---------------------------------------------------------------------------
// Dividend history — comes free from the chart endpoint's events=div, no crumb needed.
// ---------------------------------------------------------------------------

export interface IdxDividendEvent {
	date: string; // YYYY-MM-DD (ex-dividend date, per Yahoo's event timestamp)
	amount: number; // IDR per share
}

interface ChartWithDividendsResponse {
	chart: {
		result?: Array<{
			events?: { dividends?: Record<string, { date: number; amount: number }> };
		}>;
	};
}

/** Dividend payout history for one IDX ticker, from the chart endpoint's dividend events. */
export async function getDividendHistory(symbol: string, range = "5y"): Promise<IdxDividendEvent[]> {
	try {
		const ySymbol = toYahooSymbol(symbol);
		const data = await yahooFetch<ChartWithDividendsResponse>(
			`https://query1.finance.yahoo.com/v8/finance/chart/${ySymbol}?range=${range}&interval=1d&events=div`,
			21600,
		);
		const divs = data.chart.result?.[0]?.events?.dividends ?? {};
		return Object.values(divs)
			.map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: d.amount }))
			.sort((a, b) => a.date.localeCompare(b.date));
	} catch (error) {
		console.error(`[IDX/yahoo] getDividendHistory(${symbol}) failed:`, error);
		return [];
	}
}
