"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deletePriceAlert, toggleAlert } from "@/lib/actions/price-alert.actions";

export interface AlertRow {
	id: string;
	symbol: string;
	market: string;
	company: string;
	alertName: string;
	alertType: string;
	threshold: number;
	isActive: boolean;
	lastTriggeredAt: Date | null;
}

export default function AlertList({ alerts }: { alerts: AlertRow[] }) {
	const [pending, startTransition] = useTransition();
	return <div className="space-y-3">{alerts.map((alert) => <article key={alert.id} className="surface-subtle flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{alert.symbol}</span><span className="text-xs text-muted-foreground">{alert.market}</span><span className={`rounded-full px-2 py-0.5 text-xs ${alert.isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{alert.isActive ? "Active" : "Paused"}</span></div><p className="mt-2 truncate text-sm text-muted-foreground">{alert.alertName}</p><p className="mt-1 text-sm">{alert.alertType === "upper" ? "Rises to" : "Falls to"} <strong>{alert.market === "IDX" ? "Rp " : "$"}{alert.threshold.toLocaleString("id-ID")}</strong></p>{alert.lastTriggeredAt && <p className="mt-1 text-xs text-muted-foreground">Last triggered {new Date(alert.lastTriggeredAt).toLocaleString("id-ID")}</p>}</div><div className="flex shrink-0 gap-2"><button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await toggleAlert(alert.id, !alert.isActive); if (!result?.success) toast.error("Could not update alert"); else toast.success(alert.isActive ? "Alert paused" : "Alert resumed"); })} className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50">{alert.isActive ? "Pause" : "Resume"}</button><button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await deletePriceAlert(alert.id); if (!result?.success) toast.error("Could not delete alert"); else { toast.success("Alert deleted"); } })} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">Delete</button></div></article>)}</div>;
}
