/** Probe: can we obtain a Yahoo crumb from Node to unlock quoteSummary fundamentals? */
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

// Step 1: get the A1/A3 cookie. fc.yahoo.com 404s but still sets cookies.
const seed = await fetch("https://fc.yahoo.com/", {
	headers: { "User-Agent": UA },
	redirect: "manual",
});
const rawCookies = seed.headers.getSetCookie?.() ?? [];
console.log(`[seed] status=${seed.status} cookies=${rawCookies.length}`);
const cookie = rawCookies.map((c) => c.split(";")[0]).join("; ");
console.log(`[seed] cookie header: ${cookie.slice(0, 120)}`);

if (!cookie) {
	console.log("No cookie obtained; trying the consent host instead.");
}

// Step 2: exchange cookie for a crumb.
const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
	headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
});
const crumb = (await crumbRes.text()).trim();
console.log(`[crumb] status=${crumbRes.status} value=${JSON.stringify(crumb)}`);

if (crumbRes.status !== 200 || !crumb || crumb.includes("<")) {
	console.log("CRUMB FAILED — fundamentals via quoteSummary not reachable this way.");
	process.exit(0);
}

// Step 3: use it.
const modules = "defaultKeyStatistics,financialData,summaryDetail,price";
const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/BBCA.JK?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
const r = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie } });
console.log(`[quoteSummary+crumb] status=${r.status}`);
const body = await r.text();
if (r.status === 200) {
	const res = JSON.parse(body).quoteSummary?.result?.[0];
	console.log("  modules:", Object.keys(res ?? {}));
	console.log("  trailingPE     :", res?.summaryDetail?.trailingPE?.raw);
	console.log("  priceToBook    :", res?.defaultKeyStatistics?.priceToBook?.raw);
	console.log("  returnOnEquity :", res?.financialData?.returnOnEquity?.raw);
	console.log("  debtToEquity   :", res?.financialData?.debtToEquity?.raw);
	console.log("  trailingEps    :", res?.defaultKeyStatistics?.trailingEps?.raw);
	console.log("  dividendYield  :", res?.summaryDetail?.dividendYield?.raw);
	console.log("  marketCap      :", res?.price?.marketCap?.raw);
	console.log("  profitMargins  :", res?.financialData?.profitMargins?.raw);
	console.log("  returnOnAssets :", res?.financialData?.returnOnAssets?.raw);
} else {
	console.log("  body:", body.slice(0, 200));
}
