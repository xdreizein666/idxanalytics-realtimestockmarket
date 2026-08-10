"use server";

import { auth } from "@/lib/better-auth/auth";
import { db, schema } from "@/database/db";
import { user } from "@/database/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

interface UpdateProfileInput {
	fullName?: string;
	country?: string;
	investmentGoals?: string;
	riskTolerance?: string;
	preferredIndustry?: string;
}

interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

interface ToggleEmailOptInInput {
	enabled: boolean;
}

async function requireUserId(): Promise<string | null> {
	const session = await auth.api.getSession({ headers: await headers() });
	return session?.user?.id ?? null;
}

export async function getMyProfile() {
	const userId = await requireUserId();
	if (!userId) return null;
	
	const profile = await db.query.user.findFirst({
		where: eq(user.id, userId),
	});
	
	if (!profile) return null;
	
	return {
		id: profile.id,
		email: profile.email,
		name: profile.name,
		country: profile.country,
		investmentGoals: profile.investmentGoals,
		riskTolerance: profile.riskTolerance,
		preferredIndustry: profile.preferredIndustry,
		newsEmailOptIn: profile.newsEmailOptIn,
		createdAt: profile.createdAt,
	};
}

export async function updateProfile(input: UpdateProfileInput) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Unauthorized" };
	
	try {
		await db.update(user).set({
			...(input.fullName !== undefined && { name: input.fullName }),
			...(input.country !== undefined && { country: input.country }),
			...(input.investmentGoals !== undefined && { investmentGoals: input.investmentGoals }),
			...(input.riskTolerance !== undefined && { riskTolerance: input.riskTolerance }),
			...(input.preferredIndustry !== undefined && { preferredIndustry: input.preferredIndustry }),
		}).where(eq(user.id, userId));
		
		revalidatePath("/settings/account");
		return { success: true };
	} catch (error) {
		console.error("[PROFILE] Update failed:", error);
		return { success: false, error: "Failed to update profile" };
	}
}

export async function changePassword(input: ChangePasswordInput) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Unauthorized" };
	
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session) return { success: false, error: "Session not found" };
		
		await auth.api.changePassword({
			headers: await headers(),
			body: {
				newPassword: input.newPassword,
				currentPassword: input.currentPassword,
			},
		});
		
		revalidatePath("/settings/account");
		return { success: true };
	} catch (error) {
		console.error("[PASSWORD] Change failed:", error);
		return { success: false, error: "Current password is incorrect or new password is too weak" };
	}
}

export async function toggleEmailOptIn(input: ToggleEmailOptInInput) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Unauthorized" };
	
	try {
		await db.update(user).set({
			newsEmailOptIn: input.enabled,
		}).where(eq(user.id, userId));
		
		revalidatePath("/settings/notifications");
		return { success: true };
	} catch (error) {
		console.error("[EMAIL PREFS] Update failed:", error);
		return { success: false, error: "Failed to update email preferences" };
	}
}
