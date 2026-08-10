import { getIdxNews } from "@/lib/idx/news";

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "Asia/Jakarta",
});

const IdxNewsSection = async () => {
	const news = await getIdxNews(10);

	return (
		<div className="w-full">
			<h3 className="font-semibold text-2xl text-gray-100 mb-5">
				Berita Saham IDX
			</h3>
			<div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: 600 }}>
				{news.length === 0 && (
					<p className="text-gray-500 text-sm">
						Berita tidak tersedia saat ini. Coba lagi nanti.
					</p>
				)}
				{news.map((article) => (
					<a
						key={article.id}
						href={article.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors p-4"
					>
						<div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
							<span className="text-yellow-500 font-medium">{article.source}</span>
							<span>·</span>
							<time dateTime={article.publishedAt}>
								{timeFormatter.format(new Date(article.publishedAt))} WIB
							</time>
						</div>
						<p className="text-gray-100 font-medium leading-snug line-clamp-2">
							{article.title}
						</p>
						{article.summary && (
							<p className="text-gray-400 text-sm mt-1 line-clamp-2">{article.summary}</p>
						)}
					</a>
				))}
			</div>
		</div>
	);
};

export default IdxNewsSection;
