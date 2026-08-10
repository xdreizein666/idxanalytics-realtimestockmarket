"use client";

import { useEffect, useState } from "react";

export interface TechnicalSignal {
	symbol: string;
	summarized: "BUY" | "SELL" | "NEUTRAL";
	rsi?: number;
	macd?: string;
	bollinger?: string;
	stochastic?: string;
	overallScore?: number; // 0-100: >70 buy, <30 sell
	lastUpdated?: string;
}

export default function TechnicalAnalysisCard({ symbol }: { symbol: string }) {
	const [data, setData] = useState<TechnicalSignal | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/api/idx/technical?symbol=${encodeURIComponent(symbol)}`)
			.then((r) => r.json())
			.then((d) => {
				if (!d.error) setData(d);
				else setData(null);
				setLoading(false);
			})
			.catch(() => {
				setData(null);
				setLoading(false);
			});
	}, [symbol]);

	if (loading) {
		return (
			<div className="bg-gray-900 rounded-lg p-4">
				<h3 className="text-white font-semibold mb-2">Analisis Teknis</h3>
				<p className="text-gray-400 text-sm">Memuat...</p>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="bg-gray-900 rounded-lg p-4">
				<h3 className="text-white font-semibold mb-2">Analisis Teknis</h3>
				<p className="text-gray-400 text-sm">Tidak ada cukup data historis untuk simbol ini.</p>
			</div>
		);
	}

	return (
		<div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
			<div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
				<h3 className="text-white font-semibold">Analisis Teknis</h3>
				<p className="text-gray-400 text-xs mt-1">{symbol}</p>
			</div>
			<div className="p-4 space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-gray-400 text-sm">Sinyal Keseluruhan</span>
					<span
						className={`font-bold px-3 py-1 rounded ${
							data.summarized === "BUY"
								? "bg-green-600 text-white"
								: data.summarized === "SELL"
									? "bg-red-600 text-white"
									: "bg-yellow-600 text-black"
						}`}
					>
						{data.summarized}
					</span>
				</div>

				<div className="grid grid-cols-2 gap-3 text-sm">
					<div>
						<span className="text-gray-500 text-xs">RSI (14)</span>
						<div className="text-white font-medium mt-1">
							{data.rsi !== undefined ? data.rsi.toFixed(2) : "-"}
						</div>
					</div>
					<div>
						<span className="text-gray-500 text-xs">MACD</span>
						<div className="text-white font-medium mt-1">{data.macd ?? "-"}</div>
					</div>
					<div>
						<span className="text-gray-500 text-xs">Bollinger</span>
						<div className="text-white font-medium mt-1">{data.bollinger ?? "-"}</div>
					</div>
					<div>
						<span className="text-gray-500 text-xs">Stochastik</span>
						<div className="text-white font-medium mt-1">{data.stochastic ?? "-"}</div>
					</div>
				</div>

				{data.overallScore !== undefined && (
					<div>
						<div className="flex items-center justify-between text-xs text-gray-500 mb-1">
							<span>Skor</span>
							<span>{Math.round(data.overallScore)}%</span>
						</div>
						<div className="h-2 bg-gray-700 rounded-full overflow-hidden">
							<div
								className={`h-full ${
									data.overallScore > 70
										? "bg-green-500"
										: data.overallScore < 30
											? "bg-red-500"
											: "bg-yellow-500"
								}`}
								style={{ width: `${data.overallScore}%` }}
							/>
						</div>
					</div>
				)}

				{data.lastUpdated && (
					<p className="text-gray-500 text-xs pt-3 border-t border-gray-700">
						Diperbarui: {new Date(data.lastUpdated).toLocaleString("id-ID")}
					</p>
				)}
			</div>
		</div>
	);
}
