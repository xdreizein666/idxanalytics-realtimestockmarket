/** Why is priceToBook absurd for some .JK tickers? Compare against bookValue directly. */
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const seed = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
const cookie = (seed.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
	headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
});
const crumb = (await crumbRes.text()).trim();

for (const sym of ["BREN", "AMMN", "TPIA", "BBCA", "ASII"]) {
	const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}.JK?modules=summaryDetail,defaultKeyStatistics,price,financialData&crumb=${encodeURIComponent(crumb)}`;
	const r = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie } });
	const res = (await r.json()).quoteSummary?.result?.[0];
	const price = res?.price?.regularMarketPrice?.raw;
	const ptb = res?.defaultKeyStatistics?.priceToBook?.raw;
	const bv = res?.defaultKeyStatistics?.bookValue?.raw;
	const currency = res?.price?.currency;
	console.log(
		`${sym.padEnd(5)} price=${String(price).padStart(8)} ${currency}  bookValue=${String(bv).padStart(10)}  priceToBook=${ptb}  price/bookValue=${bv ? (price / bv).toFixed(2) : "n/a"}`,
	);
}
