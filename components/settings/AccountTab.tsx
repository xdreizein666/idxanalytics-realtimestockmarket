"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile, changePassword } from "@/lib/actions/profile.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SettingsProfile } from "@/app/(root)/settings/components/SettingsShell";

interface AccountTabProps {
	profile: SettingsProfile;
}

export default function AccountTab({ profile }: AccountTabProps) {
	const [isPendingAccount, startTransitionAccount] = useTransition();
	const [isPendingPassword, startTransitionPassword] = useTransition();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	
	async function handleUpdateName(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const fullName = String(formData.get("fullName"));
		
		if (fullName === profile.name) return;
		
		startTransitionAccount(async () => {
			const result = await updateProfile({ fullName });
			if (!result.success) {
				toast.error("Failed to update name");
				return;
			}
			toast.success("Name updated successfully", { id: "name-update-success" });
		});
	}
	
	async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		
		if (newPassword.length < 8) {
			toast.error("Password must be at least 8 characters");
			return;
		}
		
		startTransitionPassword(async () => {
			const result = await changePassword({ currentPassword, newPassword });
			if (!result.success) return;
			
			setCurrentPassword("");
			setNewPassword("");
		});
	}
	
	return (
		<section className="space-y-8">
			<div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Personal information</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">Account settings</h1><p className="mt-2 text-muted-foreground">Manage your account information and security.</p></div>
			
			<section className="surface p-6 sm:p-7"><h2 className="font-semibold">Full name</h2><p className="mt-1 text-sm text-muted-foreground">This is how your profile appears to other users.</p>
			<form onSubmit={handleUpdateName} className="mt-5 grid max-w-md gap-4">
				<Input type="text" name="fullName" defaultValue={profile.name || ""} placeholder="Your full name" aria-label="Full name" required className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
				<Button type="submit" disabled={isPendingAccount} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isPendingAccount ? "Saving..." : "Update name"}</Button>
			</form></section>
			
			<section className="surface p-6 sm:p-7"><h2 className="font-semibold">Change password</h2><p className="mt-1 text-sm text-muted-foreground">Ensure your account is secure with a strong, unique password.</p>
			<form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
				<Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full max-w-md rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
				<Input type="password" placeholder="New password (minimum 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full max-w-md rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
				<Button type="submit" disabled={isPendingPassword || !currentPassword || !newPassword} className="w-full max-w-md rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isPendingPassword ? "Updating..." : "Change password"}</Button>
			</form></section>
		</section>
	);
}
