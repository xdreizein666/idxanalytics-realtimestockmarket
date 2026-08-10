/**
 * IDX Company & Financial Data Service
 * Provides company profiles, financial ratios, and fundamental data
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { IDXClient } from "./client";
import type {
  CompanyProfile,
  FinancialRatio,
  StockSplit,
  Dividend,
  CorporateAnnouncement,
} from "./types";

export class IDXCompanyService extends IDXClient {
  /**
   * Get detailed company profile information
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    try {
      await this.ensureSession();
      const cleanSymbol = symbol.toUpperCase().trim();

      const response = await this.fetchJSON<unknown>(
        `https://www.idx.co.id/api/primary/company/profile/${cleanSymbol}`,
        600 // Cache for 10 minutes
      );

      if (!(response as any)?.data || (response as any).data.length === 0) {
        return null;
      }

      const rawData = (response as any).data;
      const raw = rawData[0];
      
      return {
        symbol: cleanSymbol,
        name: raw.nm || "",
        industry: raw.inD || "",
        sector: raw.sct || "",
        subIndustry: raw.subIn || "",
        listedDate: raw.lstDt || "",
        sharesOutstanding: Number(raw.shrOut) || 0,
        marketCap: Number(raw.mktCap) || 0,
        fiscalYearEnd: raw.fye || "",
        website: raw.wbs || undefined,
        description: raw.desc || undefined,
      };
    } catch (error) {
      console.error("[IDX] Error fetching company profile:", error);
      return null;
    }
  }

  /**
   * Get financial ratios and fundamental metrics
   */
  async getFinancialRatios(
    symbol: string,
    period?: string
  ): Promise<FinancialRatio[]> {
    try {
      await this.ensureSession();
      const cleanSymbol = symbol.toUpperCase().trim();

      const queryParams = period 
        ? `?period=${period}` 
        : "";

      const response = await this.fetchJSON<unknown>(
        `https://www.idx.co.id/api/primary/company/financials/${cleanSymbol}${queryParams}`,
        3600 // Cache for 1 hour
      );

      if (!(response as any).data) return [];

      return (response as any).data.map((raw: any): FinancialRatio => ({
        symbol: cleanSymbol,
        reportDate: raw.rptDt || "",
        period: raw.period || "",
        
        // Valuation ratios
        peRatio: Number(raw.pe) || null,
        pbvRatio: Number(raw.pbv) || null,
        psRatio: Number(raw.ps) || null,
        ppcRatio: Number(raw.ppc) || null,
        
        // Profitability ratios
        roe: Number(raw.roe) || null,
        roa: Number(raw.roa) || null,
        grossMargin: Number(raw.gm) || null,
        operatingMargin: Number(raw.om) || null,
        netMargin: Number(raw.nm) || null,
        
        // Leverage ratios
        der: Number(raw.der) || null,
        rer: Number(raw.rer) || null,
        totalDebt: Number(raw.totalDebt) || null,
        equity: Number(raw.equity) || null,
        
        // Efficiency ratios
        totalAssetTurnover: Number(raw.tat) || null,
        inventoryTurnover: Number(raw.it) || null,
        
        // Per share data
        eps: Number(raw.eps) || null,
        bookValuePerShare: Number(raw.bps) || null,
        dividendPerShare: Number(raw.dps) || null,
        dpsRatio: Number(raw.dpr) || null,
        
        updatedAt: new Date(),
      })).sort((a: FinancialRatio, b: FinancialRatio) => 
        new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
      );
    } catch (error) {
      console.error("[IDX] Error fetching financial ratios:", error);
      return [];
    }
  }

  /**
   * Get latest financial ratio for a stock
   */
  async getLatestFinancialRatio(
    symbol: string
  ): Promise<FinancialRatio | null> {
    const ratios = await this.getFinancialRatios(symbol);
    return ratios.length > 0 ? ratios[0] : null;
  }

  /**
   * Get stock split history
   */
  async getStockSplits(symbol: string): Promise<StockSplit[]> {
    try {
      await this.ensureSession();
      const cleanSymbol = symbol.toUpperCase().trim();

      const response = await this.fetchJSON<unknown>(
        `https://www.idx.co.id/api/primary/company/split/${cleanSymbol}`,
        86400 // Cache for 24 hours
      );

      if (!(response as any).data) return [];

      return (response as any).data.map((raw: any): StockSplit => ({
        symbol: cleanSymbol,
        announcementDate: raw.annDt || "",
        exDate: raw.exDt || "",
        recordDate: raw.recDt || "",
        paymentDate: raw.payDt || "",
        splitRatio: raw.ratio || "",
        description: raw.desc || "",
      }));
    } catch (error) {
      console.error("[IDX] Error fetching stock splits:", error);
      return [];
    }
  }

  /**
   * Get dividend history
   */
  async getDividends(symbol: string): Promise<Dividend[]> {
    try {
      await this.ensureSession();
      const cleanSymbol = symbol.toUpperCase().trim();

      const response = await this.fetchJSON<unknown>(
        `https://www.idx.co.id/api/primary/company/dividend/${cleanSymbol}`,
        86400 // Cache for 24 hours
      );

      if (!(response as any).data) return [];

      return (response as any).data.map((raw: any): Dividend => ({
        symbol: cleanSymbol,
        announcementDate: raw.annDt || "",
        exDividendDate: raw.exDt || "",
        recordDate: raw.recDt || "",
        paymentDate: raw.payDt || "",
        dividendAmount: Number(raw.amt) || 0,
        dividendType: (raw.typ === "STOCK" ? "stock" : "cash") as "cash" | "stock",
        description: raw.desc || "",
      })).sort((a: any, b: any) =>
        new Date(b.announcementDate).getTime() - new Date(a.announcementDate).getTime()
      );
    } catch (error) {
      console.error("[IDX] Error fetching dividends:", error);
      return [];
    }
  }

  /**
   * Get corporate announcements
   */
  async getAnnouncements(
    symbol?: string,
    limit: number = 50
  ): Promise<CorporateAnnouncement[]> {
    try {
      await this.ensureSession();
      const endpoint = symbol
        ? `https://www.idx.co.id/api/primary/company/announcement/${symbol.toUpperCase()}`
        : "https://www.idx.co.id/api/primary/company/announcement/all";

      const response = await this.fetchJSON<unknown>(endpoint, 300);

      if (!(response as any).data) return [];

      return (response as any).data.slice(0, limit).map((raw: any): CorporateAnnouncement => ({
        id: raw.id || "",
        symbol: raw.cd || "",
        title: raw.ttl || "",
        category: raw.cat || "General",
        publishedAt: new Date(raw.pubDt || Date.now()),
        url: raw.url || "",
        description: raw.desc || undefined,
      })).sort((a: any, b: any) =>
        b.publishedAt.getTime() - a.publishedAt.getTime()
      );
    } catch (error) {
      console.error("[IDX] Error fetching announcements:", error);
      return [];
    }
  }

  /**
   * Search for companies by keyword
   */
  async searchCompanies(query: string): Promise<Array<{
    symbol: string;
    name: string;
    sector: string;
    industry: string;
  }>> {
    try {
      await this.ensureSession();
      const searchQuery = query.trim();

      const response = await this.fetchJSON<unknown>(
        `https://www.idx.co.id/api/primary/company/search?q=${encodeURIComponent(searchQuery)}`
      );

      if (!(response as any).data) return [];

      const results: Array<{ symbol: string; name: string; sector: string; industry: string }> = (response as any).data.map((raw: any) => ({
        symbol: raw.cd || "",
        name: raw.nm || "",
        sector: raw.sct || "",
        industry: raw.inD || "",
      }));
      
      return results.filter(s => s.symbol.length > 0);
    } catch (error) {
      console.error("[IDX] Error searching companies:", error);
      return [];
    }
  }
}

// Export singleton instance
export const idxCompanyService = new IDXCompanyService();
