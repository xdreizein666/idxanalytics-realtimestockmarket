/**
 * Type definitions for IDX (Indonesian Stock Exchange) data
 * Based on idx-api wrapper from NeaByteLab
 */

// ============================================================================
// Market Data Types
// ============================================================================

export interface StockQuote {
  symbol: string;           // Kode saham (e.g., "BBCA", "TLKM")
  company: string;          // Nama perusahaan
  price: number;            // Harga terakhir
  change: number;           // Perubahan harga
  changePercent: number;    // Persentase perubahan
  volume: number;           // Volume perdagangan
  value: number;            // Value perdagangan (IDR)
  frequency: number;        // Frekuensi transaksi
  open: number;             // Harga buka
  high: number;             // Harga tertinggi
  low: number;              // Harga terendah
  previousClose: number;    // Harga penutupan sebelumnya
  listedShares: number;     // Jumlah saham tercatat (untuk market cap)
  foreignNetBuy: number;    // ForeignBuy - ForeignSell (lembar)
  tradingDate: string;      // Tanggal sesi perdagangan (YYYY-MM-DD)
  timestamp: Date;          // Timestamp data
}

export interface MarketIndex {
  symbol: string;           // Kode indeks (e.g., "IHSG", "LQ45")
  name: string;             // Nama indeks
  value: number;            // Nilai indeks
  change: number;           // Perubahan
  changePercent: number;    // Persentase perubahan
  volume: number;           // Volume
  timestamp: Date;
}

export interface TopGainer {
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
  volume: number;
}

export interface TopLoser {
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
  volume: number;
}

// ============================================================================
// Financial & Fundamental Data Types
// ============================================================================

export interface CompanyProfile {
  symbol: string;
  name: string;
  industry: string;         // Sektor industri
  sector: string;           // Sector
  subIndustry: string;      // Sub-sektor
  listedDate: string;       // Tanggal listing (IPO)
  /**
   * Not returned by /primary/ListedCompany/GetCompanyProfiles. Shares come from
   * the trading summary (ListedShares) and market cap is derived from it, so
   * these stay optional rather than forcing callers to invent zeroes.
   */
  sharesOutstanding?: number; // Jumlah lembar saham beredar
  marketCap?: number;        // Market cap (IDR)
  fiscalYearEnd?: string;    // Akhir tahun fiskal
  listingBoard?: string;     // Papan pencatatan (Utama / Pengembangan)
  website?: string;
  description?: string;
}

export interface FinancialRatio {
  symbol: string;
  reportDate: string;       // Tanggal laporan keuangan
  period: string;           // Periode (e.g., "2024-Q3")
  
  // Valuation ratios
  peRatio: number | null;   // Price to Earnings Ratio
  pbvRatio: number | null;  // Price to Book Value
  psRatio: number | null;   // Price to Sales Ratio
  ppcRatio: number | null;  // Price to Price Book
  
  // Profitability ratios
  roe: number | null;       // Return on Equity (%)
  roa: number | null;       // Return on Assets (%)
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  
  // Leverage ratios
  der: number | null;       // Debt to Equity Ratio
  rer: number | null;       // Revenue per Equity Ratio
  totalDebt: number | null;
  equity: number | null;
  
  // Efficiency ratios
  totalAssetTurnover: number | null;
  inventoryTurnover: number | null;
  
  // Per share data
  eps: number | null;       // Earning Per Share
  bookValuePerShare: number | null;
  dividendPerShare: number | null;
  dpsRatio: number | null;  // Dividend Payout Ratio
  
  updatedAt: Date;
}

export interface StockSplit {
  symbol: string;
  announcementDate: string;
  exDate: string;
  recordDate: string;
  paymentDate: string;
  splitRatio: string;       // e.g., "1:5" (1 saham lama = 5 saham baru)
  description: string;
}

export interface Dividend {
  symbol: string;
  announcementDate: string;
  exDividendDate: string;
  recordDate: string;
  paymentDate: string;
  dividendAmount: number;   // Jumlah dividen per saham
  dividendType: "cash" | "stock";
  description: string;
}

// ============================================================================
// Trading Data Types
// ============================================================================

export interface TradeSummary {
  date: string;
  totalBuyVolume: number;
  totalSellVolume: number;
  totalBuyValue: number;
  totalSellValue: number;
  averagePrice: number;
  frequency: number;
  foreignNetBuy: number;    // Net buying asing (IDR)
  foreignBuyVolume: number;
  foreignSellVolume: number;
}

export interface DailyOHLC {
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  value: number;
  frequency: number;
  foreignNetBuy: number;
}

export interface BrokerSummary {
  date: string;
  brokerCode: string;       // Kode broker (e.g., "MLPL", "ARMM")
  brokerName: string;
  buyVolume: number;
  sellVolume: number;
  buyValue: number;
  sellValue: number;
  percentage: number;       // Market share %
}

// ============================================================================
// Announcement & Corporate Action Types
// ============================================================================

export interface CorporateAnnouncement {
  id: string;
  symbol: string;
  title: string;
  category: string;         // e.g., "Regulatory", "Financial", "Corporate Action"
  publishedAt: Date;
  url: string;
  description?: string;
}

export interface NewListing {
  symbol: string;
  companyName: string;
  listingDate: string;
  offerPrice: number;
  sharesOffered: number;
  underwriter: string;      // Underwriter/issuer
}

export interface Delisting {
  symbol: string;
  companyName: string;
  delistingDate: string;
  reason: string;
}

// ============================================================================
// Market Calendar Types
// ============================================================================

export interface MarketHoliday {
  date: string;
  name: string;             // Nama hari libur
  type: "market" | "half-day";  // Full or half trading day
}

// ============================================================================
// Search Result Type
// ============================================================================

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: "IDX" | "US" | "OTHER";
  type: "Stock" | "Fund" | "REIT" | "Warrant";
  isin?: string;            // International Securities Identification Number
}
