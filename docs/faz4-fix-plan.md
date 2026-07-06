# Faz 4 — Visibility Fix Plan (close the autonomous loop)

> Kurul kararı. Sprint: Observe→Verify arası boş kalan Diagnose→Generate'i
> otomatikleştir, Apply'a tek onay kapısı koy, Verify'ı gerçek eyleme (publish)
> bağla. Ürünü "AI Search Analyst"ten "AI Search Engineer"a taşıyan adım.

---

## 0. Bugünkü durum (kod gerçeği)

Otonom döngü (Observe→Diagnose→Plan→Generate→Validate→Apply→Verify→Learn):
- **Observe** ✅ otomatik (scheduler `runProbe` web_grounded)
- **Diagnose** ⚠️ yalnızca manuel ("Why not?" tıklaması → `diagnose-visibility-gap`)
- **Generate** ⚠️ yalnızca manuel ("Draft" tıklaması → `generate-citation-content`)
- **Apply** ⚠️ manuel, WordPress DRAFT (`publish-citation-content`)
- **Verify** ✅ otomatik (scheduler `resolveExperiments`) AMA **yanlış tetikleniyor**:
  experiment `draft` route'unda açılıyor (niyet), `publish`te değil (eylem).
- **Learn** ❌ yok (cross-project aggregate kod sıfır) — bu sprint dışı.

**İki boşluk:** (1) Diagnose→Generate arası tamamen elle → kullanıcı Observe'da
durup eyleme geçmiyor. (2) Verify, gerçek eylemi değil niyeti ölçüyor → taslak
çekip yayınlamayan kullanıcı sahte "UNCHANGED" üretiyor, kanıt bütünlüğü zayıf.

## 1. Problem

Ürün ölçüyor ama eyleme çevirmiyor. AI görünürlüğü ancak içerik yayınlanınca
artar; bugün yayınlamaya giden yol 3 ayrı manuel tıklama (Why not? → Draft →
Publish) ve kullanıcı aralarını kendi kafasında birleştiriyor. Sürtünme, ölçümü
eyleme dönüştürmeyi engelliyor.

## 2. Kullanıcıya sağladığı değer

3 zihinsel adım → **1 karar**: "bu planı onayla". Üçüncü Altın Kural'ın
somutlaşması — kullanıcı SEO uzmanı değil, hedefini söyler, SEOS planlar.

## 3. Bu gerçekten çözülmeli mi?

**Evet — ama TAM otonomi DEĞİL.** İnsan onayı olmadan siteye yazan ajan yanlış
hedef (ilk kötü içerikte güven ölür). WordPress-DRAFT tercihi doğru, korunur.
Çözülen şey otomasyon değil **sürtünme**: Diagnose+Generate otomatik hazırlanır,
insan yalnızca **onay kapısında** durur.

## 4. En doğru çözüm

**BuildFixPlanUseCase** — bir web_grounded probe run'ının en kazanılabilir
sorguları için diagnose+generate'i otomatik zincirler, kullanıcıya sorgu-bazında
hazır taslak + tek onay kapısı sunar. Apply (publish) ve Verify (experiment)
onay sonrası tetiklenir.

## 5. Teknik mimari

**Yeni motor yok, orkestrasyon var.** Mevcut use-case'leri zincirler.

```ts
// src/application/ai-visibility/use-cases/build-fix-plan-use-case.ts
interface FixPlanItem { query: string; gaps: string[]; draft: CitationDraft; }
interface FixPlan { items: FixPlanItem[]; skipped: string[]; }

class BuildFixPlanUseCase {
  // deps: runRepository, diagnose UseCase, generate UseCase, logger
  async execute(projectId: string, maxItems = 5): Promise<FixPlan>
}
```

- Kaynak sorgular: son run'ın **winnableQueries** (dominantSlot=OPEN, en yüksek
  kazanım şansı). Yoksa contested'e düşülebilir — MVP'de sadece winnable.
- Her sorgu için: `diagnose(projectId, query)` → gaps, sonra
  `generate(projectId, query, gaps)` → draft. Partial-failure toleransı: bir
  sorgu üretimi patlarsa `skipped`e ekle, kalanı sürdür (probe use-case'teki
  aynı dürüstlük).
- **Üst sınır (maxItems=5):** maliyet patlamasını önler (her item 2 LLM çağrısı).
- **Web_grounded gate:** yalnızca web_grounded run sonrası anlamlı (citation
  kazanımı ancak orada ölçülür); parametric run'da fix-plan sunma.

**Verify tetikleyici taşıması:** `StartVisibilityExperiment` çağrısını `draft`
route'undan `publish` route'una taşı. Deney artık gerçek yayında açılır. Yorum
"drafting is the observable act" → "publishing is the act".

## 6. UI/UX

Mevcut AI Visibility kartına ekleme, yeni ekran yok:
- Probe sonrası (web_grounded, winnable sorgu varsa) bir **"Prepare fix plan"**
  butonu. Tıklanınca sorgu-bazında hazır taslak listesi.
- Her item: sorgu + teşhis özeti + taslak önizleme + **"Approve & publish"**
  butonu (mevcut publish akışını çağırır → WordPress DRAFT + experiment açılır).
- İnsan yalnızca onay kapısında durur; geri kalan otomatik.

## 7. Veri modeli

**Değişiklik YOK.** FixPlan persist edilmez (draft gibi on-demand). Verify
taşıması da şema değiştirmez — sadece tetikleyici yeri değişir.

## 8. API akışı

- `POST /api/v1/projects/[id]/ai-visibility/fix-plan` → BuildFixPlanUseCase →
  FixPlan döner. (Yalnızca son run web_grounded ise; değilse 409/açıklayıcı hata.)
- Onay: mevcut `publish` route (experiment açma buraya taşınır).

## 9. Risk analizi

- **Maliyet:** maxItems=5 + yalnızca winnable + yalnızca web_grounded sonrası → sınırlı.
- **Kalitesiz taslak:** onay kapısı insanı tutar, otomatik canlıya gitmez.
- **Verify taşıması geriye-uyum:** mevcut açık deneyler bozulmaz (davranış
  ileriye dönük; migration yok).

## 10. Kullanıcıya / AI Visibility / Rakip etkisi

- **AI Visibility:** doğrudan en yüksek — ölçümü eyleme çevirir, citation
  kazanımı ancak yayınla olur.
- **Rakip farkı:** Ahrefs/Semrush AEO'da hâlâ rapor üretiyor (Observe+Diagnose);
  kimse Generate→Apply→Verify zincirini kapatmıyor. Bu sprint o zinciri kapatır.

## 11. MVP

**Dahil:** BuildFixPlanUseCase (winnable, max 5, web_grounded gate,
partial-tolerant) + testler; Verify tetikleyici draft→publish; fix-plan route;
UI "Prepare fix plan" + onay kapısı.
**Hariç:** tam otonomi (auto-publish), Learn/aggregate, multi-CMS, contested
sorgular için plan (sonra), istatistiksel anlamlılık (ayrı sprint).

## 12. Future Evolution

Publish onayı → scheduler zaten N gün sonra web_grounded re-probe yapıyor →
citation kazanımı otomatik kanıtlanır (Faz 1-2 döngüsü kapanır). Sonraki en
kritik karar (red-team): **multi-engine ölçüm** (Gemini/Perplexity) — tek-motor
ölçüm ürünün en kolay saldırılabilir noktası. Learn/collective en son.

## 13. Karar

✅ **Yap** — Visibility Fix Plan (Diagnose→Generate otomasyonu + onay kapısı +
Verify tetikleyici düzeltmesi).
❌ Auto-publish (insansız): reddedildi, güveni öldürür.
⚠ Learn/aggregate: erken, dağıtım ölçeğinden sonra.
