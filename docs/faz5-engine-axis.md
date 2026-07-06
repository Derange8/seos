# Faz 5 — Engine axis (multi-engine measurement, MVP)

> Kurul kararı. Red-team'in #1 yarası: ürün "AI'da görünürlük" ölçüyor ama tek
> motorla (kullanıcının OpenAI/Anthropic anahtarı). Misyon 6 motor sayıyor.
> Bu MVP: ölçümü **engine-aware** yapar — her run hangi motorda ölçüldüğünü
> taşır ve raporlar, delta farklı motorları karıştırmaz.
>
> **Gemini ERTELENDİ:** canlı Gemini API anahtarı yok. Kurulun "kanıt göster"
> ilkesi anahtarsız bir adapter'ı çürütür (grounding-metadata parse'ı gerçek
> API'ye karşı doğrulanamaz). Engine ekseni Gemini olmadan da tam teslim edilir
> ve OpenAI+Anthropic ile canlı doğrulanır; Gemini, anahtar gelince yalnızca bir
> adapter + bir settings enum değeri olarak KANITLI eklenir. Tam paralel çok-motor
> ve çoklu-anahtar settings de sonraya (Faz 5.5).

---

## 0. Bugünkü durum (kod gerçeği)

- `DynamicAiVisibilityModel` settings'ten **tek** sağlayıcı çözüyor (openai/
  anthropic/deepseek). Paralel N-motor yok.
- `AiVisibilityProbeRun` **hangi motorun ölçtüğünü taşımıyor** — yalnızca
  `groundingMode` (parametric/web_grounded). Bir run'ın "ChatGPT'de mi Gemini'de
  mi ölçüldüğü" kayıtlı değil.
- Settings tekil (`id="singleton"`, tek provider + tek encryptedApiKey).
- Port temiz: her engine `AiVisibilityModelPort`'u implemente ediyor.

**Boşluk:** Ürünün merkez metriği tek motorla ölçülüyor ve hangi motorda
ölçüldüğü bile kaydedilmiyor. Bir rakip "biz 6 motoru ölçüyoruz" derse merkez
vaat çöker.

## 1. Problem

Kullanıcı "AI'da görünür olmak istiyorum" diyor — ama hangi AI? ChatGPT'de
görünüp Gemini'de görünmemek çok yaygın (farklı retrieval sistemleri). Tek-motor
ölçüm bu farkı gizliyor ve yanlış güven veriyor.

## 2. Kullanıcıya sağladığı değer

"Bu ölçüm hangi motorda yapıldı" netliği + Gemini'yi (Google'ın AI aramasının
motoru) ekleyerek kapsam. İleride (Faz 5.5) "ChatGPT'de %60 ama Gemini'de %20"
karşılaştırması bu eksenin üstüne oturur.

## 3. Bu gerçekten çözülmeli mi?

**Evet, ama dar.** Tam paralel çok-motor (tek probe → N motor) daha büyük değer
ama settings'i çoklu-anahtara çevirmeyi gerektirir — [[feedback_pacing]] ve
[[feedback_seos_scope_discipline]] buna karşı. Bu MVP yalnızca **engine eksenini
kurar** (mimariyi hazırlar) + Gemini'yi seçilebilir kılar. Paralel ölçüm sonra.

## 4. En doğru çözüm

Probe-run'a bir **`engine`** ekseni ekle (hangi sağlayıcı+motor ölçtü), Gemini
adapter'ı ekle, tüm ölçüm zincirini (scorecard yorumlanışı değil — o engine-
agnostik kalır, ama run/DTO/report) engine'i taşıyacak şekilde etiketle.
Kullanıcı hâlâ tek yapılandırılmış sağlayıcıyla ölçer, ama artık run "hangi
motorda" bilgisini taşır ve raporda görünür.

## 5. Teknik mimari

- **Domain:** `AiVisibilityProbeRun`'a `engine: string` (örn. "openai",
  "gemini") — `groundingMode`'un yanına, aynı desen. `probe-target` değişmez.
- **Engine kimliği:** `DynamicAiVisibilityModel` çözerken hangi sağlayıcıyı
  seçtiğini bir `engine` string olarak dışa versin (settings.provider zaten
  var; probe use-case bunu run'a yazsın).
- **Gemini adapter:** `GeminiAiVisibilityModel implements AiVisibilityModelPort`
  — Google Generative Language API + `google_search` grounding tool. Citation'
  ları `groundingMetadata`/`groundingChunks[].web.uri` (+ title) üzerinden
  çıkar. Web search Gemini'de native → supportsWebSearch true. Yeni
  `LlmProvider` değeri "gemini" + settings'e eklenir (tekil sağlayıcı seçimi,
  hâlâ tek anahtar).
- **Use-case:** `run-ai-visibility-probe` run'ı oluştururken engine'i geçirir
  (yeni parametre veya model port'undan sorar).
- **Persistence:** `engine` kolonu + migration (default "openai" — mevcut
  run'lar OpenAI'yla ölçülmüştü; ya da "unknown"). DTO + report engine gösterir.
- **Scorecard/delta/experiment:** matematik engine-agnostik kalır (bir run tek
  motorla ölçülüyor); yalnızca **etiket** taşınır. Delta karşılaştırması:
  farklı motorların run'larını kıyaslamak yanlış olur → delta yalnızca aynı
  engine'li run'lar arasında (citedComparable gibi bir `sameEngine` guard).

## 6. UI/UX

- Ölçüm modu satırının yanına engine etiketi ("measured on ChatGPT / Gemini").
- Settings'te sağlayıcı seçimine Gemini eklenir (mevcut tek-seçim dropdown).
- Rapor başlığına engine bilgisi.
- Yeni ekran yok.

## 7. Veri modeli

`AiVisibilityProbeRun.engine String @default("openai")` + migration. Başka
şema değişikliği yok (settings zaten provider taşıyor; "gemini" enum değeri
eklenir).

## 8. API akışı

Yeni endpoint yok. Mevcut probe/settings route'ları engine'i taşır.

## 9. Risk analizi

- **Delta motor karışması:** farklı motorlu run'lar kıyaslanırsa anlamsız →
  `sameEngine` guard (citedComparable ile aynı desen).
- **Gemini API şekli farkı:** grounding metadata parse'ı — fixture testleriyle
  doğrula, gerçek çağrıyla live-verify.
- **Geriye uyum:** mevcut run'lar engine="openai" default'u (o dönem OpenAI
  yapılandırılıydı — dev DB'de doğrula, gerekirse "unknown").

## 10. Kullanıcıya / AI Visibility / Rakip etkisi

- **AI Visibility:** ölçüm kapsamı genişler (Gemini) + hangi motorda ölçüldüğü
  netleşir.
- **Rakip:** tek-motor yarasını kapatmaya başlar; tam kapatma Faz 5.5 (paralel).

## 11. MVP

**Dahil:** probe-run engine ekseni + migration; Gemini adapter + settings'e
gemini; use-case engine'i yazar; delta sameEngine guard; DTO/report/UI engine
etiketi; testler (Gemini citation parse, engine round-trip, delta guard).
**Hariç:** paralel N-motor tek probe, çoklu-anahtar settings, motor
karşılaştırma paneli (hepsi Faz 5.5).

## 12. Future Evolution (Faz 5.5)

Çoklu-anahtar settings → tek "measure" tıklaması seçili tüm motorlara paralel
probe → "ChatGPT %60 / Gemini %20" karşılaştırma paneli. Engine ekseni bu
sprint'te kurulduğu için 5.5 yalnızca orkestrasyon + settings genişlemesi olur.

## 13. Karar

✅ **Yap** — engine ekseni + Gemini (dar MVP).
⚠ Paralel çok-motor + çoklu-anahtar: Faz 5.5 (bu eksenin üstüne).
