"use client";

interface SettingsTabsProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
}

const tabs = [
	{ id: "account", label: "Account" },
	{ id: "profile", label: "Investment Profile" },
	{ id: "notifications", label: "Notifications" },
];

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
	return (
		<div className="border-b">
			<nav className="container max-w-3xl" aria-label="Settings tabs">
				<ul className="-mb-px flex gap-4 overflow-x-auto sm:gap-8">
					{tabs.map((tab) => {
						const isActive = activeTab === tab.id;
						return (
							<li key={tab.id}>
								<button
									type="button"
									onClick={() => onTabChange(tab.id)}
									className={`inline-flex whitespace-nowrap border-b-2 px-2 py-4 text-sm font-medium transition-colors sm:px-4 ${
										isActive
											? "border-primary text-primary"
											: "border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground"
									}`}
									aria-current={isActive ? "page" : undefined}
								>
									{tab.label}
								</button>
							</li>
						);
					})}
				</ul>
			</nav>
		</div>
	);
}
