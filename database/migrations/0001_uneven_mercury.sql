CREATE TABLE "idx_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text,
	"url" text,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_company_profiles" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector" text,
	"industry" text,
	"sub_industry" text,
	"listed_date" text,
	"shares_outstanding" double precision,
	"market_cap" double precision,
	"fiscal_year_end" text,
	"website" text,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_daily_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" text NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"frequency" integer DEFAULT 0 NOT NULL,
	"foreign_net_buy" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_dividends" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"announcement_date" text NOT NULL,
	"ex_dividend_date" text NOT NULL,
	"record_date" text,
	"payment_date" text,
	"amount" double precision NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_financial_ratios" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"report_date" text NOT NULL,
	"period" text,
	"pe_ratio" double precision,
	"pbv_ratio" double precision,
	"ps_ratio" double precision,
	"roe" double precision,
	"roa" double precision,
	"gross_margin" double precision,
	"operating_margin" double precision,
	"net_margin" double precision,
	"der" double precision,
	"rer" double precision,
	"total_debt" double precision,
	"equity" double precision,
	"eps" double precision,
	"book_value_per_share" double precision,
	"dividend_per_share" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_market_indices" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"value" double precision NOT NULL,
	"change" double precision,
	"change_percent" double precision,
	"volume" integer DEFAULT 0 NOT NULL,
	"frequency" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idx_stock_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"announcement_date" text NOT NULL,
	"ex_date" text NOT NULL,
	"record_date" text,
	"payment_date" text,
	"ratio" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "watchlist_user_symbol_idx";--> statement-breakpoint
ALTER TABLE "price_alert" ADD COLUMN "market" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist" ADD COLUMN "market" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_announcement_symbol_idx" ON "idx_announcements" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_announcement_date_idx" ON "idx_announcements" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_company_sector_idx" ON "idx_company_profiles" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_company_industry_idx" ON "idx_company_profiles" USING btree ("industry");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_quotes_unique" ON "idx_daily_quotes" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_daily_quote_date_idx" ON "idx_daily_quotes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_dividend_symbol_idx" ON "idx_dividends" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_dividend_ex_date_idx" ON "idx_dividends" USING btree ("ex_dividend_date");--> statement-breakpoint
CREATE INDEX "idx_financial_symbol_date_idx" ON "idx_financial_ratios" USING btree ("symbol","report_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_indices_unique" ON "idx_market_indices" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_indices_date_idx" ON "idx_market_indices" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_split_symbol_idx" ON "idx_stock_splits" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_symbol_idx" ON "watchlist" USING btree ("user_id","symbol","market");