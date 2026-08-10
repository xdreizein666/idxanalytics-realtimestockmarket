const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

async function probe(name: string, url: string) {
	try {
		const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
		const t = await res.text();
		console.log(`${name.padEnd(34)} ${res.status} len=${t.length}`);
		if (res.ok) console.log("   ", t.slice(0, 300).replace(/\s+/g, " "));
	} catch (e) {
		console.log(`${name.padEnd(34)} ERROR ${(e as Error).message}`);
	}
}

// Constituent lists for IDX indices
await probe(
	"yahoo screener IDX",
	"https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=5&region=ID&lang=id-ID",
);
await probe(
	"yahoo lookup",
	"https://query1.finance.yahoo.com/v1/finance/lookup?query=BBCA&type=equity&count=5",
);
await probe(
	"yahoo search BBCA",
	"https://query2.finance.yahoo.com/v1/finance/search?q=bank+central+asia&quotesCount=5",
);
await probe(
	"github idx tickers csv",
	"https://raw.githubusercontent.com/wildangunawan/Dataset-Saham-IDX/master/Ticker.csv",
);
