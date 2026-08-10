"use server";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { headers } from "next/headers";

export const signUpWithEmail = async ({
	email,
	password,
	fullName,
	country,
	investmentGoals,
	riskTolerance,
	preferredIndustry,
}: SignUpFormData) => {
	try {
		const response = await auth.api.signUpEmail({
			body: {
				email, password, name: fullName,
				country, investmentGoals, riskTolerance, preferredIndustry,
			},
		});

		await inngest.send({
			name: "app/user.created",
			data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
		}).catch((err) => console.error("User.created event failed", err));

		return { success: true, data: response };
	} catch (e) {
		console.error("Sign up failed", e);
		return { success: false, error: "Sign up failed" };
	}
};

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
	try {
		const response = await auth.api.signInEmail({ body: { email, password } });
		return { success: true, data: response };
	} catch (e) {
		console.error("Sign in failed", e);
		return { success: false, error: "Sign in failed" };
	}
};

export const signOut = async () => {
	try {
		await auth.api.signOut({ headers: await headers() });
		return { success: true };
	} catch (e) {
		console.error("Sign Out failed", e);
		return { success: false, error: "Sign out failed" };
	}
};
