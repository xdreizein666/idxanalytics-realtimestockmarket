/**
 * Technical Analysis Indicators Service for IDX Stocks
 *
 * Provides calculation of common technical indicators for Indonesian stocks
 * including:
 * - Moving Averages (SMA, EMA)
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - Bollinger Bands
 * - Stochastic Oscillator
 * - Volume-based indicators
 *
 * Fallback strategy:
 * - Tries to load historical quotes from idx_daily_quotes table first
 * - If insufficient data (< 60 days), falls back to Yahoo Finance (.JK) via lib/idx/yahoo-provider.ts
 */

import { db } from "@/database/db";
import { idxDailyQuotes } from "@/database/schema";
import { desc, eq } from "drizzle-orm";
import { getCandles, IdxCandle } from "./yahoo-provider";

export interface OHLCData {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

// Indicator results interfaces
export interface SMAIndicator {
	symbol: string;
	dates: string[];
	values: number[];
	period: number;
}

export interface EMAIndicator {
	symbol: string;
	dates: string[];
	values: number[];
	period: number;
}

export interface RSIResult {
	symbol: string;
	dates: string[];
	values: number[];
	period?: number;
}

export interface MACDResult {
	symbol: string;
	dates: string[];
	macd: number[];
	signal: number[];
	histogram: number[];
	fastPeriod?: number;
	slowPeriod?: number;
	signalPeriod?: number;
}

export interface BollingerBandsResult {
	symbol: string;
	dates: string[];
	upper: number[];
	middle: number[];
	lower: number[];
	period?: number;
	stdDev?: number;
}

export interface StochasticResult {
	symbol: string;
	dates: string[];
	k: number[];
	d: number[];
}

// ============================================================================
// Data Source Layer
// ============================================================================

/**
 * Get historical OHLCV data for a stock.
 * Tries DB first; if < 60 days available, falls back to Yahoo Finance.
 */
async function getOHLCVHistory(symbol: string, days: number = 60): Promise<OHLCData[]> {
	try {
		const cleanSymbol = symbol.toUpperCase().trim();

		// Try DB first
		const dbResults = await db
			.select()
			.from(idxDailyQuotes)
			.where(eq(idxDailyQuotes.symbol, cleanSymbol))
			.orderBy(desc(idxDailyQuotes.date))
			.limit(days);

		if (dbResults.length >= 20) {
			// Enough data in DB
			return dbResults.map((row) => ({
				date: row.date,
				open: Number(row.open),
				high: Number(row.high),
				low: Number(row.low),
				close: Number(row.close),
				volume: row.volume,
			})) as OHLCData[];
		}

		// Fallback to Yahoo
		console.log(`[TECHNICAL] ${cleanSymbol}: only ${dbResults.length} days in DB, fetching from Yahoo...`);
		const candles = await getCandles(cleanSymbol, "1y");
		return candles.map((c) => ({
			date: c.date,
			open: c.open,
			high: c.high,
			low: c.low,
			close: c.close,
			volume: c.volume,
		})) as OHLCData[];
	} catch (error) {
		console.error(`[TECHNICAL] Error fetching history for ${symbol}:`, error);
		// Last resort: try Yahoo directly without DB check
		try {
			const candles = await getCandles(symbol, "1y");
			return candles.map((c) => ({
				date: c.date,
				open: c.open,
				high: c.high,
				low: c.low,
				close: c.close,
				volume: c.volume,
			})) as OHLCData[];
		} catch {
			return [];
		}
	}
}

// ============================================================================
// Indicator Calculators
// ============================================================================

/**
 * Simple Moving Average (SMA)
 */
export async function calculateSMA(
	symbol: string,
	period: number = 20,
): Promise<SMAIndicator> {
	const data = await getOHLCVHistory(symbol, period * 2);

	if (data.length < period) {
		return { symbol, dates: [], values: [], period };
	}

	const dates: string[] = [];
	const values: number[] = [];

	for (let i = period - 1; i < data.length; i++) {
		const slice = data.slice(i - period + 1, i + 1);
		const sum = slice.reduce((acc, d) => acc + d.close, 0);
		const sma = sum / period;

		dates.push(data[i].date);
		values.push(sma);
	}

	return { symbol, dates, values, period };
}

/**
 * Exponential Moving Average (EMA)
 */
export async function calculateEMA(
	symbol: string,
	period: number = 20,
): Promise<EMAIndicator> {
	const data = await getOHLCVHistory(symbol, period * 2);

	if (data.length < period) {
		return { symbol, dates: [], values: [], period };
	}

	// Calculate initial SMA for warm-up period
	const initialSum = data.slice(0, period).reduce((acc, d) => acc + d.close, 0);
	const initialEMA = initialSum / period;

	const multiplier = 2 / (period + 1);

	const dates: string[] = [data[period - 1].date];
	const values: number[] = [initialEMA];

	let ema = initialEMA;

	for (let i = period; i < data.length; i++) {
		ema = (data[i].close - ema) * multiplier + ema;

		dates.push(data[i].date);
		values.push(ema);
	}

	return { symbol, dates, values, period };
}

/**
 * Relative Strength Index (RSI)
 */
export async function calculateRSI(
	symbol: string,
	period: number = 14,
): Promise<RSIResult> {
	const data = await getOHLCVHistory(symbol, period + 1);

	if (data.length < period + 1) {
		return { symbol, dates: [], values: [], period };
	}

	const dates: string[] = [];
	const values: number[] = [];

	let gains = 0;
	let losses = 0;

	// Initial average gain/loss
	for (let i = 1; i <= period; i++) {
		const change = data[i].close - data[i - 1].close;
		if (change > 0) {
			gains += change;
		} else {
			losses += Math.abs(change);
		}
	}

	let avgGain = gains / period;
	let avgLoss = losses / period;

	for (let i = period; i < data.length; i++) {
		const change = data[i].close - data[i - 1].close;

		if (change > 0) {
		(avgGain = ((avgGain * (period - 1)) + change) / period);
			avgLoss = (avgLoss * (period - 1)) / period;
		} else {
			avgGain = (avgGain * (period - 1)) / period;
			avgLoss = ((avgLoss * (period - 1)) + Math.abs(change)) / period;
		}

		if (avgLoss > 0) {
			const rs = avgGain / avgLoss;
			const rsi = 100 - (100 / (1 + rs));

			dates.push(data[i].date);
			values.push(rsi);
		}
	}

	return { symbol, dates, values, period };
}

/**
 * Signal Line for MACD (9-day EMA of MACD series)
 */
function calculateSignalLine(values: number[], period: number = 9): number[] {
	if (values.length < period) return [];

	const result: number[] = [];

	// Initial SMA
	const initialSum = values.slice(0, period).reduce((a, b) => a + b, 0);
	let ema = initialSum / period;
	result.push(ema);

	const multiplier = 2 / (period + 1);

	for (let i = period; i < values.length; i++) {
		ema = (values[i] - ema) * multiplier + ema;
		result.push(ema);
	}

	return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export async function calculateMACD(
	symbol: string,
	fastPeriod: number = 12,
	slowPeriod: number = 26,
	signalPeriod: number = 9,
): Promise<MACDResult> {
	const data = await getOHLCVHistory(symbol, slowPeriod * 2);

	if (data.length < slowPeriod * 2) {
		return { symbol, dates: [], macd: [], signal: [], histogram: [], fastPeriod, slowPeriod, signalPeriod };
	}

	// Calculate EMAs using helper (not recursive to avoid double-fetch)
	const fastEMA = await calculateEMA(symbol, fastPeriod);
	const slowEMA = await calculateEMA(symbol, slowPeriod);

	// MACD line = Fast EMA - Slow EMA
	const minLen = Math.min(fastEMA.values.length, slowEMA.values.length);

	const dates: string[] = [];
	const macd: number[] = [];

	for (let i = 0; i < minLen; i++) {
		macd.push(fastEMA.values[i] - slowEMA.values[i]);
		dates.push(fastEMA.dates[i]);
	}

	// Signal line = 9-day EMA of MACD
	const signal = calculateSignalLine(macd, signalPeriod);

	// Histogram = MACD - Signal
	const histogram: number[] = [];
	for (let i = 0; i < macd.length; i++) {
		histogram.push(macd[i] - signal[i]);
	}

	return { symbol, dates, macd, signal, histogram, fastPeriod, slowPeriod, signalPeriod };
}

/**
 * Bollinger Bands
 */
export async function calculateBollingerBands(
	symbol: string,
	period: number = 20,
	stdDev: number = 2,
): Promise<BollingerBandsResult> {
	const data = await getOHLCVHistory(symbol, period + stdDev);

	if (data.length < period) {
		return { symbol, dates: [], upper: [], middle: [], lower: [], period, stdDev };
	}

	const dates: string[] = [];
	const upper: number[] = [];
	const middle: number[] = [];
	const lower: number[] = [];

	for (let i = period - 1; i < data.length; i++) {
		const slice = data.slice(i - period + 1, i + 1);
		const closePrices = slice.map((d) => d.close);

		const mean = closePrices.reduce((a, b) => a + b, 0) / period;
		const variance = closePrices.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
		const stddev = Math.sqrt(variance);

		middle.push(mean);
		upper.push(mean + stdDev * stddev);
		lower.push(mean - stdDev * stddev);
		dates.push(data[i].date);
	}

	return { symbol, dates, upper, middle, lower, period, stdDev };
}

/**
 * Stochastic Oscillator (%K and %D)
 */
export async function calculateStochastic(
	symbol: string,
	period: number = 14,
	smoothPeriod: number = 3,
): Promise<StochasticResult> {
	const data = await getOHLCVHistory(symbol, period);

	if (data.length < period) {
		return { symbol, dates: [], k: [], d: [] };
	}

	const dates: string[] = [];
	const k: number[] = [];
	const d: number[] = [];

	// Raw %K calculation
	for (let i = period - 1; i < data.length; i++) {
		const slice = data.slice(i - period + 1, i + 1);
		const high = Math.max(...slice.map((s) => s.high));
		const low = Math.min(...slice.map((s) => s.low));
		const close = data[i].close;

		const rawK = ((close - low) / (high - low)) * 100;
		k.push(rawK);
		dates.push(data[i].date);
	}

	// Smoothed %D (3-day SMA of %K)
	if (k.length >= smoothPeriod) {
		for (let i = smoothPeriod - 1; i < k.length; i++) {
			const slice = k.slice(i - smoothPeriod + 1, i + 1);
			const smoothedK = slice.reduce((a, b) => a + b, 0) / smoothPeriod;
			d.push(smoothedK);
		}
		// Align arrays
		while (k.length !== d.length) {
			d.unshift(50); // Placeholder for early values
		}
	}

	return { symbol, dates, k, d };
}

/**
 * Price Momentum
 */
export async function calculateMomentum(
	symbol: string,
	period: number = 10,
): Promise<{ symbol: string; dates: string[]; values: number[] }> {
	const data = await getOHLCVHistory(symbol, period + 1);

	if (data.length < period + 1) {
		return { symbol, dates: [], values: [] };
	}

	const dates: string[] = [];
	const values: number[] = [];

	for (let i = period; i < data.length; i++) {
		const momentum = data[i].close - data[i - period].close;
		dates.push(data[i].date);
		values.push(momentum);
	}

	return { symbol, dates, values };
}

/**
 * Get all indicators for quick analysis
 */
export async function getAllTechnicalIndicators(symbol: string) {
	const [sma, ema, rsi, macd, bb, stochastic] = await Promise.all([
		calculateSMA(symbol, 20),
		calculateEMA(symbol, 20),
		calculateRSI(symbol, 14),
		calculateMACD(symbol),
		calculateBollingerBands(symbol),
		calculateStochastic(symbol),
	]);

	return {
		symbol,
		sma,
		ema,
		rsi,
		macd,
		bollingerBands: bb,
		stochastic,
		lastUpdated: new Date(),
	};
}
