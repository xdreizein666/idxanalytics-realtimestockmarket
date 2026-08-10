/**
 * IDX market news aggregated from Indonesian financial RSS feeds.
 *
 * These publishers have no public JSON API, but they do serve stable RSS.
 * Feeds verified reachable (HTTP 200, non-empty <item> list) at time of writing:
 *   - CNBC Indonesia / Market  — market, saham, reksadana desk
 *   - Kontan / Investasi       — pasar modal desk
 *   - Detik Finance            — general finance desk
 * Sources deliberately excluded: bisnis.com and idnfinancials.com return 403 to
 * server-side fetches (Cloudflare), investor.id and pasardana.id return 404.
 */

export interface IdxNewsArticle {
	id: string;
	title: string;
	url: string;
	source: string;
	publishedAt: string; // ISO
	summary: string;
	image?: string;
}

const FEEDS = [
	{ source: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/market/rss" },
	{ source: "Kontan", url: "https://investasi.kontan.co.id/rss" },
	{ source: "Detik Finance", url: "https://finance.detik.com/rss" },
] as const;

const ALLOWED_HOSTS = new Set(
	FEEDS.map((f) => new URL(f.url).hostname),
);

/** Strip CDATA wrapper and decode the handful of entities RSS actually uses. */
function decode(raw: string): string {
	return raw
		.replace(/^\s*<!\[CDATA\[/, "")
		.replace(/\]\]>\s*$/, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

function tag(item: string, name: string): string {
	const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
	return m ? decode(m[1]) : "";
}

/** Only accept http(s) image URLs — never data:/javascript: from an untrusted feed. */
function safeImage(item: string): string | undefined {
	const enclosure = item.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1];
	const inline = item.match(/<img[^>]*src="([^"]+)"/i)?.[1];
	const candidate = enclosure || inline;
	if (!candidate) return undefined;
	const url = decode(candidate);
	return /^https?:\/\//i.test(url) ? url : undefined;
}

function parseFeed(xml: string, source: string): IdxNewsArticle[] {
	const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
	const articles: IdxNewsArticle[] = [];

	for (const item of items) {
		const title = tag(item, "title");
		const link = tag(item, "link") || tag(item, "guid");
		if (!title || !/^https?:\/\//i.test(link)) continue;

		const published = new Date(tag(item, "pubDate"));
		articles.push({
			id: link,
			title,
			url: link,
			source,
			publishedAt: (Number.isNaN(published.getTime()) ? new Date() : published).toISOString(),
			summary: tag(item, "description").slice(0, 200),
			image: safeImage(item),
		});
	}
	return articles;
}

async function fetchFeed(source: string, url: string): Promise<IdxNewsArticle[]> {
	if (!ALLOWED_HOSTS.has(new URL(url).hostname)) return [];
	// Feeds refuse requests without a browser UA.
	const res = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0", Accept: "application/rss+xml, application/xml" },
		next: { revalidate: 600 },
	});
	if (!res.ok) throw new Error(`${source} feed responded ${res.status}`);
	return parseFeed(await res.text(), source);
}

/**
 * Fetch and merge every feed, newest first. A failing publisher is skipped
 * rather than taking down the whole section.
 */
export async function getIdxNews(limit = 12): Promise<IdxNewsArticle[]> {
	const results = await Promise.allSettled(
		FEEDS.map((f) => fetchFeed(f.source, f.url)),
	);

	const seen = new Set<string>();
	const merged: IdxNewsArticle[] = [];

	for (const result of results) {
		if (result.status === "rejected") {
			console.error("getIdxNews:", result.reason);
			continue;
		}
		for (const article of result.value) {
			if (seen.has(article.url)) continue;
			seen.add(article.url);
			merged.push(article);
		}
	}

	return merged
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
		.slice(0, limit);
}
