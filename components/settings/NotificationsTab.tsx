"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleEmailOptIn } from "@/lib/actions/profile.actions";
import { Button } from "@/components/ui/button";
import type { SettingsProfile } from "@/app/(root)/settings/components/SettingsShell";

interface NotificationsTabProps {
	profile: SettingsProfile;
}

export default function NotificationsTab({ profile }: NotificationsTabProps) {
	const [isPending, startTransition] = useTransition();
	
	async function handleToggle(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const enabled = String(formData.get("enabled")) === "true";
		
		startTransition(async () => {
			const result = await toggleEmailOptIn({ enabled });
			if (!result.success) {
				toast.error("Failed to update preferences");
				return;
			}
			toast.success(enabled ? "Notifications enabled" : "Notifications disabled", { id: `email-prefs-${enabled ? 'on' : 'off'}` });
		});
	}
	
	return (
		<section className="space-y-8">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Communication</p>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight">Notification preferences</h1>
				<p className="mt-2 text-muted-foreground">Control how we keep you informed about market movements.</p>
			</div>
			
			<section className="surface p-6 sm:p-7">
				<h2 className="font-semibold">Email notifications</h2>
				<p className="mt-1 text-sm text-muted-foreground">Receive daily summaries and price alert emails based on your watchlist.</p>
				<form onSubmit={handleToggle} className="mt-5 grid gap-4 sm:max-w-md">
					<div className="flex items-center justify-between rounded-lg border bg-secondary/40 px-4 py-3">
						<span className="text-sm font-medium">Daily Market Digest</span>
						<input type="hidden" name="enabled" defaultValue={String(profile.newsEmailOptIn)} />
						<Button type="submit" variant="outline" size="sm" disabled={isPending} className={`rounded-full px-6 ${isPending ? "opacity-50" : ""}`}>
							{isPending ? "..." : profile.newsEmailOptIn ? "Enabled" : "Disabled"}
						</Button>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">You can unsubscribe at any time using the link in our emails.</p>
				</form>
			</section>
			
			<section className="surface p-6 sm:p-7">
				<h2 className="font-semibold">Unsubscribe all</h2>
				<p className="mt-1 text-sm text-muted-foreground">Stop all email communications from IdxAnalytics.</p>
				<a href="/unsubscribe" className="mt-5 inline-flex rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors">Unsubscribe from all emails</a>
			</section>
		</section>
	);
}
