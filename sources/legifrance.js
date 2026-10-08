// sources/legifrance.js
// Légifrance — Fransa Adalet Bakanlığı resmî kodlar. Akamai bot koruması nedeniyle
// gerçek tarayıcı (Playwright) gerekir.
//
// Strateji:
//   1) liste sayfasını (texte_lc) tarayıcıda aç
//   2) sayfada searchInPage ("R. 731-21") yazan ilk linke tıkla
//   3) madde sayfasında içerik bloğunu seç (kandit seçiciler + expectContent skoru)
//
// Legifrance DOM'u sürüm sürüm değiştiği için seçiciler BIR KAÇ aday içerir;
// içerik "hangi blokta expectContent var ve en kısa o" heuristiğiyle seçilir.
// Erişilemezlikte kaynak modülü HATA FIRLATIR; main, manifestte fallbackContent
// varsa ona düşer, yoksa pipeline durur (push engellenir).

import * as $ from 'cheerio';
import { browserFetch, sleep } from './common.js';

const CANDIDATE_SELECTORS = [
	'div[class*="article"]',
	'div[id^="art_"]',
	'div.j_article',
	'div.article',
	'div[class*="content-article"]',
	'art',
	'div[class*="bloc"]',
];

function clean(s) {
	return (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {{url:string, searchInPage?:string, expectContent?:string, sectionLabel?:string}} t
 * @returns {Promise<{sectionLabel:string, title:string, content:string, url:string}>}
 */
export async function fetchLegifrance({ url, searchInPage, expectContent, sectionLabel }) {
	const res = await browserFetch(url);
	if (!res.ok) throw new Error(`legifrance: tarayıcı erişimi başarısız: ${res.error}`);
	let root = $.load(res.html);

	// 2) sayfa içi madde linkini bul + tıkla (playwright DOM'u üzerinde)
	//    -- burada sayfa DOM'u cheerio içinde olduğu için linki "href" olarak çekip
	//       ikinci bir browserFetch ile açıyoruz (tıklama yerine navigasyon).
	let articleHtml = res.html;
	let articleUrl = url;
	if (searchInPage) {
		const link = root('a')
			.filter((i, el) => clean(root(el).text()).includes(searchInPage))
			.first()
			.attr('href');
		if (link) {
			const abs = new URL(link, url).href;
			articleUrl = abs;
			const r2 = await browserFetch(abs);
			if (!r2.ok) throw new Error(`legifrance: madde sayfası başarısız: ${r2.error}`);
			articleHtml = r2.html;
			root = $.load(articleHtml);
			await sleep(1500);
		} else {
			// liste sayfasında link yoksa (sayfa doğrudan madde olabilir) devam et
		}
	}

	// 3) içerik bloğunu seç
	const blocks = [];
	for (const sel of CANDIDATE_SELECTORS) {
		root(sel).each((i, el) => {
			const text = clean(root(el).text());
			if (text.length > 80) blocks.push({ el, text, len: text.length });
		});
	}
	// skor: expectContent içeriyor (+1000) → en kısa bloğu tercih et
	blocks.sort((a, b) => {
		const sa = a.text.includes(expectContent || '\u0000') ? 0 : 1;
		const sb = b.text.includes(expectContent || '\u0000') ? 0 : 1;
		return sa !== sb ? sa - sb : a.len - b.len;
	});
	const best = blocks[0];
	if (!best) throw new Error(`legifrance: hiçbir içerik bloğu bulunamadı ${articleUrl}`);

	const content = best.text;
	if (expectContent && !content.includes(expectContent)) {
		throw new Error(`legifrance: içerikte beklenen ipucu yok ("${expectContent}") ${articleUrl}`);
	}

	const title = clean(
		root('h1').first().text() ||
			root('.page-title').first().text() ||
			(sectionLabel ? `${sectionLabel}` : 'Article'),
	);
	const label =
		(clean(root('h1').first().text()).match(/(?:^|\s)((?:L|R|art\.?)\.?\s?\d[\w.\-]*)/i)?.[1] ||
			sectionLabel) ??
		'';

	return { sectionLabel: label || sectionLabel, title, content, url: articleUrl };
}
