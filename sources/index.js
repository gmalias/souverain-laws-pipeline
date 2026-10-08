// sources/index.js — kaynak dispatch
import { fetchGesetze } from './gesetze.js';
import { fetchGdpr } from './gdpr.js';
import { fetchLegifrance } from './legifrance.js';

const SOURCES = {
	gesetze: fetchGesetze,
	gdpr: fetchGdpr,
	legifrance: fetchLegifrance,
};

/**
 * Manifest kaydının kaynağından maddeni çeker.
 * @param {object} entry manifest kaydı ({source, url, searchInPage, sectionLabel…})
 * @returns {Promise<{sectionLabel, title, content, url}>}
 */
export async function fetchEntry(entry) {
	const fn = SOURCES[entry.source];
	if (!fn) throw new Error(`bilinmeyen kaynak: ${entry.source} (${entry.id})`);
	const slug = entry.url.match(/gesetze-im-internet\.de\/([^/]+)\/__([^./]+)\.html/);
	return fn(
		entry.source === 'gesetze'
			? { slug: slug?.[1], number: slug?.[2], lawName: entry.code, ...entry }
			: entry,
	);
}
