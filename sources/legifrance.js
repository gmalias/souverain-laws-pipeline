// sources/legifrance.js
// Légifrance — Fransa Adalet Bakanlığı resmî kodlar.
//
// 2026.10.08 durumu: alan adı Cloudflare (Turnstile challenge) arkasında.
// Duvar IP itibarına göre davranır: TR'dan tüm kanallar 403/challenge; AB'dan
// (MQ70) gerçek tarayıcı geçebilir. Kaynak modülü HATA FIRLATIR; main,
// manifestteki fallbackContent'a düşer.
//
// Strateji:
//   1) liste sayfasını (texte_lc) tarayıcıda aç (challenge bekleme + 2 deneme)
//   2) sayfada searchInPage ("R. 731-21") yazan ilk linki ikinci navigasyonla aç
//   3) madde sayfasında içerik bloğunu seç (kandit seçiciler + expectContent skoru)
//
// Legifrance DOM'u sürüm sürüm değiştiği için seçiciler BIR KAÇ aday içerir;
// içerik "hangi blokta expectContent var ve en kısa o" heuristiğiyle seçilir.

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
 * Challenge/403 geçici olabildiği için 2 deneme + 5 sn backoff.
 * İkinci denemede de başarısızsa net hata fırlatılır (main fallback'e düşer).
 */
async function browserFetchRetry(url) {
	let res = await browserFetch(url);
	if (!res.ok) {
		await sleep(5000);
		const again = await browserFetch(url);
		if (again.ok) return again;
		throw new Error(`legifrance: tarayıcı erişimi başarısız: ${again.error} ${url}`);
	}
	return res;
}

/**
 * @param {{url:string, searchInPage?:string, expectContent?:string, sectionLabel?:string}} t
 * @returns {Promise<{sectionLabel:string, title:string, content:string, url:string}>}
 */
export async function fetchLegifrance({ url, searchInPage, expectContent, sectionLabel }) {
	const res = await browserFetchRetry(url);
	let root = $.load(res.html);

	// 2) sayfa içi madde linkini bul; href'i çekip ikinci navigasyonla aç
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
			const r2 = await browserFetchRetry(abs);
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
		(clean(root('h1').first().text()).match(/(?:^|\s)((?:L|R|art\.?)\.\s?\d[\w.\-]*)/i)?.[1] ||
			sectionLabel) ??
		'';

	return { sectionLabel: label || sectionLabel, title, content, url: articleUrl };
}
