import { readFileSync } from "node:fs";
import { getRecentDividends, getUpcomingDividends } from "../lib/idx/dividend-service";

for (const line of readFileSync(".env", "utf8").split("\n")) {
	const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

console.log("upcoming:", await getUpcomingDividends(5));
const recent = await getRecentDividends(10);
console.log("\nrecent:", recent);
