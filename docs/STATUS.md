# Seos — AI Visibility Platform: Status & Remaining Roadmap

Son güncelleme: 2026-07-07. Bu doküman, tamamlanan çalışmayı ve kalan
maddelerin neden **bilinçle ertelendiğini** özetler — gelecek oturumlar
körlemesine devam etmesin diye.

## Ürünün bugünkü hali

Seos, bir sitenin AI arama motorlarında (ChatGPT/Claude/Gemini) ne kadar
önerildiğini ölçen, kanıtlayan ve iyileştiren otonom bir platform. Otonom döngü
(Observe→Diagnose→Generate→Apply→Verify→Learn) — Learn hariç — kapalı.

## Tamamlanan fazlar (hepsi live-verified + pushed)

| Faz | Ne | Doküman |
|-----|-----|---------|
| 1 | Web-grounded probe + citation tracking | `faz1-web-grounded-probe.md` |
| 2 | Citation-aware before/after experiments | `faz2-citation-aware-experiments.md` |
| 3 | Paylaşılabilir AI Visibility Report | `faz3-ai-visibility-report.md` |
| — | delta sahte-citation-kazanımı bug fix | (code review) |
| 4 | Visibility Fix Plan (Diagnose→Generate otomasyonu + onay kapısı) | `faz4-fix-plan.md` |
| 5 | Engine axis (her ölçüm hangi motorda yapıldı) | `faz5-engine-axis.md` |
| 6 | Query consensus/confidence (gürültülü okumayı işaretle) | `faz6-consensus.md` |
| 6.5 | Adaptive sampling (kararsız sorguyu otomatik çöz) | `faz6.5-adaptive-sampling.md` |
| 7 | Gemini adapter (3. gerçek ölçüm motoru) | `faz7-gemini.md` |
| 5.5 | Parallel multi-engine (tek tıkla 3 motor karşılaştırma) | `faz5.5-parallel-multi-engine.md` |
| 5.6 | Auto-pilot multi-engine (otomatik ölçüm de 3 motorda) | (bu doküman) |

Test: 193 dosya, 1089 test. 3 gerçek motor: OpenAI, Anthropic, Gemini.

## Kalan maddeler — neden ERTELENDİ

Kurul disiplini gereği bunlar körlemesine yapılmadı; her biri bir dış bağımlılık
veya ölçek/ürün kararı bekliyor. Başlamadan önce ilgili kararı kullanıcıyla
netleştir.

### 1. Derin istatistiksel anlamlılık (Wilson interval / delta significance)
**Durum: ⚠ Beklet.** Faz 6 (consensus) + Faz 6.5 (adaptive) bunun MVP'sini zaten
karşıladı. 3-5 sample'da bir Wilson güven aralığı ±%30+ çıkar — kullanıcıya
karmaşık ve yanıltıcı. Anlamlı bir güven aralığı için önce sample sayısını
büyütmek gerekir ki bu maliyet kararıdır. Değer/maliyet oranı düşük.

### 2. Multi-CMS Apply (Webflow / Shopify / custom siteler)
**Durum: ⚠ Beklet.** Bugün Apply yalnızca WordPress (REST API + Application
Passwords). Her yeni CMS **ayrı bir entegrasyon** (auth modeli, içerik API'si,
revert mantığı hepsi farklı). Bu, teknik değil **pazar/ürün kararı**: hangi
CMS'in kullanıcı tabanı var? Ölçüm katmanı zaten CMS-agnostik; sadece Apply
bağlı. Gerçek kullanıcı talebi görülmeden yapılmamalı.

### 3. Learn / collective-aggregate
**Durum: ❌ Reddet (erken).** "Hangi fix tipi hangi sektörde citation
kazandırıyor" toplu modeli, ürünün en büyük savunulabilir moat'ı. AMA anlamlı
bir aggregate için **dağıtım ölçeği** (çok proje/çok veri) gerekiyor ki henüz
yok. Şimdi inşa edilirse boş bir istatistik olur. Citation-aware experiment
verisi (Faz 2) bunun substratı olarak zaten toplanıyor — hazır olduğunda
üstüne gelir.

### 4. Gemini free-tier limiti
**Not:** Mevcut Gemini anahtarı `gemini-2.0-flash`'te free-tier-limit-0;
`gemini-2.5-flash` çalışıyor (adapter onu kullanıyor). Yoğun kullanımda kota
sorunu olursa ücretli tier veya farklı model gerekebilir.

## Öneri

Ürün olgun ve tutarlı bir noktada. Bir sonraki gerçek adım için en değerli
girdi **gerçek kullanıcı geri bildirimi** — hangi motor karşılaştırması işe
yarıyor, hangi CMS talep ediliyor, Fix Plan çıktıları yeterince iyi mi. Bu
veri gelmeden yeni büyük özellik eklemek, kurulun "özellik sayısı başarı
değildir" ilkesine aykırı olur.
