import { inngest } from "@/lib/inngest/client";
import {
	NEWS_SUMMARY_EMAIL_PROMPT,
	PERSONALIZED_WELCOME_EMAIL_PROMPT,
} from "@/lib/inngest/prompts";
import { sendNewsSummaryEmail, sendStockAlertEmail, sendWelcomeEmail } from "@/lib/nodemailer";
import { getAllUsersForNewsEmail } from "@/lib/actions/user.actions";
import { getWatchlistSymbolsForUser } from "@/lib/actions/watchlist.actions";
import { getTriggerableAlerts, markAlertTriggered } from "@/lib/actions/price-alert.actions";
import { getStockQuote } from "@/lib/market-unified";
import { getNews as getFinnhubNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { syncAllMarketData } from "@/lib/idx/sync-service";
import { getIdxNews } from "@/lib/idx/news";

/**
 * IDX Market Data Sync Cron Job
 * Runs daily at 9:00 AM WIB to sync the latest market data from IDX
 */
export const syncIDXMarketData = inngest.createFunction(
	{ id: "sync-idx-market-data" },
	{ cron: "0 9 * * *" }, // Every day at 9:00 AM WIB (UTC+7)
	async ({ step }) => {
		await step.run("sync-all-market-data", async () => {
			try {
				const result = await syncAllMarketData();
				return result;
			} catch (error) {
				console.error("[IDX-SYNC-CRON] Failed:", error);
				throw error;
			}
		});

		return { success: true, message: "IDX market data synced successfully" };
	},
);

/**
 * Welcome email for new users with AI-generated personalized intro
 */
export const sendSignUpEmail = inngest.createFunction(
	{ id: "sign-up-email" },
	{ event: "app/user.created" },
	async ({ event, step }) => {
		const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `;

		const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace(
			"{{userProfile}}",
			userProfile,
		);

		const response = await step.ai.infer("generate-welcome-intro", {
			model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
			body: {
				contents: [
					{
						role: "user",
						parts: [{ text: prompt }],
					},
				],
			},
		});

		await step.run("send-welcome-email", async () => {
			const part = response.candidates?.[0]?.content?.parts?.[0];
			const introText =
				(part && "text" in part ? part.text : null) ||
				"Thanks for joining IdxAnalytics. You now have the tools to track markets and make smarter moves.";

			const {
				data: { email, name },
			} = event;

			return await sendWelcomeEmail({ email, name, intro: introText });
		});

		return {
			success: true,
			message: "Welcome email sent successfully",
		};
	},
);

/**
 * Fan-out: the daily cron only enumerates recipients and emits one event per
 * user. Each user's summary then runs as its own function invocation, so a slow
 * LLM call or a large user base can't time out a monolithic run.
 */
export const sendDailyNewsSummary = inngest.createFunction(
	{ id: "daily-news-summary" },
	[{ event: "app/send.daily.news" }, { cron: "0 12 * * *" }],
	async ({ step }) => {
		const users = await step.run("get-all-users", getAllUsersForNewsEmail);

		if (!users || users.length === 0)
			return { success: false, message: "No users found for news email" };

		await step.sendEvent(
			"fan-out-user-news",
			users.map((user) => ({
				name: "app/send.user.news" as const,
				data: { userId: user.id, email: user.email, name: user.name },
			})),
		);

		return { success: true, message: `Queued ${users.length} news emails` };
	},
);

export const sendUserNewsSummary = inngest.createFunction(
	{ id: "user-news-summary", concurrency: { limit: 5 }, retries: 2 },
	{ event: "app/send.user.news" },
	async ({ event, step }) => {
		const { userId, email } = event.data as { userId: string; email: string };

		const articles = await step.run("fetch-user-news", async () => {
			// Fetch IDX RSS news and Finnhub watchlist news in parallel.
			const symbolsWithMarket = await getWatchlistSymbolsForUser(userId);
			const symbols = symbolsWithMarket.map((s) => s.symbol);

			const [idxNews, watchlistNews, generalNews] = await Promise.all([
				getIdxNews(8).then((r) =>
					r.map((n) => ({ title: n.title, source: n.source, url: n.url })),
				),
				symbols.length > 0 ? getFinnhubNews(symbols) : Promise.resolve([]),
				getFinnhubNews(),
			]);

			// Merge: IDX first (local relevance), then watchlist-specific, then general.
			const seen = new Set<string>();
			const merged: {
				title: string;
				source: string;
				url?: string;
			}[] = [];

			type ArticleKeyed = { title: string; source?: string; url?: string };
			for (const a of [...idxNews, ...watchlistNews, ...generalNews] as unknown as ArticleKeyed[]) {
				if (!a.title) continue;
				const key = a.title.toLowerCase().slice(0, 80);
				if (seen.has(key)) continue;
				seen.add(key);
				merged.push({
					title: a.title,
					source: a.source ?? "Finnhub",
					url: a.url,
				});
			}

			return merged.slice(0, 10);
		});

		const response = await step.ai.infer("summarize-news", {
			model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
			body: {
				contents: [
					{
						role: "user",
						parts: [
							{
								text: NEWS_SUMMARY_EMAIL_PROMPT.replace(
									"{{newsData}}",
									JSON.stringify(articles, null, 2),
								),
							},
						],
					},
				],
			},
		});

		await step.run("send-news-email", async () => {
			const part = response.candidates?.[0]?.content?.parts?.[0];
			const newsContent =
				(part && "text" in part ? part.text : null) || "No market news.";

			await sendNewsSummaryEmail({
				email,
				date: getFormattedTodayDate(),
				newsContent,
			});
		});

		return { success: true };
	},
);

/**
 * Price alert sweep. Runs every 15 minutes; one Inngest step per alert would
 * be wasteful, so quotes are fetched inside a single step and de-duplicated by
 * symbol (many users can watch the same ticker).
 *
 * ponytail: fixed 15-min cadence and a 6-hour re-arm window instead of
 * per-alert scheduling; add user-configurable cadence when someone asks.
 */
export const checkPriceAlerts = inngest.createFunction(
	{ id: "check-price-alerts", retries: 1 },
	{ cron: "*/15 * * * *" },
	async ({ step }) => {
		const alerts = await step.run("load-active-alerts", () => getTriggerableAlerts());
		if (alerts.length === 0) return { checked: 0, triggered: 0 };

		const triggered = await step.run("evaluate-and-notify", async () => {
			const prices = new Map<string, number>();
			const fired: string[] = [];

			for (const alert of alerts) {
				if (!prices.has(alert.symbol)) {
					const quote = await getStockQuote(alert.symbol);
					prices.set(alert.symbol, quote?.price ?? 0);
				}
				const price = prices.get(alert.symbol) ?? 0;
				if (price <= 0) continue;

				const hit =
					alert.alertType === "upper"
						? price >= alert.threshold
						: price <= alert.threshold;
				if (!hit) continue;

				await sendStockAlertEmail({
					email: alert.email,
					symbol: alert.symbol,
					company: alert.company,
					alertType: alert.alertType === "upper" ? "upper" : "lower",
					currentPrice: price,
					targetPrice: alert.threshold,
					currency: alert.market === "IDX" ? "Rp" : "$",
				});

				await markAlertTriggered(alert.id);
				fired.push(alert.symbol);
			}

			return fired;
		});

		return { checked: alerts.length, triggered: triggered.length };
	},
);
