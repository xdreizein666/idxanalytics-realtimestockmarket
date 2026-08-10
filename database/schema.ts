import { pgTable, text, timestamp, boolean, numeric, uniqueIndex, index, integer, doublePrecision } from "drizzle-orm/pg-core";

/**
 * Better Auth core tables.
 * Column + table names follow Better Auth's default snake_case mapping so the
 * drizzle adapter can resolve them without a custom schema map.
 * Source: https://www.better-auth.com/docs/concepts/database#core-schema
 */
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

	// additionalFields — the investment profile collected at sign-up.
	// Source: https://www.better-auth.com/docs/concepts/database#extending-core-schema
	country: text("country"),
	investmentGoals: text("investment_goals"),
	riskTolerance: text("risk_tolerance"),
	preferredIndustry: text("preferred_industry"),
	newsEmailOptIn: boolean("news_email_opt_in").notNull().default(true),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Application tables. */
export const watchlist = pgTable(
	"watchlist",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		symbol: text("symbol").notNull(),
		market: text("market").notNull().default("US"), // 'US' | 'IDX'
		company: text("company").notNull(),
		addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("watchlist_user_symbol_idx").on(t.userId, t.symbol, t.market)],
);

export const priceAlert = pgTable(
	"price_alert",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		symbol: text("symbol").notNull(),
		market: text("market").notNull().default("US"), // 'US' | 'IDX'
		company: text("company").notNull(),
		alertName: text("alert_name").notNull(),
		// "upper" fires when price rises above threshold, "lower" when it falls below.
		alertType: text("alert_type").notNull(),
		threshold: numeric("threshold", { precision: 18, scale: 4 }).notNull(),
		isActive: boolean("is_active").notNull().default(true),
		lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("price_alert_user_idx").on(t.userId)],
);

// ============================================================================
// IDX-specific Data Tables
// ============================================================================

/**
 * Company profiles for Indonesian stocks
 */
export const idxCompanyProfiles = pgTable(
	"idx_company_profiles",
	{
		symbol: text("symbol").primaryKey(),
		name: text("name").notNull(),
		sector: text("sector"),           // Sektor utama
		industry: text("industry"),       // Industri spesifik
		subIndustry: text("sub_industry"), // Sub-sektor
		listedDate: text("listed_date"),   // Tanggal listing
		sharesOutstanding: doublePrecision("shares_outstanding"), // Jumlah saham beredar
		marketCap: doublePrecision("market_cap"), // Market cap (IDR)
		fiscalYearEnd: text("fiscal_year_end"), // Akhir tahun fiskal
		website: text("website"),
		description: text("description"),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_company_sector_idx").on(t.sector), index("idx_company_industry_idx").on(t.industry)]
);

/**
 * Daily stock quotes and OHLCV data for Indonesian stocks
 */
export const idxDailyQuotes = pgTable(
	"idx_daily_quotes",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		date: text("date").notNull(),       // YYYYMMDD format or ISO date
		open: doublePrecision("open").notNull(),
		high: doublePrecision("high").notNull(),
		low: doublePrecision("low").notNull(),
		close: doublePrecision("close").notNull(),
		volume: integer("volume").notNull().default(0),
		value: doublePrecision("value").notNull().default(0),
		frequency: integer("frequency").notNull().default(0),
		foreignNetBuy: doublePrecision("foreign_net_buy").notNull().default(0),
	},
	(t) => [
		uniqueIndex("idx_daily_quotes_unique").on(t.symbol, t.date),
		index("idx_daily_quote_date_idx").on(t.date),
	]
);

/**
 * Financial ratios and fundamental metrics for Indonesian stocks
 */
export const idxFinancialRatios = pgTable(
	"idx_financial_ratios",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		reportDate: text("report_date").notNull(), // Laporan keuangan tanggal
		period: text("period"),                   // e.g., "2024-Q3"
		
		// Valuation ratios
		peRatio: doublePrecision("pe_ratio"),     // Price to Earnings Ratio
		pbvRatio: doublePrecision("pbv_ratio"),   // Price to Book Value
		psRatio: doublePrecision("ps_ratio"),     // Price to Sales Ratio
		
		// Profitability ratios
		roe: doublePrecision("roe"),              // Return on Equity (%)
		roa: doublePrecision("roa"),              // Return on Assets (%)
		grossMargin: doublePrecision("gross_margin"),
		operatingMargin: doublePrecision("operating_margin"),
		netMargin: doublePrecision("net_margin"),
		
		// Leverage ratios
		der: doublePrecision("der"),              // Debt to Equity Ratio
		rer: doublePrecision("rer"),
		totalDebt: doublePrecision("total_debt"),
		equity: doublePrecision("equity"),
		
		// Per share data
		eps: doublePrecision("eps"),              // Earning Per Share
	 bookValuePerShare: doublePrecision("book_value_per_share"),
		dividendPerShare: doublePrecision("dividend_per_share"),
		dividendYield: doublePrecision("dividend_yield"), // Percent, e.g. 5.61
		
		// Metadata
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_financial_symbol_date_idx").on(t.symbol, t.reportDate),
	]
);

/**
 * Dividend history for Indonesian stocks
 */
export const idxDividends = pgTable(
	"idx_dividends",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		announcementDate: text("announcement_date").notNull(),
		exDividendDate: text("ex_dividend_date").notNull(),
		recordDate: text("record_date"),
		paymentDate: text("payment_date"),
		amount: doublePrecision("amount").notNull(), // Dividen per saham
		type: text("type").notNull(), // 'CASH' | 'STOCK'
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_dividend_symbol_idx").on(t.symbol),
		index("idx_dividend_ex_date_idx").on(t.exDividendDate),
	]
);

/**
 * Stock split history for Indonesian stocks
 */
export const idxStockSplits = pgTable(
	"idx_stock_splits",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		announcementDate: text("announcement_date").notNull(),
		exDate: text("ex_date").notNull(),
		recordDate: text("record_date"),
		paymentDate: text("payment_date"),
		ratio: text("ratio").notNull(), // e.g., "1:5", "1:10"
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_split_symbol_idx").on(t.symbol)]
);

/**
 * Corporate announcements for Indonesian stocks
 */
export const idxAnnouncements = pgTable(
	"idx_announcements",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(),
		title: text("title").notNull(),
		category: text("category").notNull(), // 'REGULATORY' | 'FINANCIAL' | 'CORPORATE_ACTION' | 'OTHER'
		content: text("content"),
		url: text("url"),
		publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_announcement_symbol_idx").on(t.symbol),
		index("idx_announcement_date_idx").on(t.publishedAt),
	]
);

/**
 * Market indices tracking (IHSG, LQ45, etc.)
 */
export const idxMarketIndices = pgTable(
	"idx_market_indices",
	{
		id: text("id").primaryKey(),
		symbol: text("symbol").notNull(), // e.g., IHSG, LQ45
		name: text("name").notNull(),
		date: text("date").notNull(),
		value: doublePrecision("value").notNull(),
		change: doublePrecision("change"),
		changePercent: doublePrecision("change_percent"),
		volume: integer("volume").notNull().default(0),
		frequency: integer("frequency").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("idx_indices_unique").on(t.symbol, t.date),
		index("idx_indices_date_idx").on(t.date),
	]
);

// Type exports
export type WatchlistRow = typeof watchlist.$inferSelect;
export type PriceAlertRow = typeof priceAlert.$inferSelect;
export type UserRow = typeof user.$inferSelect;

// IDX-specific types
export type IDXCompanyProfileRow = typeof idxCompanyProfiles.$inferSelect;
export type IDxDailyQuoteRow = typeof idxDailyQuotes.$inferSelect;
export type IDXFinancialRatioRow = typeof idxFinancialRatios.$inferSelect;
export type IDXDividendRow = typeof idxDividends.$inferSelect;
export type IDXStockSplitRow = typeof idxStockSplits.$inferSelect;
export type IDXAnnouncementRow = typeof idxAnnouncements.$inferSelect;
export type IDXMarketIndexRow = typeof idxMarketIndices.$inferSelect;
