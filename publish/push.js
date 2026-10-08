// publish/push.js
// GitHub push — git tabanlı (diff/commit geçmişi izlenebilir).
// Token: GITHUB_TOKEN env (ya da `gh auth token`). Clone URL'ine gömülür;
// .env ASLA repoya girmez (.gitignore'da).
//
// Akış:
//   clone --depth 1 → mevcut laws.json okunur → yeni yazılır →
//   (içerik birebir ayni VEYA sürüm aynı) → "değişiklik yok" (push YOK) →
//   git add/commit/push

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TARGET_REPO = process.env.LAWS_REPO || 'gmalias/souverain-laws';
const FILES = { laws: 'laws.json' };

function getToken() {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
	try {
		return execSync('gh auth token', { encoding: 'utf8' }).trim();
	} catch {
		throw new Error('GITHUB_TOKEN env set et (ya da `gh auth login`)');
	}
}

/**
 * @param {string} newJson  laws.json içeriği (JSON string)
 * @param {{dryRun?:boolean}} opts
 * @returns {{pushed:boolean, reason:string, sha?:string}}
 */
export function pushLaws(newJson, { dryRun = false } = {}) {
	const token = dryRun ? 'unused' : getToken();
	const dir = mkdtempSync(join(tmpdir(), 'laws-pipeline-'));
	try {
		const remote = dryRun
			? `https://github.com/${TARGET_REPO}.git`
			: `https://x-access-token:${token}@github.com/${TARGET_REPO}.git`;
		execSync(
			`git clone --depth 1 ${remote} work 2>/dev/null && cd work && git config user.name "souverain-laws-pipeline" && git config user.email "souverain-laws-pipeline@users.noreply.github.com"`,
			{ cwd: dir, stdio: 'pipe' },
		);
		const work = join(dir, 'work');
		const old = new TextDecoder().decode(
			execSync(`git show HEAD:${FILES.laws}`, { cwd: work, encoding: 'buffer' }),
		).trim();
		if (old === newJson.trim()) {
			return { pushed: false, reason: 'değişiklik yok (laws.json birebir aynı)' };
		}

		writeFileSync(join(work, FILES.laws), newJson);
		const diff = execSync('git diff --stat', { cwd: work, encoding: 'utf8' });
		if (dryRun) {
			return { pushed: false, reason: 'dry-run (push yapılmadı)', diff };
		}

		const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
		execSync('git add laws.json', { cwd: work });
		execSync(
			`git commit -m "Mevzuati yenile (souverain-laws-pipeline, ${date})"`,
			{ cwd: work },
		);
		execSync('git push origin HEAD', { cwd: work, stdio: 'pipe' });
		const sha = execSync('git rev-parse --short HEAD', { cwd: work, encoding: 'utf8' }).trim();
		return { pushed: true, reason: 'ok', sha, diff };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
