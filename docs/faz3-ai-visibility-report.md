# Faz 3 — Paylaşılabilir AI Visibility Report

> Kurul tasarım dokümanı. Henüz kod değil.
> Amaç: Faz 1 (web-grounded + citation) ve Faz 2 (citation-aware before/after)
> verisini tek, paylaşılabilir bir "AI Visibility Report"ta birleştirmek —
> CMO'ya, ajans müşterisine, bir ticket'a veya bir LLM'e tek seferde
> yapıştırılabilir kanıt.

---

## 0. Bugünkü durum (kod gerçeği)

- Dashboard AI Visibility kartı zaten **run + trend + experiments** DTO'larının
  hepsini yükl��yor (`aiVisibility`, `aiVisibilityTrend`, `experiments`).
- `format-audit-report.ts` + dashboard'daki `navigator.clipboard.writeText(...)`
  audit için **çalışan bir "raporu kopyala" deseni** — yeni bir mekanizma
  icat etmeye gerek yok, aynısını AI Visibility için tekrarla.
- Faz 1/2 sayesinde veri zengin: scorecard (mention %'leri + citedPct),
  groundingMode, per-query citations, delta (citedPctDelta dahil),
  citation-aware experiment outcome'ları (GAINED/IMPROVED).

**Boşluk:** Bütün bu kanıt yalnızca uygulama içinde, dağınık kartlarda yaşıyor.
Kurumsal alıcı "skor" değil, **dışa aktarılabilir, sunulabilir before/after
kanıt** ister. Şu an bir kullanıcı bunu elle kopyalayıp derleyemez.

## 1. Problem

Yapılan işin değeri (AI aramasında görünürlük kazanımı) uygulamanın dışına
taşınamıyor. Bir ajans müşterisine, bir yöneticiye "şu düzeltmeyi yaptık, bu
sorgu OPEN→CITED oldu, mention %'in şu kadar arttı" diye gösterebileceği tek
bir metin/rapor yok. Bu, ürünün ürettiği kanıtı görünmez kılıyor — SaaS'ın
"değerini kanıtla" katmanı eksik.

## 2. Kullanıcıya sağladığı değer

- **Sunulabilir kanıt:** Tek tıkla panoya kopyalanan, doküman/e-posta/ticket'a
  yapıştırılabilir rapor. Ajanslar için müşteriye rapor, in-house için CMO'ya
  ROI kanıtı.
- **Before/after özeti:** "Şu tarihte ölçtük, şunu yaptık, tekrar ölçtük, şu
  kazanıldı" — misyonun "sonucu tekrar doğrula" döngüsünün insan-okur çıktısı.
- **Sıfır yeni öğrenme:** Audit raporunu kopyalamayı zaten bilen kullanıcı
  aynı jesti burada da kullanır.

## 3. Teknik mimari

`format-audit-report.ts`'nin birebir analoğu: saf, test edilebilir bir
formatlayıcı.

```ts
// src/lib/format-ai-visibility-report.ts
export function formatAiVisibilityReport(
  domain: string,
  run: AiVisibilityRunDto,          // en son probe (scorecard, groundingMode, per-query)
  trend: AiVisibilityTrendPointDto[], // zaman serisi (oldest-first)
  experiments: VisibilityExperimentDto[] // before/after ledger
): string
```

Girdi zaten DTO — domain katmanına dokunmaz, yeni fetch yok. Dashboard'da
kart başlığına bir "Copy report" butonu; `navigator.clipboard.writeText(
formatAiVisibilityReport(...))`, audit'teki satırın aynısı.

Rapor bölümleri (plain text, LLM/doküman dostu):
1. **Başlık:** `Seos AI Visibility Report — <domain> — <tarih>`
2. **Ölçüm modu:** web search mi memory mi (citation sayıları bu bağlamda okunur).
3. **Scorecard:** Mentioned/Open/Contested %, ve web_grounded ise Cited %.
4. **Since last run (delta varsa):** mention/open/contested/cited hareketi.
5. **Winnable + contested sorgular:** hangi sorgularda açık fırsat, hangilerinde
   rakip kazanıyor (rakip frekansıyla).
6. **Before/after kazanımları (experiments):** RESOLVED deneyler — baseline→outcome,
   citation kazanımı (🔗) işaretli, IMPROVED/UNCHANGED/REGRESSED.
7. **Per-query kaynaklar (opsiyonel/özet):** cited sorgular için domain kaynak
   gösterildi mi.

## 4. UI/UX tasarımı

Yeni ekran YOK. AI Visibility kartının başlık aksiyonuna (mevcut Suggest/Measure
butonlarının yanına) bir **"Copy report"** butonu. Tıklanınca panoya kopyalar,
kısa bir "Copied" geri bildirimi (audit'teki kopyala butonlarıyla aynı pattern).
Rapor yalnızca en az bir probe run varken etkin.

## 5. Veri modeli

**Değişiklik YOK.** Rapor tamamen mevcut DTO'lardan türetilir. Migration yok,
yeni tablo yok.

## 6. API akışı

**Yeni endpoint YOK.** Dashboard zaten run/trend/experiments'i yüklüyor; rapor
bu state'ten client-side üretilir. (Sunucu tarafı üretim gerekmez — veri zaten
istemcide.)

## 7. Edge case'ler

- **Hiç run yok:** buton disabled (audit "copy" gibi).
- **Parametric run:** citation bölümlerini "not measured (memory-only run)"
  olarak yaz, sıfır citation'ı "kazanım yok" gibi göstermeden — Faz 1/2'deki
  dürüstlük ilkesiyle tutarlı.
- **Delta yok (ilk run):** "since last run" bölümünü atla.
- **Hiç resolved experiment yok:** before/after bölümünü "no completed
  experiments yet" ile geç.
- **Çok uzun sorgu listesi:** audit raporundaki gibi makul kısaltma (örn. ilk N
  + "…").

## 8. Güvenlik riskleri

Yeni dış girdi/çıktı yok; veri zaten istemcide ve panoya kopyalanıyor
(kullanıcının kendi eylemi). Rapor metni düz metin — HTML/script enjeksiyonu
yüzeyi yok. Risk: ihmal edilebilir.

## 9. Performans etkisi

İhmal edilebilir — istemcide zaten var olan veriden bir string üretimi, tek
sefer, kullanıcı tıklayınca.

## 10. MVP kapsamı

**Dahil:**
- `formatAiVisibilityReport(domain, run, trend, experiments)` saf fonksiyon.
- Dashboard'da "Copy report" butonu + kopyalandı geri bildirimi.
- Parametric/no-delta/no-experiment edge-case'lerini dürüst ele alma.
- Testler: rapor bölümlerinin doğru üretimi, parametric'te citation'ın
  "not measured" olarak yazılması, boş durumlar.

**Hariç (MVP değil):**
- PDF/HTML export (düz metin panoya kopya yeterli; PDF gerekirse Faz 3.5).
- Marka/logo'lu şık rapor şablonu.
- Sunucu tarafı rapor kalıcılığı/paylaşım linki.

## 11. Gelecekte genişletme

- **PDF/HTML export:** aynı formatlayıcının çıktısını yerel PDF'e (Electron'un
  kendi print-to-PDF'i, dış bağımlılık yok) dökmek.
- **Zaman aralığı seçimi:** "son 30 gün" gibi trend penceresi.
- **Çok-proje toplu rapor:** ajanslar için tüm projelerin özeti.
- **Paylaşım linki (deferred):** collective/cloud layer geldiğinde sunucu
  tarafı kalıcı, paylaşılabilir rapor URL'i.
```
