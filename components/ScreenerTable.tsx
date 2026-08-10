import Link from "next/link";
import type { ScreenerRow } from "@/lib/idx/screener-service";

const number = (value: number | null, digits = 2) => value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: digits });
function marketCap(value: number | null) {
	if (value == null) return "—";
	if (Math.abs(value) >= 1e12) return `Rp ${(value / 1e12).toFixed(1)} T`;
	if (Math.abs(value) >= 1e9) return `Rp ${(value / 1e9).toFixed(1)} M`;
	return `Rp ${value.toLocaleString("id-ID")}`;
}

export default function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
	if (!rows.length) return <p className="px-5 py-12 text-center text-sm text-muted-foreground">No companies match this screen. Broaden the filters or sync more fundamentals.</p>;
	const head = "px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground";
	const cell = "whitespace-nowrap px-4 py-3 text-sm";
	return <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="border-b bg-secondary/40"><tr><th className={head}>Ticker</th><th className={head}>Company</th><th className={head}>Sector</th><th className={`${head} text-right`}>Price</th><th className={`${head} text-right`}>PER</th><th className={`${head} text-right`}>PBV</th><th className={`${head} text-right`}>ROE</th><th className={`${head} text-right`}>Yield</th><th className={`${head} text-right`}>Market cap</th></tr></thead><tbody>{rows.map((row) => <tr key={row.symbol} className="border-b border-white/6 hover:bg-accent/40"><td className={cell}><Link href={`/stocks/${row.symbol}`} className="font-semibold text-primary hover:underline">{row.symbol}</Link></td><td className={`${cell} max-w-[240px] truncate`} title={row.name}>{row.name}</td><td className={`${cell} text-muted-foreground`}>{row.sector ?? "—"}</td><td className={`${cell} text-right font-medium`}>{number(row.price, 0)}</td><td className={`${cell} text-right`}>{number(row.peRatio)}</td><td className={`${cell} text-right`}>{number(row.pbvRatio)}</td><td className={`${cell} text-right`}>{row.roe == null ? "—" : `${number(row.roe)}%`}</td><td className={`${cell} text-right`}>{row.dividendYield == null ? "—" : `${number(row.dividendYield)}%`}</td><td className={`${cell} text-right`}>{marketCap(row.marketCap)}</td></tr>)}</tbody></table></div>;
}
