// transform/normalize.js
// Çekilen ham maddeleri laws.json şemasına döker + boyut üst sınırı uygular.
// Cihaz tarafında (lawUpdater.lawsToPromptContext) toplam 6000 ç limit var;
// madde başına MAX_CONTENT kadar içerik taşınır (kelime sınırından kırpılır).

export const MAX_CONTENT = 2200;

/** Kelime sınırından kırp (sözcük ortasından asla kesme). */
export function capText(text, max = MAX_CONTENT) {
	const t = (text || '').trim();
	if (t.length <= max) return t;
	const cut = t.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).trim() + ' …';
}

/**
 * Manifest kaydı + çekilen ham veri → laws.json maddesi.
 * @param {object} entry    manifest kaydı (id, code, market, sector, sourceNote)
 * @param {object} scraped  {sectionLabel, title, content, url}  (ya da fallback için {content})
 * @param {boolean} usedFallback
 */
export function normalizeLaw(entry, scraped, usedFallback = false) {
	return {
		id: entry.id,
		code: entry.code,
		section: scraped.sectionLabel || entry.sectionLabel,
		title: scraped.title || entry.sectionLabel,
		market: entry.market,
		sector: entry.sector,
		content: capText(scraped.content),
		source: usedFallback ? `derlenmiş özet referans (kaynak erişilemedi; ${entry.sourceNote || ''})`.trim() : entry.sourceNote || '',
		fullTextUrl: scraped.url,
	};
}
