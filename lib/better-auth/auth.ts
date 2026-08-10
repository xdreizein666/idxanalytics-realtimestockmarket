import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/database/db";
import * as schema from "@/database/schema";

/**
 * Synchronous auth instance.
 *
 * The previous MongoDB setup exported an async `getAuth()` returning a promise,
 * which made every call site `await` a possibly-null value and broke `next build`
 * with TS18047. Drizzle needs no async bootstrap, so the instance is a plain const.
 *
 * Source: https://www.better-auth.com/docs/adapters/drizzle
 */
export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	emailAndPassword: {
		enabled: true,
		disableSignUp: false,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true,
	},
	/**
	 * The investment profile is persisted on the user row instead of only being
	 * passed through a one-off Inngest event, so daily emails can personalize too.
	 * Source: https://www.better-auth.com/docs/concepts/database#extending-core-schema
	 */
	user: {
		additionalFields: {
			country: { type: "string", required: false, input: true },
			investmentGoals: { type: "string", required: false, input: true },
			riskTolerance: { type: "string", required: false, input: true },
			preferredIndustry: { type: "string", required: false, input: true },
			newsEmailOptIn: { type: "boolean", required: false, input: false, defaultValue: true },
		},
	},
	/**
	 * Built-in rate limiting. Auth endpoints get a tighter window than the default
	 * so credential stuffing and signup spam are throttled without extra infra.
	 * Source: https://www.better-auth.com/docs/concepts/rate-limit
	 */
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 900, max: 10 },
			"/sign-up/email": { window: 3600, max: 5 },
		},
	},
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
