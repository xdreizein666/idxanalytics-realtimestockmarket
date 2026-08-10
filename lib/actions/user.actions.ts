"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/database/db";

export const getAllUsersForNewsEmail = async () => {
	try {
		const users = await db
			.select({ id: schema.user.id, email: schema.user.email, name: schema.user.name })
			.from(schema.user)
			.where(and(isNotNull(schema.user.email), eq(schema.user.newsEmailOptIn, true)));

		return users.filter((user) => user.email && user.name);
	} catch (e) {
		console.error("Error fetching users for news email:", e);
		return [];
	}
};
