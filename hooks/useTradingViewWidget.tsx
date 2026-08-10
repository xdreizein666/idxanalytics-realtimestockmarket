"use client";
import { useEffect, useRef } from "react";

const useTradingViewWidget = (
	scriptUrl: string,
	config: Record<string, unknown>,
	height = 600,
) => {
	const containerRef = useRef<HTMLDivElement | null>(null);
	// Serialized so a new object literal with identical contents doesn't re-run the effect.
	const configKey = JSON.stringify(config);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		// The TradingView embed builds its iframe asynchronously after the script
		// loads. If the effect is torn down first (StrictMode double-mount, fast
		// navigation), the script still runs and attaches listeners to an iframe
		// that is no longer in the document -> "contentWindow is not available".
		// Deferring the injection lets cleanup cancel it before it ever starts.
		const timer = window.setTimeout(() => {
			container.innerHTML = `<div class="tradingview-widget-container__widget" style="width: 100%; height: ${height}px;"></div>`;

			const script = document.createElement("script");
			script.src = scriptUrl;
			script.async = true;
			script.innerHTML = configKey;
			container.appendChild(script);
		}, 0);

		return () => {
			window.clearTimeout(timer);
			container.innerHTML = "";
		};
	}, [scriptUrl, configKey, height]);

	return containerRef;
};
export default useTradingViewWidget;
