import Link from "next/link";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import { searchStocks } from "@/lib/actions/finnhub.actions";

export default async function Header({ user }: { user: User }) {
	const initialStocks = await searchStocks();

	return (
		<header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
			<div className="app-shell flex h-16 items-center justify-between gap-4">
				<Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="IdxAnalytics dashboard">
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">S</span>
					<span className="hidden text-sm font-semibold tracking-[0.16em] sm:block">IDXANALYTICS</span>
				</Link>
				<nav className="hidden min-w-0 flex-1 justify-center lg:flex"><NavItems initialStocks={initialStocks} /></nav>
				<UserDropdown user={user} initialStocks={initialStocks} />
			</div>
		</header>
	);
}
