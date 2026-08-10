/**
 * IDX API Integration Layer
 * 
 * This module provides comprehensive access to Indonesian Stock Exchange (IDX) data:
 * - Real-time market quotes and trading data
 * - Company profiles and fundamental financial ratios
 * - Corporate actions (dividends, stock splits, announcements)
 * - Market indices and statistics
 * 
 * Built as a robust wrapper around official IDX APIs with retry logic, caching,
 * and session management for reliable data access.
 */

export { idxMarketService } from "./market-service";
export type { 
  StockQuote,
  MarketIndex,
  TopGainer,
  TopLoser,
  DailyOHLC,
  TradeSummary,
  BrokerSummary,
} from "./types";

export { idxCompanyService } from "./company-service";
export type { 
  CompanyProfile,
  FinancialRatio,
  StockSplit,
  Dividend,
  CorporateAnnouncement,
} from "./types";

// Re-export all types
export * from "./types";
