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
 * Lazy Playwright başlat (tek chromium örneği; ölürse yeniden doğar).
 * Makinede tarayıcı yoksa `npx playwright install chromium` gerekir.
 */
export async function getBrowser() {
	// 2026.10.08 düzeltmesi: cache'li örnek ÖLÜMSE (çökme/Target closed) sıfırla.
	// Önceki sürüm ölü browser'ı sonsuza dek yeniden kullanıyordu; retry'lar
	// hep aynı ölü örnek üstüne gidip "browser.newPage: Target closed" diyordu.
	if (_pw && !_pw.isConnected()) {
		await _pw.close().catch(() => {});
		_pw = null;
	}
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
					args: [
						'--no-sandbox',
						'--disable-dev-shm-usage',
						// Cloudflare Turnstile `navigator.webdriver` vektörünü maskele
						'--disable-blink-features=AutomationControlled',
					],
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
 *
 * Cloudflare Turnstile (2026.10.08 itibarıyla legifrance.gouv.fr'nin koruması):
 * challenge sayfası ("Un instant…" / "Just a moment…") gelirse, otomatik çözülecek
 * kadar bekler; çözülmüyorsa NET HATA döner (main, manifest fallback'ine düşer).
 *
 * @returns {Promise<{ok:boolean, html?:string, error?:string}>}
 */
export async function browserFetch(url, { timeoutMs = 45000, challengeWaitMs = 20000 } = {}) {
	try {
		const browser = await getBrowser();
		const page = await browser.newPage({
			userAgent: UA,
			locale: 'fr-FR',
			extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
		});
		try {
			// Turnstile, `navigator.webdriver` vektörünü denetler — maskele
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
			});
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
			// Challenge otomatik çözülene (gerçek tarayıcı + temiz IP'de mümkün) kadar bekle
			const t0 = Date.now();
			for (;;) {
				await page.waitForTimeout(1500);
				const title = await page.title().catch(() => '');
				if (!/un instant|just a moment|bir an/i.test(title)) break;
				if (Date.now() - t0 > challengeWaitMs) break;
			}
			const html = await page.content();
			if (
				/cdn-cgi\/challenge-platform|challenges\.cloudflare\.com|cf-chl/i.test(html) ||
				/Un instant|Just a Moment/i.test(html)
			) {
				return { ok: false, error: `bot duvari: Cloudflare challenge sayfası dönüyor ${url}` };
			}
			return { ok: true, html };
		} finally {
			await page.close();
		}
	} catch (e) {
		return { ok: false, error: e.message };
	}
}
