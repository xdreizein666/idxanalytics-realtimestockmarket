"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SORTS = [
	{ value: "marketCap", label: "Market cap" },
	{ value: "per", label: "PER" },
	{ value: "pbv", label: "PBV" },
	{ value: "roe", label: "ROE" },
	{ value: "dividendYield", label: "Dividend yield" },
];

export default function ScreenerFilters({ sectors }: { sectors: string[] }) {
	const router = useRouter();
	const params = useSearchParams();
	const [sector, setSector] = useState(params.get("sector") ?? "");
	const [maxPer, setMaxPer] = useState(params.get("maxPer") ?? "");
	const [maxPbv, setMaxPbv] = useState(params.get("maxPbv") ?? "");
	const [minRoe, setMinRoe] = useState(params.get("minRoe") ?? "");
	const [minDividendYield, setMinDividendYield] = useState(params.get("minDividendYield") ?? "");
	const [sortBy, setSortBy] = useState(params.get("sortBy") ?? "marketCap");
	const [sortDir, setSortDir] = useState(params.get("sortDir") ?? "desc");

	const apply = (event: React.FormEvent) => {
		event.preventDefault();
		const next = new URLSearchParams();
		for (const [key, value] of Object.entries({ sector, maxPer, maxPbv, minRoe, minDividendYield, sortBy, sortDir })) if (value.trim()) next.set(key, value.trim());
		router.push(`/screener?${next}`);
	};
	const reset = () => { setSector(""); setMaxPer(""); setMaxPbv(""); setMinRoe(""); setMinDividendYield(""); setSortBy("marketCap"); setSortDir("desc"); router.push("/screener"); };
	const field = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary";
	const label = "mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground";

	return <form onSubmit={apply} className="surface p-5 sm:p-6"><div className="mb-5"><h2 className="font-semibold">Filter companies</h2><p className="mt-1 text-sm text-muted-foreground">Leave a field blank to keep it unrestricted.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div><label htmlFor="sc-sector" className={label}>Sector</label><select id="sc-sector" value={sector} onChange={(event) => setSector(event.target.value)} className={field}><option value="">All sectors</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><Field id="sc-per" label="Maximum PER" value={maxPer} onChange={setMaxPer} placeholder="e.g. 15" /><Field id="sc-pbv" label="Maximum PBV" value={maxPbv} onChange={setMaxPbv} placeholder="e.g. 2" /><Field id="sc-roe" label="Minimum ROE (%)" value={minRoe} onChange={setMinRoe} placeholder="e.g. 15" /><Field id="sc-yield" label="Minimum yield (%)" value={minDividendYield} onChange={setMinDividendYield} placeholder="e.g. 4" /><div className="grid grid-cols-2 gap-3"><div><label htmlFor="sc-sort" className={label}>Sort by</label><select id="sc-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={field}>{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label htmlFor="sc-dir" className={label}>Order</label><select id="sc-dir" value={sortDir} onChange={(event) => setSortDir(event.target.value)} className={field}><option value="desc">Highest</option><option value="asc">Lowest</option></select></div></div></div><div className="mt-6 flex gap-3"><button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Apply filters</button><button type="button" onClick={reset} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent">Reset</button></div></form>;
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
	return <div><label htmlFor={id} className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</label><input id={id} type="number" step="any" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" /></div>;
}
