export async function fetchJSON<T>(
	url: string,
	revalidateSeconds?: number,
): Promise<T> {
	const options: RequestInit & { next?: { revalidate?: number } } =
		revalidateSeconds
			? { cache: "force-cache", next: { revalidate: revalidateSeconds } }
			: { cache: "no-store" };

	const parsed = new URL(url);
	if (parsed.protocol !== "https:" || parsed.hostname !== "finnhub.io") {
		throw new Error("Only Finnhub HTTPS URLs are allowed");
	}

	const res = await fetch(url, options);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`Fetch failed ${res.status}: ${text}`);
	}
	return (await res.json()) as T;
}
