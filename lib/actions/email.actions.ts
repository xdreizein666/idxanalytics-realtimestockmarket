"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/database/db";

export async function unsubscribeFromNews(email: string) {
	const normalized = email.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
		return { success: false, error: "Enter a valid email address" };
	}

	await db
		.update(schema.user)
		.set({ newsEmailOptIn: false })
		.where(eq(schema.user.email, normalized));

	return { success: true };
}
