// sources/gdpr.js
// dsgvo-gesetz.de — ABRG (Reg. 2016/679) Almanca resmî metin.
// DOM: <h1 class="entry-title"><span class="dsgvo-number">Art. 5 DSGVO</span>
//      <span class="dsgvo-title">Grundsätze …</span></h1>
//      <div class="entry-content"><ol><li>…</li></ol>…</div>
// İçeride "empfehlung-erwaegungsgruende" (gerekçeler) bloğu var — istenmez, elenir.

import * as $ from 'cheerio';
import { fetchText, sleep } from './common.js';

function clean(s) {
	return (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {{url:string}} t
 * @returns {Promise<{sectionLabel:string, title:string, content:string, url:string}>}
 */
export async function fetchGdpr({ url }) {
	const html = await fetchText(url);
	const root = $.load(html);

	root('div.empfehlung-erwaegungsgruende').remove();

	let sectionLabel = clean(root('span.dsgvo-number').first().text());
	let title = clean(root('span.dsgvo-title').first().text());
	if (!sectionLabel || !title) {
		// tema değişikliğine karşı yedek: h1'i ayrıştır
		const h1 = clean(root('h1.entry-title').first().text());
		const m = h1.match(/^(Art\.?\s*\d+[^\s]*)(.*)$/i);
		if (m) {
			sectionLabel = m[1];
			title = m[2].trim();
		}
	}
	if (!sectionLabel || !title) throw new Error(`gdpr: yapı beklenenden farklı ${url}`);

	const content = clean(root('div.entry-content').text());
	if (content.length < 60) throw new Error(`gdpr: içerik şüpheli kısa (${content.length} ç) ${url}`);

	await sleep(1500);
	return { sectionLabel, title, content, url };
}
