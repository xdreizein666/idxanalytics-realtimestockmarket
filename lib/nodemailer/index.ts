import nodemailer from "nodemailer";
import {
	WELCOME_EMAIL_TEMPLATE,
	NEWS_SUMMARY_EMAIL_TEMPLATE,
	STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
	STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://idxanalytics.app";
const UNSUBSCRIBE_URL = `${BASE_URL}/unsubscribe`;
/**
 * The From address must belong to the SMTP domain, otherwise SPF/DKIM fail and
 * mail lands in spam. Both are configured together via env.
 */
const EMAIL_FROM = process.env.EMAIL_FROM || "IdxAnalytics <no-reply@localhost>";

export const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT ?? 587),
	secure: Number(process.env.SMTP_PORT ?? 587) === 465,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD,
	},
});

/**
 * The news body is LLM-generated from third-party article text, so it is treated
 * as untrusted: only a small formatting subset survives, and no links/attributes.
 */
function sanitizeEmailHtml(html: string): string {
	return html
		.replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
		.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "")
		.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/\shref\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "");
}

export const sendWelcomeEmail = async ({
	email,
	name,
	intro,
}: WelcomeEmailData) => {
	const htmlTemplate = WELCOME_EMAIL_TEMPLATE.replace("{{name}}", name)
		.replace("{{intro}}", sanitizeEmailHtml(intro))
		.replaceAll("{{baseUrl}}", BASE_URL)
		.replaceAll("{{unsubscribeUrl}}", UNSUBSCRIBE_URL);

	await transporter.sendMail({
		from: EMAIL_FROM,
		to: email,
		subject: `Welcome to IdxAnalytics - your stock toolkit is ready!`,
		text: "Thanks for joining IdxAnalytics",
		html: htmlTemplate,
	});
};

export const sendNewsSummaryEmail = async ({
	email,
	date,
	newsContent,
}: {
	email: string;
	date: string;
	newsContent: string;
}): Promise<void> => {
	const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE.replace("{{date}}", date)
		.replace("{{newsContent}}", sanitizeEmailHtml(newsContent))
		.replaceAll("{{baseUrl}}", BASE_URL)
		.replaceAll("{{unsubscribeUrl}}", UNSUBSCRIBE_URL);

	await transporter.sendMail({
		from: EMAIL_FROM,
		to: email,
		subject: `Market News Summary Today - ${date}`,
		text: `Today's market news summary from IdxAnalytics`,
		html: htmlTemplate,
		headers: {
			"List-Unsubscribe": `<${UNSUBSCRIBE_URL}?email=${encodeURIComponent(email)}>`,
		},
	});
};

/**
 * Price alert notification. Values are numbers formatted server-side, so no
 * untrusted HTML enters the template — only the template's own markup ships.
 */
export const sendStockAlertEmail = async ({
	email,
	symbol,
	company,
	alertType,
	currentPrice,
	targetPrice,
	currency = "Rp",
}: {
	email: string;
	symbol: string;
	company: string;
	alertType: "upper" | "lower";
	currentPrice: number;
	targetPrice: number;
	currency?: string;
}): Promise<void> => {
	const template =
		alertType === "upper"
			? STOCK_ALERT_UPPER_EMAIL_TEMPLATE
			: STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

	const fmt = (n: number) => `${currency} ${n.toLocaleString("id-ID")}`;

	const htmlTemplate = template
		.replaceAll("{{symbol}}", symbol)
		.replaceAll("{{company}}", company)
		.replaceAll("{{currentPrice}}", fmt(currentPrice))
		.replaceAll("{{targetPrice}}", fmt(targetPrice))
		.replaceAll("{{timestamp}}", new Date().toLocaleString("id-ID"))
		.replaceAll("{{baseUrl}}", BASE_URL)
		.replaceAll("{{unsubscribeUrl}}", UNSUBSCRIBE_URL);

	await transporter.sendMail({
		from: EMAIL_FROM,
		to: email,
		subject: `${symbol} ${alertType === "upper" ? "naik ke" : "turun ke"} ${fmt(currentPrice)}`,
		text: `${symbol} kini ${fmt(currentPrice)} (target ${fmt(targetPrice)})`,
		html: htmlTemplate,
		headers: {
			"List-Unsubscribe": `<${UNSUBSCRIBE_URL}?email=${encodeURIComponent(email)}>`,
		},
	});
};
