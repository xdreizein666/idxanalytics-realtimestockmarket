"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/actions/profile.actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_OPTIONS, INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from "@/lib/constants";
import type { SettingsProfile } from "@/app/(root)/settings/components/SettingsShell";

interface ProfileTabProps {
	profile: SettingsProfile;
}

export default function ProfileTab({ profile }: ProfileTabProps) {
	const [isPending, startTransition] = useTransition();
	
	const formData = {
		country: profile.country || "",
		investmentGoals: profile.investmentGoals || "",
		riskTolerance: profile.riskTolerance || "",
		preferredIndustry: profile.preferredIndustry || "",
	};
	
	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		
		const newValues = {
			country: String((e.currentTarget as HTMLFormElement).country.value),
			investmentGoals: String((e.currentTarget as HTMLFormElement).investmentGoals.value),
			riskTolerance: String((e.currentTarget as HTMLFormElement).riskTolerance.value),
			preferredIndustry: String((e.currentTarget as HTMLFormElement).preferredIndustry.value),
		};
		
		if (newValues.country === profile.country &&
		    newValues.investmentGoals === profile.investmentGoals &&
		    newValues.riskTolerance === profile.riskTolerance &&
		    newValues.preferredIndustry === profile.preferredIndustry) {
			return;
		}
		
		startTransition(async () => {
			const result = await updateProfile(newValues);
			if (!result.success) {
				toast.error("Failed to update investment profile");
				return;
			}
			toast.success("Investment profile updated", { id: "profile-update-success" });
		});
	}
	
	return (
		<section className="space-y-8">
			<div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Personal preferences</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">Investment profile</h1><p className="mt-2 text-muted-foreground">Tell us how you invest so we can customize your experience.</p></div>
			
			<form onSubmit={handleSubmit} className="surface p-6 sm:p-7 space-y-5">
				<div className="grid gap-5 sm:grid-cols-2">
					<div>
						<label htmlFor="country" className="mb-2 block text-sm font-medium">Country</label>
						<Select name="country" defaultValue={profile.country || undefined}>
							<SelectTrigger id="country" aria-label="Select country" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary">
								<SelectValue placeholder="Choose country" />
							</SelectTrigger>
							<SelectContent>{COUNTRY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
					<div>
						<label htmlFor="goals" className="mb-2 block text-sm font-medium">Investment Goals</label>
						<Select name="investmentGoals" defaultValue={profile.investmentGoals || undefined}>
							<SelectTrigger id="goals" aria-label="Select investment goals" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary">
								<SelectValue placeholder="Choose goal" />
							</SelectTrigger>
							<SelectContent>{INVESTMENT_GOALS.map((goal) => <SelectItem key={goal.value} value={goal.value}>{goal.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
				</div>
				
				<div className="grid gap-5 sm:grid-cols-2">
					<div>
						<label htmlFor="risk" className="mb-2 block text-sm font-medium">Risk Tolerance</label>
						<Select name="riskTolerance" defaultValue={profile.riskTolerance || undefined}>
							<SelectTrigger id="risk" aria-label="Select risk tolerance" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary">
								<SelectValue placeholder="Select tolerance" />
							</SelectTrigger>
							<SelectContent>{RISK_TOLERANCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
					<div>
						<label htmlFor="industry" className="mb-2 block text-sm font-medium">Preferred Industry</label>
						<Select name="preferredIndustry" defaultValue={profile.preferredIndustry || undefined}>
							<SelectTrigger id="industry" aria-label="Select preferred industry" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary">
								<SelectValue placeholder="Select industry" />
							</SelectTrigger>
							<SelectContent>{PREFERRED_INDUSTRIES.map((ind) => <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
				</div>
				
				<Button type="submit" disabled={isPending} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isPending ? "Saving..." : "Save preferences"}</Button>
			</form>
		</section>
	);
}
