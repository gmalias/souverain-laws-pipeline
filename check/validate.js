// check/validate.js
// Draft laws.json'u push ÖNCESİ doğrular. Bir tek başarısız denetim → push BLOKE.
// Denetimler:
//   1) sürüm formatı  YYYY.MM.DD
//   2) id'ler manifestle birebir aynı küme (sıra dahil)
//   3) zorunlu alanlar + market/sector sözlüğü
//   4) duplicate id
//   5) içerik uzunluk penceresi (60 < len ≤ MAX_CONTENT)
//   6) expectTitle / expectContent drift ipuçları

import { MAX_CONTENT } from '../transform/normalize.js';

const VERSION_RE = /^\d{4}\.\d{2}\.\d{2}$/;
const MARKETS = new Set(['DE', 'FR', 'both']);
const SECTORS = new Set(['LEGAL', 'PATENT', 'ACCOUNTING', 'both']);

/**
 * @param {object} draft    {version, laws:[…]}
 * @param {object[]} manifest  kaynak manifest
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validate(draft, manifest) {
	const errors = [];

	if (!VERSION_RE.test(draft.version || '')) {
		errors.push(`sürüm formatı geçersiz: "${draft.version}" (beklenen YYYY.MM.DD)`);
	}
	if (!Array.isArray(draft.laws)) {
		errors.push('"laws" bir dizi değil');
		return { ok: false, errors };
	}

	// 2) id kümesi manifestle birebir
	const mIds = manifest.map((m) => m.id);
	const dIds = draft.laws.map((l) => l.id);
	if (JSON.stringify(mIds) !== JSON.stringify(dIds)) {
		errors.push(`id listesi manifestle uyuşmuyor:\n  manifest: ${mIds.join(', ')}\n  draft:    ${dIds.join(', ')}`);
	}

	// 4) duplicate id
	const seen = new Set();
	for (const l of draft.laws) {
		if (seen.has(l.id)) errors.push(`duplicate id: ${l.id}`);
		seen.add(l.id);
	}

	for (const l of draft.laws) {
		const m = manifest.find((x) => x.id === l.id);
		// 3) zorunlu alanlar
		for (const field of ['id', 'code', 'section', 'title', 'market', 'sector', 'content']) {
			if (!l[field]) errors.push(`${l.id}: eksik alan "${field}"`);
		}
		if (!MARKETS.has(l.market)) errors.push(`${l.id}: geçersiz market "${l.market}"`);
		if (!SECTORS.has(l.sector)) errors.push(`${l.id}: geçersiz sector "${l.sector}"`);
		// 5) içerik uzunluk penceresi
		const n = (l.content || '').length;
		if (n < 60) errors.push(`${l.id}: içerik şüpheli kısa (${n} ç)`);
		if (n > MAX_CONTENT + 5) errors.push(`${l.id}: içerik üst sınırı aşıyor (${n} ç > ${MAX_CONTENT})`);
		// 6) drift ipuçları
		if (m?.expectTitle && !(l.title || '').includes(m.expectTitle)) {
			errors.push(`${l.id}: başlıkta beklenen ipucu yok ("${m.expectTitle}") — madde değişmiş olabilir: "${l.title}"`);
		}
		if (m?.expectContent && !(l.content || '').includes(m.expectContent)) {
			errors.push(`${l.id}: içerikte beklenen ipucu yok ("${m.expectContent}") — kaynak yapısı/kaynak değişmiş olabilir`);
		}
	}

	return { ok: errors.length === 0, errors };
}
