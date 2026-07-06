# Faz 6.5 — Adaptive sampling (auto-resolve uncertain queries)

> Kurul kararı. Faz 6 bir sorgunun "kararsız" olduğunu gösteriyor ama
> çözümü kullanıcıya bırakıyor ("tekrar ölç"). İkinci Altın Kural: "bunu neden
> kullanıcı yerine AI yapmıyor?" Bu MVP: düşük-consensus bir sorgu, consensus
> stabilize olana (veya bir üst sınıra) kadar OTOMATİK daha çok sample alır.

---

## 0. Bugünkü durum (kod gerçeği)

- `run-ai-visibility-probe-use-case`: her sorgu için sabit `for i <
  samplesPerQuery` (DEFAULT 3, MAX 5). Tüm sorgular aynı sabit sayıda örneklenir.
- Faz 6: `slotConsensus`/`isConfident` ile bir sorgunun kararlılığı ölçülüyor;
  düşük olanlar "uncertain" işaretleniyor — ama kullanıcı elle re-measure etmeli.
- `run.samplesPerQuery` entity/DTO'da tek sayı olarak saklanıyor.

**Boşluk:** Ürün bir sorgunun kararsız olduğunu BİLİYOR ama kendisi çözmüyor —
kullanıcıyı manuel tekrar-ölçmeye bırakıyor. Otonomi ilkesine aykırı, ve
kararsız sorgular kanıt kalitesini düşürmeye devam ediyor.

## 1. Problem

Sabit örnekleme iki yönden verimsiz: kararlı sorgular için gereğinden çok
(3 sample'da 3/3 zaten kesin), kararsız sorgular için gereğinden az (2/1 split'i
çözmek daha çok sample ister). Kullanıcı hangi sorgunun daha çok örnek
gerektirdiğini bilemez — ama sistem bilebilir.

## 2. Kullanıcıya sağladığı değer

Kararsız sorgular otomatik netleşir; kullanıcı hiçbir şey yapmaz. Kanıt
kalitesi, manuel müdahale olmadan yükselir (Üçüncü Altın Kural: kullanıcı SEO
uzmanı değil, sistem halleder).

## 3. Bu gerçekten çözülmeli mi?

**Evet, ve dış bağımlılık yok.** Kalan diğer maddeler (paralel motor, multi-CMS,
Learn) dış anahtar/settings-mimarisi/ölçek gerektiriyor. Adaptif örnekleme
mevcut döngüye temiz oturuyor, mevcut OpenAI anahtarıyla canlı doğrulanabilir,
ve Faz 6'nın (consensus) doğrudan üstüne inşa oluyor.

## 4. En doğru çözüm

Sabit `for i < samplesPerQuery` yerine: **min sample al, consensus yeterliyse
dur, değilse max'a kadar birer birer ekle.** `samplesPerQuery` artık "min
target"; yeni `maxSamplesPerQuery` üst sınır. Consensus `isConfident` eşiğini
geçince erken durur (kararlı sorguda gereksiz çağrı yok); geçmezse max'a kadar
dener (kararsız sorguya daha çok bütçe).

## 5. Teknik mimari

- **Use-case:** `RunAiVisibilityProbeDeps`'e `maxSamplesPerQuery?` ekle
  (default = samplesPerQuery, yani adaptif kapalıysa bugünkü davranış). Sorgu
  döngüsü:
  ```
  while (slots.length < max) {
    sample → push
    if (slots.length >= minTarget && isConfident(slots)) break; // erken dur
  }
  ```
  Min'e ulaşmadan asla durmaz (küçük N'de sahte kesinlik olmasın); min'den
  sonra confident olunca durur; hiç confident olmazsa max'ta durur.
- **Partial-failure:** mevcut retry/skip mantığı korunur — başarısız sample
  `slots`'a eklenmez, döngü `slots.length`'e göre ilerler (başarısızlar
  bütçeyi değil, sadece denemeyi tüketir → ayrı bir attempt-cap gerekebilir,
  aşağıda edge-case).
- **Entity/DTO:** `samplesPerQuery` "min target" olarak kalır (anlamı
  belgelenir); gerçek alınan sayı zaten `slots.length` (per-query). İstenirse
  DTO'ya per-query `sampleCount` (= slots.length) eklenebilir — ama consensus
  zaten bunu ima ediyor, MVP'de opsiyonel.

## 6. UI/UX

- Route/settings: opsiyonel "adaptif" (varsayılan açık) — ama MVP'de sadece
  default'ları ayarla, yeni UI kontrolü şart değil. Kararsız sorgu sayısı
  doğal olarak düşer; kullanıcı farkı "daha az ⚠ uncertain" olarak görür.
- Yeni ekran yok.

## 7. Veri modeli

**Değişiklik YOK.** samplesPerQuery zaten var (anlamı "min" olur). Per-query
slot sayısı zaten slots[]'ta. Migration yok.

## 8. API akışı

Mevcut probe route: `samplesPerQuery` (min) + yeni opsiyonel `maxSamplesPerQuery`.
Default: min=3, max=5 (bugünkü MAX). Adaptif kapatmak için max=min gönder.

## 9. Risk analizi

- **Maliyet:** adaptif MAX'ı aşamaz → üst sınır korunur. Kararlı sorgular
  min'de durur (daha UCUZ). Net etki: bütçe kararsız sorgulara kayar, toplam
  MAX×query'yi geçmez.
- **Sonsuz döngü / başarısız sample:** bir sorgu sürekli hata verirse `while
  slots.length < max` asla ilerlemez → **attempt-cap gerekli**: toplam deneme
  (başarılı+başarısız) `max + buffer`'ı aşınca dur. Test edilecek.
- **Erken durma yanlışlığı:** min'e ulaşmadan durmaz; min sonrası confident
  olunca durur — bu doğru (kesinlik sağlandı, daha fazlası israf).

## 10. Kullanıcıya / AI Visibility / Rakip etkisi

- **AI Visibility:** kanıt kalitesi otomatik yükselir; kararsız sorgu azalır.
- **Rakip:** kimse consensus-driven adaptif örnekleme yapmıyor; "biz sadece
  kesinleşene kadar ölçüyoruz" satılabilir bir kanıt hikayesi.

## 11. MVP

**Dahil:** use-case adaptif döngü (min→max, consensus erken-dur, attempt-cap)
+ testler (erken dur, max'a kadar git, attempt-cap, adaptif-kapalı=bugünkü
davranış); route maxSamplesPerQuery default'ları.
**Hariç:** per-query sampleCount DTO/UI (opsiyonel), consensus eşiğini
kullanıcıya açma, Wilson aralığı.

## 12. Future Evolution

Delta anlamlılığı (before/after gürültü vs gerçek), consensus eşiğini/max'ı
ayarlanabilir yapma, per-query bütçeyi maliyet-farkındalıklı dağıtma.

## 13. Karar

✅ **Yap** — adaptif örnekleme (min→max, consensus-driven).
⚠ Paralel motor / multi-CMS / Learn: dış bağımlılık veya ölçek gerektiriyor,
sonra.
