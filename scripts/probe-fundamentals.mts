/** Probe: does Yahoo serve fundamentals + dividend events for .JK tickers from Node? */
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

async function get(url: string) {
	const r = await fetch(url, { headers: { "User-Agent": UA } });
	return { status: r.status, body: await r.text() };
}

// 1) quoteSummary modules (PER, PBV, ROE, DER, EPS, dividend yield)
const modules = "defaultKeyStatistics,financialData,summaryDetail,price";
for (const host of ["query1", "query2"]) {
	const { status, body } = await get(
		`https://${host}.finance.yahoo.com/v10/finance/quoteSummary/BBCA.JK?modules=${modules}`,
	);
	console.log(`\n[quoteSummary ${host}] status=${status} len=${body.length}`);
	if (status === 200) {
		const j = JSON.parse(body);
		const r = j.quoteSummary?.result?.[0];
		console.log("  modules:", Object.keys(r ?? {}));
		console.log("  trailingPE:", r?.summaryDetail?.trailingPE?.raw);
		console.log("  priceToBook:", r?.defaultKeyStatistics?.priceToBook?.raw);
		console.log("  returnOnEquity:", r?.financialData?.returnOnEquity?.raw);
		console.log("  debtToEquity:", r?.financialData?.debtToEquity?.raw);
		console.log("  trailingEps:", r?.defaultKeyStatistics?.trailingEps?.raw);
		console.log("  dividendYield:", r?.summaryDetail?.dividendYield?.raw);
		console.log("  marketCap:", r?.price?.marketCap?.raw);
	} else {
		console.log("  first 200:", body.slice(0, 200));
	}
}

// 2) chart with dividend events
const { status: cs, body: cb } = await get(
	"https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=2y&interval=1d&events=div",
);
console.log(`\n[chart events=div] status=${cs}`);
if (cs === 200) {
	const j = JSON.parse(cb);
	const divs = j.chart?.result?.[0]?.events?.dividends;
	console.log("  dividend events:", divs ? Object.keys(divs).length : 0);
	if (divs) {
		for (const k of Object.keys(divs).slice(-4)) {
			const d = divs[k];
			console.log(`    ${new Date(d.date * 1000).toISOString().slice(0, 10)} amount=${d.amount}`);
		}
	}
}

// 3) batch quote endpoint (many symbols at once) — useful for screener
const { status: qs, body: qb } = await get(
	"https://query1.finance.yahoo.com/v7/finance/quote?symbols=BBCA.JK,BBRI.JK,TLKM.JK",
);
console.log(`\n[v7 quote batch] status=${qs} first 200: ${qb.slice(0, 200)}`);
