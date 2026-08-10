# IdxAnalytics

A full-stack stock market intelligence platform for Indonesian investors. Track IDX stocks, build watchlists, get technical analysis, and receive price alerts.

## Overview

IdxAnalytics provides real-time market data from Yahoo Finance and the Indonesia Stock Exchange (IDX). Users can search stocks, track favorites in a personal watchlist, view detailed company fundamentals, set price alerts, and monitor dividend calendars.

The application uses Next.js 15 with Turbopack for fast builds, Drizzle ORM with Supabase Postgres for data storage, Better Auth for session management, and Inngest for background job orchestration.

## Key Features

- **Real-time Market Data**: Stock quotes, historical OHLCV data, company profiles, financial ratios from Yahoo Finance
- **Watchlist Management**: Track favorite stocks with automatic enrichment and status indicators
- **Stock Details**: Interactive charts via TradingView, technical indicators (RSI, MACD, Stochastic), financial metrics
- **Screener**: Filter stocks by valuation (P/E, P/B), profitability (ROE), dividends, and market cap
- **Price Alerts**: Email notifications when stocks hit target prices; configurable cooldown periods
- **Dividend Calendar**: Historical payout dates and amounts across IDX companies
- **User Profiles**: Investment preferences stored per account (goals, risk tolerance, industry interests)
- **Authentication**: Session-based email/password login with profile onboarding

## Tech Stack

**Frontend**
- Next.js 15.5.22 with App Router and Turbopack
- TypeScript with strict mode
- Tailwind CSS v4 with custom design tokens
- React Hook Form for form state management

**Backend**
- Server actions for data mutations
- Drizzle ORM with PostgreSQL (Supabase)
- Better Auth for authentication
- Inngest for scheduled jobs (email digests, alert checks)

**Data Sources**
- Yahoo Finance (.JK) for market data
- IDX emiten list for company metadata
- Finnhub for US stocks and additional quotes

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/aridepai17/idxanalytics.git
cd idxanalytics
pnpm install
```

Set up environment variables in `.env`:

```
DATABASE_URL=postgres://user:pass@host:5432/dbname
BETTER_AUTH_SECRET=generate_random_string
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EMAIL_FROM=noreply@example.com
INNGEST_EVENT_KEY=your_event_key
```

Run database migrations:

```bash
pnpx drizzle-kit migrate
```

Start the development server:

```bash
pnpm dev
```

Build for production:

```bash
unset NODE_ENV && rm -rf .next && pnpm build
```

Start the production server:

```bash
pnpm start -p 3000
```

## Project Structure

```
app/
  (auth)/              # Sign-in, sign-up routes
  (root)/              # Protected dashboard area
    settings/          # User profile and preferences
    screener/          # Stock screener with filters
    calendar/          # Dividend calendar view
    alerts/            # Price alert management
    watchlist/         # Personal stock tracking
    stocks/[symbol]/   # Individual stock detail pages
  api/                 # API routes (inngest, technical analysis)
  layout.tsx           # Root layout with providers
components/
  ui/                  # Reusable UI primitives
  settings/            # Profile settings tabs
  ScreenerTable.tsx    # Filterable stock table
  TechnicalAnalysisCard.tsx
  ...
lib/
  actions/             # Server actions (profile, watchlist, alerts)
  idx/                 # IDX data services (market, div, screener)
  better-auth/         # Auth configuration
  inngest/             # Background jobs
database/
  schema.ts            # Database schema definition
  migrations/          # SQL migration files
```

## Core Modules

### Authentication

Uses Better Auth with session cookies. Users sign up with email/password and complete an onboarding flow to specify investment preferences. Sessions are validated on each request via middleware that protects dashboard routes.

### Stock Discovery

Search functionality queries both local IDX emiten data and Finnhub for US equities. Results display symbol, company name, exchange type, and whether the stock exists in the user's watchlist.

### Watchlist

Stores selected stocks with market classification (IDX or US). The watchlist page enriches each entry with current price, daily change percentage, market cap, and P/E ratio using unified data fetching from Yahoo Finance.

### Technical Analysis

Calculates RSI, MACD, stochastic, and moving averages from historical OHLCV data. Falls back to Yahoo quoteSummary if local data is incomplete. Displays neutral/bullish/bearish signals based on indicator thresholds.

### Price Alerts

Users create alerts with threshold prices and direction (upper/lower). A cron job checks active alerts every 15 minutes against current prices. Triggered alerts disable temporarily (6-hour cooldown) before re-arming. Email notification uses nodemailer with template system.

### Screener

Filters stocks by fundamental metrics: maximum P/E and P/B, minimum ROE and dividend yield, sorting by market capitalization or any ratio column. Uses server-side aggregation to avoid N+1 queries across company profiles and financials.

### Dividend Calendar

Shows historical ex-dividend dates and amounts from Yahoo's chart events feed. Forward-looking announcements are not available through current data sources; the page displays recent payouts only.

## Database Schema

Core tables:
- `user` — Better Auth core with extended fields for investment profile
- `watchlist` — User-to-stock mappings with market classification
- `priceAlert` — Threshold configurations with cooldown state
- `idx_quotes` — Daily price snapshots
- `idx_dividends` — Historical payout events
- `idx_financial_ratios` — Fundamental metrics per reporting period

Migrations run via Drizzle Kit. Manual SQL applies column additions when schema evolution outpaces migrations.

## Deployment

Deploy to Vercel or similar platforms:

1. Set all environment variables in deployment settings
2. Run `drizzle-kit generate` and `drizzle-kit migrate` on first deploy
3. Configure proper CORS if using custom domains
4. Enable incremental static regeneration for static pages

For self-hosted setups, use Docker Compose with PostgreSQL as dependency. Ensure `NODE_ENV` remains unset during builds to prevent Next.js cache issues.

## Known Limitations

- IDX website (idx.co.id) blocks programmatic access via Cloudflare TLS fingerprinting; Yahoo Finance `.JK` endpoint used instead
- Upcoming dividend dates not available through current sources; only historical data shown
- No forward-looking earnings estimates or news beyond RSS feeds
- Limited US stock coverage compared to dedicated US platforms
