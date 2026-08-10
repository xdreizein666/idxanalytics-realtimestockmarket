"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createPriceAlert } from "@/lib/actions/price-alert.actions";

export default function PriceAlertForm({ initialSymbol = "" }: { initialSymbol?: string }) {
	const router = useRouter();
	const params = useSearchParams();
	const [symbol, setSymbol] = useState((initialSymbol || params.get("symbol") || "").toUpperCase());
	const [alertName, setAlertName] = useState("");
	const [alertType, setAlertType] = useState<"upper" | "lower">("upper");
	const [threshold, setThreshold] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const field = "mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary";

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		const result = await createPriceAlert({ symbol, alertName: alertName.trim() || `Alert ${symbol}`, alertType, threshold: Number(threshold) });
		setSubmitting(false);
		if (!result.success) return toast.error("Could not create alert", { description: result.error ?? "Check the values and try again." });
		toast.success("Price alert created");
		setAlertName("");
		setThreshold("");
		router.refresh();
	};

	return <section className="surface p-5 sm:p-6"><h2 className="font-semibold">Create an alert</h2><p className="mt-1 text-sm text-muted-foreground">Receive an email when a price reaches your target.</p><form onSubmit={handleSubmit} className="mt-6 space-y-5"><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="pa-symbol" className="text-sm font-medium">Ticker</label><input id="pa-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="BBCA" maxLength={10} required className={`${field} uppercase`} /></div><div><label htmlFor="pa-name" className="text-sm font-medium">Alert name <span className="text-muted-foreground">(optional)</span></label><input id="pa-name" value={alertName} onChange={(event) => setAlertName(event.target.value)} placeholder={symbol ? `Alert ${symbol}` : "My target"} className={field} /></div></div><div><label htmlFor="pa-type" className="text-sm font-medium">Condition</label><select id="pa-type" value={alertType} onChange={(event) => setAlertType(event.target.value as "upper" | "lower")} className={field}><option value="upper">Price rises to or above target</option><option value="lower">Price falls to or below target</option></select></div><div><label htmlFor="pa-threshold" className="text-sm font-medium">Target price</label><input id="pa-threshold" type="number" value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="6500" min="0" step="any" required className={field} /></div><button type="submit" disabled={submitting} className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{submitting ? "Saving..." : "Create alert"}</button></form></section>;
}
