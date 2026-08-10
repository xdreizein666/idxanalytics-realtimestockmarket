import Link from "next/link";
import type { DividendCalendarRow } from "@/lib/idx/dividend-service";

function date(value: string | null) {
	return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function DividendTable({ rows }: { rows: DividendCalendarRow[] }) {
	if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-muted-foreground">No dividend records for this period.</p>;
	const head = "px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground";
	const cell = "whitespace-nowrap px-4 py-3 text-sm";
	return <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="border-b bg-secondary/40"><tr><th className={head}>Ticker</th><th className={head}>Company</th><th className={head}>Sector</th><th className={`${head} text-right`}>Ex-date</th><th className={`${head} text-right`}>Payment</th><th className={`${head} text-right`}>Amount</th><th className={head}>Type</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.symbol}-${row.exDividendDate}-${index}`} className="border-b border-white/6 hover:bg-accent/40"><td className={cell}><Link href={`/stocks/${row.symbol}`} className="font-semibold text-primary hover:underline">{row.symbol}</Link></td><td className={`${cell} max-w-[240px] truncate`} title={row.name ?? ""}>{row.name ?? "—"}</td><td className={`${cell} text-muted-foreground`}>{row.sector ?? "—"}</td><td className={`${cell} text-right`}>{date(row.exDividendDate)}</td><td className={`${cell} text-right`}>{date(row.paymentDate)}</td><td className={`${cell} text-right font-medium`}>Rp {row.amount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td><td className={cell}><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{row.type}</span></td></tr>)}</tbody></table></div>;
}
