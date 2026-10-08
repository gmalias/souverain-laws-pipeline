// sources/gesetze.js
// www.gesetze-im-internet.de (BMJ/BSt resmî) — düz HTML, bot koruması yok.
// Madde sayfası DOM'u:
//   <h1> <a name="BJNR…"/><a href="index.html#…">Nichtamtliches Inhaltsverzeichnis</a>
//        <span class="jnenbez">§ 51</span> <span class="jnentitel">Titel</span></h1>
//   <div class="jnhtml"> <div class="jurAbsatz">(1) …</div> … </div>
// "Einzelnorm" (tek madde) görünümü — tam yasa sayfasını çekmeye gerek yok.

import * as $ from 'cheerio';
import { fetchText, sleep } from './common.js';

const BASE = 'https://www.gesetze-im-internet.de';

function clean(s) {
	return (s || '')
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Tek maddeyi çeker.
 * @param {{slug:string, number:string, lawName?:string}} t
 *   slug:    site path prefixi (stgb, hgb, patg, asylvfg_1992 …)
 *   number:  madde numarası metni (203, 242, 5, 51 …)
 * @returns {Promise<{sectionLabel:string, title:string, content:string, url:string}>}
 */
export async function fetchGesetze({ slug, number, lawName }) {
	const url = `${BASE}/${slug}/__${number}.html`;
	const html = await fetchText(url);
	const root = $.load(html);

	// h1: jnenbez = article number, jnentitel = article title
	let sectionLabel = clean(root('h1 .jnenbez').first().text());
	let title = clean(root('h1 .jnentitel').first().text());
	if (!sectionLabel) {
		const h1 = clean(root('h1').first().text());
		sectionLabel = (h1.match(/\u00a7\s?\d+.*$/)?.[0] || h1).trim();
	}
	if (!title) {
		// some articles have an EMPTY jnentitel (e.g. PatG s. 5) -> first absatz prefix
		const first = clean(root('div.jurAbsatz').first().text());
		title = first.slice(0, 90).trim() + (first.length > 90 ? ' \u2026' : '' );
	}
	if (!sectionLabel || !title) {
		throw new Error(`gesetze: unexpected structure (section=${sectionLabel || 'none'} title=${title || 'none'}) ${url}`);
	}

	const content = clean(
		root('div.jnhtml').find('div.jurAbsatz').map((i, el) => clean(root(el).text())).get().join(' '),
	);
	if (content.length < 60) throw new Error(`gesetze: içerik şüpheli kısa (${content.length} ç) ${url}`);

	await sleep(1500); // kibar istek aralığı
	return { sectionLabel, title, content, url };
}
