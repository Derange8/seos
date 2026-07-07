# Faz 5.5 — Parallel multi-engine measurement

> Kurul kararı. Faz 5 engine ekseni + Faz 7 Gemini ile artık 3 gerçek motor var.
> Bu sprint: tek "Measure" tıklaması **seçili tüm motorlara paralel** probe atsın
> → "ChatGPT %60 / Claude %40 / Gemini %20" karşılaştırması. Geriye-uyumlu:
> mevcut tek-anahtar LlmSettings korunur, ölçüm için ayrı çoklu-anahtar deposu.

---

## 0. Bugünkü durum (kod gerçeği)

- `LlmSettings` **tekil** (`id="singleton"`, tek provider+anahtar). **9 tüketici**
  onu okuyor: 5 content provider + recommendation + growth + ai-visibility
  dynamic model + save use-case. Çoğu tek "aktif" sağlayıcı istiyor.
- Probe tek `DynamicAiVisibilityModel` ile tek motorda ölçüyor. Run'a `engine`
  yazılıyor (Faz 5) ama bir "measure" hep tek motor.
- Faz 5 delta'da `sameEngine` guard var (motorları karıştırma).

**Boşluk:** Ürün "AI'da görünürlük" ölçüyor ama tek motorda. Kullanıcı 3 motoru
karşılaştıramıyor — ChatGPT'de görünüp Gemini'de görünmemek çok yaygın.

## 1. En doğru çözüm (mimari karar)

**LlmSettings'i DEĞİŞTİRME** (9 tüketici bozulmaz). Yanına, sadece ölçüm için,
ayrı bir **`LlmCredential`** deposu ekle: provider başına bir şifreli anahtar
satırı (çoklu). Probe bu depodan yapılandırılmış tüm motorları okuyup
**paralel** ölçer, her motor için ayrı bir `AiVisibilityProbeRun` (engine
zaten Faz 5'te run'da).

Böylece:
- Content/audit/recommendation akışı hiç değişmez (hâlâ tek "aktif" LlmSettings).
- Çoklu-anahtar yalnızca ölçüm katmanına eklenir.
- Kullanıcı 1 motor (bugünkü gibi) veya 3 motor girebilir.

## 2. Teknik mimari

### 2.1 Persistence
- Yeni `LlmCredential` domain entity: `{ provider, apiKey, model|null }`.
- Yeni tablo `llm_credentials` (provider PK, `encryptedApiKey`, `model?`) —
  provider başına en fazla bir satır. Şifreleme LlmSettings'le aynı
  `credential-cipher`.
- `LlmCredentialRepositoryPort`: `upsert(cred)`, `findAll()`,
  `remove(provider)`.
- **Geriye-uyum/migration yok gerektirmez:** yeni tablo; mevcut LlmSettings
  dokunulmaz. Opsiyonel: ilk açılışta LlmSettings'i credential'a kopyalayan bir
  seed — MVP'de değil, kullanıcı UI'dan girer.

### 2.2 Ölçüm use-case
- `RunMultiEngineProbeUseCase`: seçili provider listesi (veya "yapılandırılmış
  hepsi") için, her biri için `DynamicAiVisibilityModel` yerine
  **credential'dan kurulmuş** bir `AiVisibilityModelPort` ile
  `RunAiVisibilityProbeUseCase.execute` çağırır — **paralel** (`Promise.all`).
  Her motor kendi run'ını üretir+kaydeder (engine zaten run'da).
- Motor-model fabrikası: mevcut `createModelFor` (dynamic-ai-visibility-model
  içindeki switch) dışa alınır/yeniden kullanılır → provider+key → model.
- Partial failure: bir motor patlarsa (kota/anahtar) diğerleri sürer;
  sonuç hangi motorların ölçüldüğünü + hangilerinin başarısız olduğunu taşır.

### 2.3 Karşılaştırma DTO
- `MultiEngineComparisonDto`: `engines: { engine, scorecard, runAt }[]` +
  başarısızlar. UI "ChatGPT %60 / Claude %40 / Gemini %20" satırı çizer.
- Mevcut per-engine run'lar zaten kaydedildiği için trend/rapor engine-aware
  (Faz 5) — karşılaştırma bunların en son'larını yan yana koyar.

### 2.4 API + UI
- Settings UI: mevcut tek-sağlayıcı formunun yanına "Measurement engines"
  bölümü — provider başına anahtar gir/sil (OpenAI/Claude/Gemini). DeepSeek
  ölçümde web-search yok, ölçüm motoru olarak sunulmaz.
- Probe route: `POST .../ai-visibility` `engines?: string[]` (yoksa
  yapılandırılmış hepsi). Yeni `GET .../ai-visibility/compare` en son
  per-engine scorecard'ları döner.

## 3. Edge case'ler
- **Hiç credential yok:** bugünkü LlmSettings'e düş (tek motor) — geriye-uyum.
- **Tek credential:** bugünkü davranış (tek run).
- **DeepSeek:** web-grounded desteklemiyor → ölçüm motoru listesinde yok.
- **Bir motor kota/hata:** partial — diğerleri ölçer, UI eksik motoru "ölçülemedi"
  gösterir.
- **Paralel maliyet:** N motor × query × sample. Aynı query listesi; kullanıcı
  motor seçerek sınırlayabilir.

## 4. MVP
**Dahil:** LlmCredential entity+repo+tablo+şifreleme; RunMultiEngineProbe
(paralel, partial-tolerant); comparison DTO+route; Settings UI çoklu-anahtar;
probe UI motor seçimi + karşılaştırma satırı; testler; live-verify 2+ motor.
**Hariç:** motor-başına farklı query/sample; otomatik pilot çok-motor (sonra);
DeepSeek ölçüm; credential migration/seed.

## 5. Karar
✅ **Yap** — ayrı LlmCredential deposu + paralel çok-motor probe (geriye-uyumlu).
