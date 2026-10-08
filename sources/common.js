// sources/common.js
// Ortak altyapı: kibar HTTP (UA + retry + gecikme) + Playwright (Legifrance için).

import { setTimeout as sleep } from 'node:timers/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

export const DEFAULT_UA = UA;
export { sleep };

/**
 * Retry'li GET (düz HTTP). 3 deneme, üstel backoff.
 * @returns {string} gövde metni
 */
export async function fetchText(url, { retries = 3, timeoutMs = 30000, ua = UA } = {}) {
	let lastErr;
	for (let i = 0; i < retries; i++) {
		try {
			const ctrl = new AbortController();
			const t = setTimeout(() => ctrl.abort(), timeoutMs);
			const res = await fetch(url, {
				signal: ctrl.signal,
				headers: {
					'User-Agent': ua,
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'de,fr;q=0.8,en;q=0.6',
					'Referer': 'https://www.gesetze-im-internet.de/',
				},
			});
			clearTimeout(t);
			if (res.status === 403 || res.status === 429) {
				throw new Error(`HTTP ${res.status} (bot koruması?) ${url}`);
			}
			if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
			return await res.text();
		} catch (e) {
			lastErr = e;
			if (i < retries - 1) await sleep(1500 * 2 ** i);
		}
	}
	throw lastErr;
}

let _pw;
/**
 * Lazy Playwright başlat (tek chromium örneği).
 * Makinede tarayıcı yoksa `npx playwright install chromium` gerekir.
 */
export async function getBrowser() {
	if (!_pw) {
		let pw;
		try {
			pw = await import('playwright');
		} catch {
			pw = await import('playwright-core');
		}
		const browsers = ['chromium', 'chrome', 'msedge'];
		let lastErr;
		for (const name of browsers) {
			try {
				_pw = await pw.chromium.launch({
					headless: true,
					channel: name === 'chromium' ? undefined : name,
					args: ['--no-sandbox', '--disable-dev-shm-usage'],
				});
				return _pw;
			} catch (e) {
				lastErr = e;
			}
		}
		throw new Error(
			'Hiçbir tarayıcı bulunamadı (chromium/msedge). Docker içinde otomatik kurulur; ' +
				`yerel deneme için: npx playwright install chromium — son hata: ${lastErr.message}`,
		);
	}
	return _pw;
}

/**
 * Legifrance gibi JS/bot korumalı sayfaları gerçek tarayıcıyla alır.
 * @returns {{ok:boolean, html?:string, error?:string}}
 */
export async function browserFetch(url, { timeoutMs = 45000 } = {}) {
	try {
		const browser = await getBrowser();
		const page = await browser.newPage({
			userAgent: UA,
			locale: 'fr-FR',
			extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
		});
		try {
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
			await page.waitForTimeout(1200); // JS render için
			return { ok: true, html: await page.content() };
		} finally {
			await page.close();
		}
	} catch (e) {
		return { ok: false, error: e.message };
	}
}
