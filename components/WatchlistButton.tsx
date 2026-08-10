"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";

export default function WatchlistButton({ symbol, company, isInWatchlist, showTrashIcon = false, type = "button", onWatchlistChange }: WatchlistButtonProps) {
	const [added, setAdded] = useState(isInWatchlist);
	const [pending, startTransition] = useTransition();
	useEffect(() => setAdded(isInWatchlist), [isInWatchlist]);
	const label = added ? "Remove from watchlist" : "Add to watchlist";

	const toggle = () => {
		const next = !added;
		setAdded(next);
		startTransition(async () => {
			const result = next ? await addToWatchlist(symbol, company) : await removeFromWatchlist(symbol);
			if (!result.success) {
				setAdded(!next);
				toast.error("Could not update watchlist", { description: result.error });
				return;
			}
			onWatchlistChange?.(symbol, next);
			toast.success(next ? "Added to watchlist" : "Removed from watchlist");
		});
	};

	if (type === "icon") return <button type="button" onClick={toggle} disabled={pending} aria-label={label} title={label} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-lg disabled:opacity-50 ${added ? "border-primary/30 bg-primary/10 text-primary" : "hover:bg-accent"}`}>★</button>;
	return <button type="button" onClick={toggle} disabled={pending} className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50 ${added ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "hover:bg-accent"}`}>{showTrashIcon && added ? "Remove" : pending ? "Saving..." : label}</button>;
}
