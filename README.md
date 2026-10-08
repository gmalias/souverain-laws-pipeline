# Souverain Laws Pipeline

**Kullanım kılavuzu** — SouverainAI için resmi mevzuat kaynaklarını haftalık tarayan, doğrulayan ve `souverain-laws` reposuna push eden Docker tabanlı pipeline.

> ⚠️ **Yasal uyarı:** `laws.json` içerikleri resmi kaynaklardan **otomatik derlenen özet referans metinleridir**, resmi tam kanun metni DEĞİLDİR. Uygulamanın kendi uyarı notu bunu aynen taşır.

## Ne yapar?

1. `src/manifest.js` listesindeki maddeleri resmi kaynaklardan çeker:
   | Madde | Kaynak |
   |-------|--------|
   | StGB § 203, AsylG § 3, PatG § 5, HGB § 242 | `gesetze-im-internet.de` (BMJ/BSt) |
   | GDPR Art. 5 (Almanca) | `dsgvo-gesetz.de` (EUR-Lex bot duvarı için) |
   | CESEDA R. 731-21, Code de commerce L. 123-7 | `legifrance.gouv.fr` (Playwright) |

> **Not (2026.10.08):** Legifrance in Cloudflare (Turnstile) bot duvari arkasinda; duvar IP itibarina gore davranir. TR IP'den 12 kanal denendi (curl, Playwright headless+headful, jina reader, Wayback SPN, data.gouv, api alt-domaini...) — tumu challenge'da. FR maddeleri kaynakta erisilemezse manifestteki elle hazirlanmis fallback ile korunur; MQ70 (AB IP) duvari asarsa FR metinleri otomatik olarak resmi metinlere gecer.
2. Normalize eder (saha + 2200 char üst sınır/madde).
3. `check/validate.js` kapısı: sürüm formatı, id kümesi, alan sözlükleri, drift ipuçları — **başarısız → push BLOKE**.
4. Değişiklik varsa `souverain-laws/laws.json`'u git ile commit + push (sürüm = bugünün tarihi `YYYY.MM.DD`).

## Kurulum (MQ70)

```bash
# 1) Docker kuruluysa (kılavuzdaki systemd adımları)
git clone git@github.com:gmalias/souverain-laws-pipeline.git
cd souverain-laws-pipeline
cp .env.example .env   # içine fine-grained PAT'ini yapıştır

# 2) İlk build (chromium ~500 MB indirir; bir kez)
docker compose build

# 3) Kuru test (push YOK, diff gösterir)
docker compose run --rm pipeline node src/main.js crawl --dry-run

# 4) Gerçek çalıştırma
docker compose run --rm pipeline
```

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `node src/main.js crawl` | çek → doğrula → diff → push |
| `node src/main.js crawl --dry-run` | aynısı ama push yok (diff konsola) |
| `node src/main.js check <file>` | bir laws.json dosyasını doğrula |

## Haftalık otomatik (MQ70)

systemd timer (haftada 1, Pazartesi 03:00):

```ini
# /etc/systemd/system/souverain-laws.timer
[Unit]
Description=Souverain laws weekly crawl
[Timer]
OnCalendar=Mon 03:00
Persistent=true
[Install]
WantedBy=timers.target
```
```ini
# /etc/systemd/system/souverain-laws.service
[Unit]
Description=Souverain laws crawl
[Service]
WorkingDirectory=/opt/souverain-laws-pipeline
EnvironmentFile=/opt/souverain-laws-pipeline/.env
ExecStart=/usr/bin/docker compose run --rm pipeline
```
```
sudo systemctl daemon-reload && sudo systemctl enable --now souverain-laws.timer
```

## Mevzuata yeni madde ekle

1. `src/manifest.js`'e kayıt ekle (`id`, `source`, `code`, `sectionLabel`, `market`, `sector`, `url`, drift ipuçları).
2. `node src/main.js crawl --dry-run` → diff'i incele.
3. Onaylıyorsan: `node src/main.js crawl` → push.
4. Cihaz tarafında: uygulamanın "Güncelle" düğmesi sürümü fark edip otomatik indirir.

## Güvenlik kapıları

| Kapı | Ne engeller |
|------|-------------|
| URL whitelist (manifest) | Açık URL tarama |
| `--max-concurrency 1`, 1.5 sn istek aralığı | Rate limit |
| `GITHUB_TOKEN` `.env` içinde | Token sızıntısı (`.gitignore`'lu) |
| `validate.js` (push öncesi) | Bozuk/tuzağa dönüşen içeriğin dağıtımı |
| Diff boşsa push yok | Gereksiz sürüm şişirimi |
| Kaynak erişilemezse | Fallback içerik varsa kullanılır; yoksa push BLOKE |

## Sorun giderme

| Belirti | Muhtemel neden |
|---------|----------------|
| `legifrance: tarayıcı erişimi başarısız` | Chromium eksik — container içinde `npx playwright-core install chromium` |
| `HTTP 403` | Kaynak bot koruması güçlendirdi — kaynağı `fetch`'ten Playwright'a taşı |
| Doğrulama: "içerikte beklenen ipucu yok" | Yasal madde değişmiş ya da site DOM'u değişmiş — manifestteki `expect*` ipuçlarını ve kaynağı incele |
| Push başarısız | PAT süresi/kapsamı: `https://github.com/settings/tokens` → `repo` scope |
