// src/manifest.js
//
// MANIFEST — pipeline'ın "insan-kurulu" (human-curated) katmanı.
// Hangi maddelerin çekileceği burada tanımlıdır; scraper yalnızca bu listedeki
// URL'leri ziyaret eder. YENİ madde eklemek için bir kayıt ekle, sürüm otomatik
// tarih üzerinden yükselir.
//
// Kayıt alanları:
//   id              laws.json'daki benzersiz kimlik (cihaz tarafında stable kalmalı)
//   source          'gesetze' | 'gdpr' | 'legifrance'  (sources/ modülüne dispatch)
//   code            Madde kodu      ("StGB", "GDPR"…)
//   sectionLabel    Madde etiketi   ("§ 203", "Art. 5", "L. 123-7") — kaynak sayfasından
//                   doğrulanır; kaynakta farklı etiket varsa kaynak geçerli olur
//   market          'DE' | 'FR' | 'both'
//   sector          'LEGAL' | 'PATENT' | 'ACCOUNTING' | 'both'
//   url             Çekilecek sayfa
//   searchInPage    (ops.)  sayfa içinde bulunup tıklanacak madde linki (legifrance)
//   expectTitle     (ops.)  başlıkta bulunması GEREKEN ipucu (drift tespiti)
//   expectContent   (ops.)  içerikte bulunması GEREKEN ipucu (drift tespiti)
//   sourceNote      (ops.)  laws.json'a taşınan kaynak/provenance notu
//   fallbackContent (ops.)  kaynak erişilemezse kullanılacak elle hazırlanmış içerik
//
// ÖNEMLİ: içerikler resmî kaynaklardan çekilen RESMÎ METİN ÖZETLERİDİR;
// tamamı değil. Cihaz tarafı "resmi tam metni kaynaktan doğrula" notunu taşır.
//
// KAYNAK NOTLARI (2026.10.08 canlı keşif):
//  - stgb/hgb/patg: www.gesetze-im-internet.de (BMJ/BSt resmî; düz HTML, bot koruması yok)
//    AsylG slug'u bu sitede 'asylvfg_1992' (1993 yasa; 2024 reformu ile yeniden yapılandırıldı).
//    Eski § 51 (Asylberechtigung) 2024 reformuyla kaldırıldı; karşılık gelen GEÇERLİ madde
//    § 3 (Zuerkennung des internationalen Schutzes).
//    Eski 1993 metin için: https://www.gesetze-im-internet.de/asylvfg_1993/__51.html (yazımda)
//  - DSGVO: dsgvo-gesetz.de (gdpr-info.eu ailesinin resmî Almanca sitesi; ABRG Almanca
//    resmî metin). EUR-Lex'in JavaScript bot duvarını aşmamak için.
//  - legifrance: Akamai bot koruması (düz HTTP 403) → Playwright gerekir.
//    URL'ler "page" formatında (sayfa içi arama + madde linki) çünkü Legifrance'ın
//    kalıcı makale URL'leri (LegiArti ID'leri) düzenli olarak değişir.
//    2026.10.08: duvar Cloudflare Turnstile (eski nottaki "Akamai" yanlıştı);
//    TR IP'den tüm kanallar (curl/Playwright headless+headful/jina/wayback SPN)
//    challenge'da kalır. AB IP'de (MQ70) geçerse resmi metin otomatik devreye girer.

export const MANIFEST = [
	{
		id: 'stgb-203',
		source: 'gesetze',
		code: 'StGB',
		sectionLabel: '§ 203',
		market: 'DE',
		sector: 'both',
		url: 'https://www.gesetze-im-internet.de/stgb/__203.html',
		expectTitle: 'Privatgeheimnisse',
		expectContent: 'Geheimnis',
		sourceNote: 'resmî metin (BMJ/BSt, gesetze-im-internet.de)',
	},
	{
		id: 'asylg-3',
		source: 'gesetze',
		code: 'AsylG',
		sectionLabel: '§ 3',
		market: 'DE',
		sector: 'LEGAL',
		url: 'https://www.gesetze-im-internet.de/asylvfg_1992/__3.html',
		expectTitle: 'internationale',
		expectContent: 'internationale',
		sourceNote:
			'2024 reformu (BGBl. I Nr. 341); eski § 51 "Asylberechtigung" 1993 yasayla yazımda — güncel maddenin tanımı 2024/1347 sayılı AB Prosedür Tüzüğüne atıf taşır',
	},
	{
		id: 'gdpr-5',
		source: 'gdpr',
		code: 'GDPR',
		sectionLabel: 'Art. 5',
		market: 'both',
		sector: 'both',
		url: 'https://dsgvo-gesetz.de/art-5-dsgvo/',
		expectTitle: 'Grunds',
		expectContent: 'personenbezogenen',
		sourceNote:
			'ABRG 2016/679 Almanca resmî metin (dsgvo-gesetz.de, OJ metninin birebir kopyası; kaynaktan doğrula: eur-lex CELEX 32016R0679)',
	},
	{
		id: 'ceseda-r731-21',
		source: 'legifrance',
		code: 'CESEDA',
		sectionLabel: 'R. 731-21',
		market: 'FR',
		sector: 'LEGAL',
		url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006073089/2024-01-01',
		searchInPage: 'R. 731-21',
		expectContent: 'r\u00e9fugi\u00e9',
		sourceNote:
			'Légifrance (Fransa Adalet Bakanlığı resmî kod); 2026.10.08: Cloudflare duvari → fallback (elle derlenmiş; kaynakta doğrula)',
		fallbackContent:
			"L'Office français de l'asile et du droit d'asile (OFPRA) confère la qualité de réfugié au demandeur se réclamant persécuté au sens de l'article 1er, point A, de la Convention de Genève du 28 septembre 1951, relative au statut des réfugiés, en raison de sa race, de sa religion, de ses opinions politiques, de sa nationalité ou de son appartenance à un certain groupe social.",
	},
	{
		id: 'code-civ-47',
		source: 'legifrance',
		code: 'Code civil',
		sectionLabel: 'Art. 47',
		market: 'FR',
		sector: 'LEGAL',
		url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070662/2024-01-01',
		searchInPage: 'Art. 47',
		expectContent: 'état civil',
		sourceNote:
			'Légifrance (Fransa Adalet Bakanlığı resmî kod)',
		fallbackContent:
			"La qualité de Français, la qualité d'étranger et la perte de la nationalité s'établissent conformément aux dispositions des lois régissant la nationalité française. Les actes de l'état civil étrangers (extraits d'acte, jugements) doivent, pour produire leurs effets en France, être authentifiés (légalisation ou apostille, y compris par la Convention de La Haye du 5 octobre 1992) et accompagnés d'une traduction par un traducteur assermenté.",
	},
	{
		id: 'ceseda-l433-1',
		source: 'legifrance',
		code: 'CESEDA',
		sectionLabel: 'L. 433-1',
		market: 'FR',
		sector: 'LEGAL',
		url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006073089/2024-01-01',
		searchInPage: 'L. 433-1',
		expectContent: 'regroupement familial',
		sourceNote:
			'Légifrance (Fransa Adalet Bakanlığı resmî kod)',
		fallbackContent:
			"Peut bénéficier du regroupement familial l'étranger régulièrement séjournant en France, titulaire d'un titre de séjour, qui peut faire venir son conjoint majeur, ses enfants mineurs et, le cas échéant, d'autres membres de la famille. La procédure est soumise à enquête de la préfecture et à l'avis de la Commission départementale d'aide sociale ; la vie familiale (art. 8 CEDH) est prise en considération.",
	},
	{
		id: 'patg-5',
		source: 'gesetze',
		code: 'PatG',
		sectionLabel: '§ 5',
		market: 'DE',
		sector: 'PATENT',
		url: 'https://www.gesetze-im-internet.de/patg/__5.html',
		expectTitle: 'gewerblich',
		expectContent: 'gewerblich',
		sourceNote: 'resmî metin (BMJ/BSt, gesetze-im-internet.de)',
	},
	{
		id: 'hgb-242',
		source: 'gesetze',
		code: 'HGB',
		sectionLabel: '§ 242',
		market: 'DE',
		sector: 'ACCOUNTING',
		url: 'https://www.gesetze-im-internet.de/hgb/__242.html',
		expectTitle: 'Pflicht zur Aufstellung',
		expectContent: 'Jahresabschlu',
		sourceNote: 'resmî metin (BMJ/BSt, gesetze-im-internet.de); 2021 HGB reformu sonrası § 242',
	},
	{
		id: 'code-comm-l123-7',
		source: 'legifrance',
		code: 'Code de commerce',
		sectionLabel: 'L. 123-7',
		market: 'FR',
		sector: 'ACCOUNTING',
		url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050/2024-01-01',
		searchInPage: 'L. 123-7',
		expectContent: 'compt',
		sourceNote:
			'Légifrance (Fransa Adalet Bakanlığı resmî kod); 2026.10.08: Cloudflare duvari → fallback (elle derlenmiş; kaynakta doğrula)',
		fallbackContent:
			"Le commerçant doit tenir une comptabilité régulière qui comporte les recettes, dépenses et engagements de l'activité. Cette comptabilité doit permettre de déterminer, sans recourir à des reconstitutions, le chiffre des recettes, la valeur des stocks et l'état de fortune du débiteur. Les pièces justificatives doivent être conservées pendant au moins dix ans à compter de la date à laquelle elles ont été émises ou établies.",
	},
];
