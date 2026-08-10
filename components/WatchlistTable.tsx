"use client";

import { useState } from "react";
import Link from "next/link";
import { WATCHLIST_TABLE_HEADER } from "@/lib/constants";
import WatchlistButton from "@/components/WatchlistButton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const WatchlistTable = ({ watchlist }: WatchlistTableProps) => {
	const [items, setItems] = useState<StockWithData[]>(watchlist);

	const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
		if (!isAdded) {
			setItems((prev) => prev.filter((item) => item.symbol !== symbol));
		}
	};

	if (items.length === 0) {
		return (
			<div className="text-center py-16 text-gray-400">
				<p className="text-lg">Your watchlist is empty.</p>
				<p className="text-sm mt-2">
					Search for stocks and add them to your watchlist to track
					them here.
				</p>
			</div>
		);
	}

	return (
		<Table className="watchlist-table">
			<TableHeader>
				<TableRow className="table-header-row">
					{WATCHLIST_TABLE_HEADER.map((header) => (
						<TableHead key={header} className="table-header">
							{header}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((stock) => (
					<TableRow key={stock.symbol} className="table-row">
						<TableCell className="table-cell pl-4">
							{stock.company}
						</TableCell>
						<TableCell className="table-cell">
							<Link
								href={`/stocks/${stock.symbol}`}
								className="text-yellow-500 hover:underline"
							>
								{stock.symbol}
							</Link>
						</TableCell>
						<TableCell className="table-cell">
							{stock.priceFormatted ?? "—"}
						</TableCell>
						<TableCell
							className={`table-cell ${
								stock.changePercent != null
									? stock.changePercent > 0
										? "text-green-500"
										: stock.changePercent < 0
											? "text-red-500"
											: ""
									: ""
							}`}
						>
							{stock.changeFormatted ?? "—"}
						</TableCell>
						<TableCell className="table-cell">
							{stock.marketCap ?? "—"}
						</TableCell>
						<TableCell className="table-cell">
							{stock.peRatio ?? "—"}
						</TableCell>
						<TableCell className="table-cell">
							<a
								href={`/alerts?symbol=${encodeURIComponent(stock.symbol)}`}
								className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent"
							>
								Set alert
							</a>
						</TableCell>
						<TableCell className="table-cell">
							<WatchlistButton
								symbol={stock.symbol}
								company={stock.company}
								isInWatchlist={true}
								showTrashIcon={true}
								type="button"
								onWatchlistChange={handleWatchlistChange}
							/>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
};

export default WatchlistTable;
