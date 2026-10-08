// src/main.js — pipeline orkestrasyonu
//
//   node src/main.js crawl            # çek + doğrula + diff + push
//   node src/main.js crawl --dry-run  # çek + doğrula + diff GÖSTER (push yok)
//   node src/main.js check <file>     # bir laws.json'u doğrula (push yok)
//
// Güvenlik kapıları (sıra önemli):
//   crawl → normalize → VALIDATE (başarısız → push BLOKE) → diff (boş → no-op) → push

import { readFileSync } from 'node:fs';
import { MANIFEST } from './manifest.js';
import { fetchEntry } from '../sources/index.js';
import { normalizeLaw } from '../transform/normalize.js';
import { validate } from '../check/validate.js';
import { pushLaws, TARGET_REPO } from '../publish/push.js';

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (!isDirectRun) process.exit(0); // orchestration only when run directly

const args = process.argv.slice(2);
const cmd = args[0] || 'crawl';
const dryRun = args.includes('--dry-run');

if (cmd === 'check') {
	const file = args[1];
	if (!file) {
		console.error('kullanım: node src/main.js check <laws.json>');
		process.exit(2);
	}
	const draft = JSON.parse(readFileSync(file, 'utf8'));
	const { ok, errors } = validate(draft, MANIFEST);
	console.log(ok ? '✓ doğrulama geçti' : `✗ ${errors.length} hata:`);
	for (const e of errors) console.log('  - ' + e);
	process.exit(ok ? 0 : 1);
}

if (cmd !== 'crawl') {
	console.error(`bilinmeyen komut: ${cmd} (beklenen: crawl | check)`);
	process.exit(2);
}

// --- crawl ---
const laws = [];
const failures = [];
for (const entry of MANIFEST) {
	try {
		const scraped = await fetchEntry(entry);
		laws.push(normalizeLaw(entry, scraped));
		console.log(`  ✓ ${entry.id.padEnd(18)} ${scraped.content.length.toLocaleString('tr-TR').padStart(6)} ç  ${scraped.url}`);
	} catch (e) {
		if (entry.fallbackContent) {
			const fb = { content: entry.fallbackContent, url: entry.url };
			laws.push(normalizeLaw(entry, fb, true));
			console.log(`  ⚠ ${entry.id.padEnd(17)} kaynağa erişilemedi → fallback içerik kullanıldı (${e.message.slice(0, 60)})`);
		} else {
			failures.push({ id: entry.id, error: e.message });
			console.log(`  ✗ ${entry.id.padEnd(18)} BAŞARISIZ (fallback yok): ${e.message}`);
		}
	}
}

if (failures.length > 0) {
	console.error(`\n✗ ${failures.length} kaynak başarısız (fallback'siz) — push BLOKE, son iyi sürüm korunur:`);
	for (const f of failures) console.error(`   - ${f.id}: ${f.error}`);
	process.exit(1);
}

// sürüm: bugünün tarihi (cihaz === karşılaştırması tetiklenir)
const today = new Date();
const version = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
const draft = { version, laws };

// --- doğrulama kapısı ---
const { ok, errors } = validate(draft, MANIFEST);
if (!ok) {
	console.error(`\n✗ doğrulama başarısız — push BLOKE (${errors.length} hata):`);
	for (const e of errors) console.error('  - ' + e);
	process.exit(1);
}
console.log(`\n✓ doğrulama geçti — sürüm ${version}, ${laws.length} madde`);

// --- diff + push ---
const newJson = JSON.stringify(draft, null, 2) + '\n';
const result = pushLaws(newJson, { dryRun });
if (result.diff) {
	console.log('\n── diff ──\n' + result.diff);
}
if (!result.pushed) {
	console.log(`\n→ push yapılmadı: ${result.reason}`);
	process.exit(0);
}
console.log(`\n✓ push edildi: ${TARGET_REPO || 'gmalias/souverain-laws'} @ ${result.sha} (sürüm ${version})`);
console.log('  cihaz tarafında: uygulama "Güncelle" ile yeni sürümü çekecek.');
