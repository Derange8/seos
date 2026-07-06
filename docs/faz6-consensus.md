# Faz 6 — Query consensus / confidence

> Kurul kararı. Red-team #2: ürünün merkez vaadi "kanıtlanabilir görünürlük"
> ama bir sorgunun slot'u 3-5 sample'ın plurality'siyle belirleniyor ve
> **ne kadar kararlı olduğu gösterilmiyor**. "3/4 OPEN" ile "kesin OPEN" aynı
> görünüyor. Bir rakip "sizin 'kazandın'ınız gürültü" derse haklı olur.
> Bu MVP: her sorguya bir **consensus** (dominant slot'taki sample oranı)
> ekler, düşük-consensus sorguları "kararsız" işaretler.

---

## 0. Bugünkü durum (kod gerçeği)

- `dominantSlot(slots)` bir plurality kararı: 4 sample'ın 2'si OPEN, 1 CONTESTED,
  1 MENTIONED → "MENTIONED" (tie'da MENTIONED kazanır). **Kaç sample'ın dominant
  slot'ta olduğu (kararlılık) hiçbir yerde yüzeye çıkmıyor.**
- `scorecard` ham % veriyor (mentionedPct vb.), güven/kararlılık yok.
- `winnableQueries` = dominant slot OPEN olan sorgular — ama "2/4 OPEN" gibi
  zayıf bir sinyalle bir sorguyu "kazanılabilir fırsat" diye sunmak yanıltıcı.
- Örneklem küçük: DEFAULT_SAMPLES=3, MAX_SAMPLES=5.

**Boşluk:** Kanıt iddiası örneklem kararlılığını göstermeden yapılıyor. Kullanıcı
"kararsız" bir okumayı "kesin" sanabilir ve zayıf sinyalle aksiyon alabilir.

## 1. Problem

3-5 sample'da bir sorgunun slot'u run-to-run değişebilir (LLM non-deterministik
— zaten çok-örnekleme bu yüzden var). Plurality kararı doğru ama **güveni
olmadan** sunulunca yanıltıcı: "%75 OPEN" (3/4) ile "%40 OPEN" (2/5) çok farklı
kesinlikte ama ikisi de sadece "OPEN" görünüyor.

## 2. Kullanıcıya sağladığı değer

Her sorguda "bu okuma ne kadar kesin" netliği. Düşük-consensus sorgular
"kararsız — daha fazla örnekle" diye işaretlenir; kullanıcı zayıf sinyalle
yanlış aksiyon almaz. Kanıt iddiası (rapor) dürüstleşir.

## 3. Bu gerçekten çözülmeli mi?

**Evet, ama dar.** Tam Wilson/binomial güven aralığı 3-5 sample'da çok geniş
çıkar (±%30+) ve kullanıcıya karmaşık gelir — [[feedback_seos_scope_discipline]].
Basit, okunabilir bir **consensus oranı** (dominant slot'taki sample / toplam)
3-5 sample için doğru araç. Tam istatistik gerekirse sample sayısını artırıp
sonra eklenir.

## 4. En doğru çözüm

Query seviyesinde bir **consensus** = dominant slot'taki sample sayısı / toplam
sample. Bir eşik (örn. < 0.6) altındaki sorgular "kararsız/low-confidence".
Scorecard bu sorguları ayrı sayar; `winnableQueries` yalnızca **yeterli
consensus'lu** OPEN sorguları içerir (zayıf sinyali fırsat diye sunmaz).

## 5. Teknik mimari

- **Domain (`slot.ts`):** yeni saf fonksiyon `slotConsensus(slots)` → dominant
  slot'taki oranı (0..1) döndürür. `dominantSlot`'la aynı tie-kuralını kullanır
  (tutarlılık). Boş slots → 0.
- **Bir eşik sabiti** `CONFIDENCE_THRESHOLD = 0.6` (domain'de, tek yerde).
  `isConfident(slots)` = `slotConsensus(slots) >= threshold && slots.length>0`.
- **Scorecard:** her outcome için consensus zaten query DTO'da; scorecard'a
  `lowConfidenceQueries: string[]` (consensus eşiğin altında olanlar) ekle.
  `winnableQueries`: `dominantSlot===OPEN && isConfident` — düşük-consensus OPEN
  artık winnable sayılmaz (ayrı "belirsiz" grupta).
- **DTO:** `AiVisibilityQueryDto`'ya `consensus: number` (0..1) +
  `confident: boolean`.
- **Report/UI:** düşük-consensus sorguları "(kararsız — X% consensus)" etiketle;
  winnable listesi yalnızca güvenli fırsatları gösterir.

## 6. UI/UX

- Per-query satırda consensus rozeti (örn. "75%" veya "kararsız").
- Rapor: winnable bölümü güvenli olanları listeler; ayrı "Uncertain queries
  (measure again)" bölümü opsiyonel.
- Yeni ekran yok.

## 7. Veri modeli

**Değişiklik YOK.** Consensus, saklanan `slots[]`'tan türetilir (scorecard/DTO
build zamanında hesaplanır). Migration yok.

## 8. API akışı

Yeni endpoint yok. Mevcut probe/GET akışları consensus'u DTO'da taşır.

## 9. Risk analizi

- **Eşik keyfiliği:** 0.6 makul (3/5, 2/3 üstü) ama tek sabit, tek yerde —
  ayarlaması kolay. Testlerle sınır davranışı sabitlenir.
- **winnable daralması:** bazı sorgular artık winnable görünmez → doğru,
  zayıf sinyali fırsat sanmak daha kötü. "Uncertain" grubu görünür kalır.
- **Tek sample (samplesPerQuery=1):** consensus hep 1.0 (tek sample kendine
  %100 consensus). Dürüst mü? Evet — tek örnekle "kararlılık" kavramı yok;
  ama kullanıcı 1 sample seçtiyse zaten güven beklemiyor. Not düşülür.

## 10. Kullanıcıya / AI Visibility / Rakip etkisi

- **AI Visibility:** doğrudan ölçüm katkısı yok ama **kanıt kalitesini**
  yükseltir — ürünün merkez vaadi.
- **Rakip:** "sizin kazandın'ınız gürültü" saldırısını kapatır; consensus
  gösteren bir AEO aracı yok.

## 11. MVP

**Dahil:** `slotConsensus` + `isConfident` + eşik (domain, testli); scorecard
`lowConfidenceQueries` + winnable filtresi; DTO consensus/confident; report/UI
consensus etiketi.
**Hariç:** Wilson/binomial aralık, delta anlamlılık testi, adaptif örnekleme
(düşük-consensus'ta otomatik daha çok sample) — hepsi sonra.

## 12. Future Evolution

Adaptif örnekleme: bir sorgu düşük-consensus'sa otomatik daha çok sample al
(consensus stabilize olana dek). Delta anlamlılığı: iki run arası hareketin
örneklem gürültüsünü aşıp aşmadığı (before/after kanıtını sağlamlaştırır).

## 13. Karar

✅ **Yap** — query consensus/confidence (dar MVP).
⚠ Wilson aralığı / adaptif örnekleme / delta anlamlılığı: sonra.
