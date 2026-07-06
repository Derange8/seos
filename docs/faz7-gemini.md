# Faz 7 — Gemini adapter (3rd measurement engine)

> Kurul kararı. Faz 5 engine ekseni kuruldu, Gemini anahtarı geldi. Bu sprint:
> `GeminiAiVisibilityModel` adapter'ı + settings'e "gemini" — üçüncü gerçek
> ölçüm motoru. Real API şekli GERÇEK ÇAĞRIYLA teyit edildi (kurul kanıt ilkesi).

---

## 0. Gerçek API şekli (canlı çağrıyla teyit — tahmin değil)

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Model: **`gemini-2.5-flash`** (gemini-2.0-flash bu anahtarda free-tier limit 0;
  gemini-1.5 v1beta'da yok — 2.5-flash 200 döndü).
- Auth: **`x-goog-api-key` header** (anahtar `AQ.` ile başlıyor — yeni Google
  anahtar formatı, `AIza` değil; çalışıyor).
- Grounding tool: **`"tools":[{"google_search":{}}]`** (küçük harf, boş obje).
- Cevap metni: `candidates[0].content.parts[].text` (birden çok part → join).
- Citation'lar: `candidates[0].groundingMetadata.groundingChunks[].web`.

## 1. KRİTİK bulgu — citation URL'i redirect, gerçek domain title'da

`groundingChunks[].web.uri` **her zaman** bir Gemini redirect proxy'si:
`https://vertexaisearch.cloud.google.com/grounding-api-redirect/...` — gerçek
kaynak domaini DEĞİL. Gerçek domain **`web.title`** alanında (`"bleap.finance"`,
`"defiprime.com"`, ...). Bu, OpenAI/Anthropic'ten temel fark: onlarda `url`
gerçek domaindi.

**Sonuç:** `citesDomain()` (bkz. `domain/ai-visibility/citation.ts`) URL host'una
bakıyor. Gemini redirect URL'iyle bu ASLA eşleşmez. Bu yüzden Gemini adapter'ı
`Citation.url`'e redirect'i değil, **`web.title`'dan türetilen gerçek domaini**
koyar (title zaten bare domain; `normalizeHost` onu kabul eder). Bu olmadan
Gemini'de citation ölçümü sessizce hep 0 çıkardı — tam da gerçek-çağrı-ile-test
etmenin neden şart olduğunun kanıtı.

## 2. Teknik mimari

- **`GeminiAiVisibilityModel implements AiVisibilityModelPort`**
  (`infrastructure/llm/ai-visibility/gemini-ai-visibility-model.ts`), diğer
  adapter'larla aynı yapı:
  - `ask(query, mode)`: web_grounded → `google_search` tool; parametric → tool'suz.
    `extractCitations` → `groundingChunks[].web`, **url = title (gerçek domain)**,
    title = title. Redirect uri atılır (citesDomain'i bozar).
  - `namesSpecificOption`, `suggestProbeTarget`, `diagnoseVisibilityGap`,
    `generateCitationContent`: mevcut prompt yardımcılarıyla (JSON mode:
    `generationConfig.responseMimeType = "application/json"`).
  - `engineId(): "gemini"`.
- **Settings:** `LlmProvider` union'a `"gemini"` + prisma enum + validator
  (`llm-credential-validator` ListModels çağrısıyla).
- **DynamicAiVisibilityModel:** `case "gemini"` → GeminiAiVisibilityModel,
  supportsWebSearch true (native grounding).
- **engineLabel** (report+UI): "gemini" → "Gemini (Google)" zaten Faz 5'te eklendi.

## 3. Edge case'ler

- **Redirect URL:** yukarıda — url'e title koy.
- **title bazen sayfa başlığı olabilir mi?** Bu çağrıda hepsi bare domain'di;
  savunmacı: `normalizeHost(title)` null dönerse citation'ı yine de sakla
  (title'ı raw göster) ama citesDomain o citation'ı eşleştiremez — dürüst.
- **Parametric Gemini:** tool yok, citations []. (Gemini tool'suz da web
  aramaz — parametric doğru.)
- **JSON mode:** Gemini `responseMimeType: application/json` ister; OpenAI'nin
  `response_format`'ından farklı.

## 4. MVP

**Dahil:** Gemini adapter (grounding + citation title-domain çıkarım + JSON
mode), settings gemini enum + validator, dynamic case, fixture testleri (gerçek
cevaptan alınan şekil), live-verify gerçek Gemini çağrısı.
**Hariç:** paralel çok-motor (Faz 5.5 hâlâ, ama artık 3 motor var → daha değerli).

## 5. Karar

✅ **Yap** — Gemini adapter, gerçek çağrıyla doğrulanmış şekil.
