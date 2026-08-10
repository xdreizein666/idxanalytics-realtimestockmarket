"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/database/db";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { findEmiten } from "@/lib/idx/emiten";

export interface PriceAlertInput {
	symbol: string;
	alertName: string;
	alertType: "upper" | "lower";
	threshold: number;
	isActive?: boolean;
}

async function requireUserId(): Promise<string | null> {
	const session = await auth.api.getSession({ headers: await headers() });
	return session?.user?.id ?? null;
}

/** Return IDX only for symbols present in the IDX static emiten snapshot. */
function detectMarket(symbol: string): "US" | "IDX" {
	return findEmiten(symbol.toUpperCase().trim()) ? "IDX" : "US";
}

export async function createPriceAlert(input: PriceAlertInput) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Silakan masuk terlebih dahulu" };

	const symbol = input.symbol.trim().toUpperCase();
	const threshold = Number(input.threshold);

	if (!symbol) return { success: false, error: "Simbol wajib diisi" };
	if (!Number.isFinite(threshold) || threshold <= 0)
		return { success: false, error: "Target harga harus lebih besar dari 0" };
	if (!input.alertName.trim()) return { success: false, error: "Nama alert wajib diisi" };
	if (input.alertType !== "upper" && input.alertType !== "lower")
		return { success: false, error: "Tipe alert tidak valid" };

	const market = detectMarket(symbol);
	const company = findEmiten(symbol)?.name ?? symbol;

	try {
		await db.insert(schema.priceAlert).values({
			id: randomUUID(),
			userId,
			symbol,
			market,
			company,
			alertName: input.alertName.trim(),
			alertType: input.alertType,
			threshold: threshold.toString(),
			isActive: input.isActive ?? true,
		});

		revalidatePath("/alerts");
		return { success: true };
	} catch (error) {
		console.error("[ALERT] create failed:", error);
		return { success: false, error: "Gagal membuat alert" };
	}
}

export async function getAlertsForCurrentUser() {
	const userId = await requireUserId();
	if (!userId) return [];

	const rows = await db
		.select()
		.from(schema.priceAlert)
		.where(eq(schema.priceAlert.userId, userId))
		.orderBy(schema.priceAlert.createdAt);

	return rows.map((r) => ({ ...r, threshold: Number(r.threshold) }));
}

export async function deletePriceAlert(id: string) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Unauthorized" };

	// Scope the delete to the owner so an id alone can't remove someone else's alert.
	await db
		.delete(schema.priceAlert)
		.where(and(eq(schema.priceAlert.id, id), eq(schema.priceAlert.userId, userId)));

	revalidatePath("/alerts");
	return { success: true };
}

export async function toggleAlert(id: string, isActive: boolean) {
	const userId = await requireUserId();
	if (!userId) return { success: false, error: "Unauthorized" };

	await db
		.update(schema.priceAlert)
		.set({ isActive })
		.where(and(eq(schema.priceAlert.id, id), eq(schema.priceAlert.userId, userId)));

	revalidatePath("/alerts");
	return { success: true };
}

// ---------------------------------------------------------------------------
// Cron helpers (called from Inngest, not from the browser)
// ---------------------------------------------------------------------------

const REARM_MS = 6 * 60 * 60 * 1000; // don't re-notify the same alert within 6h

/** Active alerts joined with the owner's email, minus recently-fired ones. */
export async function getTriggerableAlerts() {
	const rows = await db
		.select({
			id: schema.priceAlert.id,
			symbol: schema.priceAlert.symbol,
			market: schema.priceAlert.market,
			company: schema.priceAlert.company,
			alertType: schema.priceAlert.alertType,
			threshold: schema.priceAlert.threshold,
			lastTriggeredAt: schema.priceAlert.lastTriggeredAt,
			email: schema.user.email,
		})
		.from(schema.priceAlert)
		.innerJoin(schema.user, eq(schema.priceAlert.userId, schema.user.id))
		.where(eq(schema.priceAlert.isActive, true));

	const cutoff = Date.now() - REARM_MS;
	return rows
		.filter((r) => !r.lastTriggeredAt || new Date(r.lastTriggeredAt).getTime() < cutoff)
		.map((r) => ({ ...r, threshold: Number(r.threshold) }));
}

export async function markAlertTriggered(id: string) {
	await db
		.update(schema.priceAlert)
		.set({ lastTriggeredAt: new Date() })
		.where(eq(schema.priceAlert.id, id));
}
