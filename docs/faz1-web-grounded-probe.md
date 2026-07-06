# Faz 1 — Web-Grounded Probe + Citation Tracking

> Kurul tasarım dokümanı. Henüz kod değil; onaylanınca uygulanacak.
> Amaç: AI Visibility ölçümünü modelin **parametrik hafızasından** gerçek
> **web-grounded AI arama yüzeyine** taşımak ve "mention" ölçümünü
> "citation" (kaynak gösterme) ölçümüne yükseltmek.

---

## 0. Bugünkü durum (kod gerçeği)

- `AiVisibilityModelPort.ask(query)` → `gpt-4o-mini` chat completion, `temperature 0.7`.
  Web araması YOK. Kaynak (URL) YOK. Model yalnızca eğitim hafızasından cevap veriyor.
- Slot mantığı (`slot.ts`): cevap metninde marka geçiyor mu (MENTIONED) / rakip geçiyor mu
  (CONTESTED) / hiç isim yok mu (OPEN). Saf substring + model yargısı.
- Scorecard (`scorecard.ts`): sample bazında %MENTIONED/%CONTESTED/%OPEN + winnable queries.
- `probe-run.ts`: her query için `slots[]` + `competitorsMentioned[]`. Grounding modu veya
  citation alanı yok.

**Boşluk:** Kullanıcının satın aldığı vaat "ChatGPT beni öneriyor mu?" — ama ölçüm
"gpt-4o-mini hafızasında marka geçiyor mu?". Gerçek AI arama (SearchGPT / web-grounded
cevaplar) retrieval kullanıyor; oradaki asıl para birimi **citation**: cevabın kaynakçasında
senin domainin var mı?

---

## 1. Problem

AI arama motorları (ChatGPT web search, Claude web search, Gemini grounding) bir buyer-intent
sorusuna cevap verirken canlı web'den kaynak çekip cevabın altında URL listeler. Bir markanın
"AI tarafından önerilmesi"nin gerçek tanımı: **o kaynak listesinde domaininin bulunması**
(citation) ve/veya cevap gövdesinde önerilmesi (mention). Mevcut probe bunların ikisini de
göremiyor — çünkü web araması yapmıyor.

Sonuç: skor, satılabilir olmasına rağmen kanıtlanabilir değil. "Neden bu skora güveneyim?"
itirazı cevaplanamıyor.

## 2. Kullanıcıya sağladığı değer

- **Gerçek ölçüm:** İlk kez proxy değil, gerçek AI-arama sonucu. "Hafızada yoksun ama web'de
  bulunuyorsun" veya tersi — ikisi de aksiyon alınabilir içgörü.
- **Citation = para birimi:** Cevabın kaynakçasında domain görünmesi, mention'dan daha güçlü
  ve daha ölçülebilir bir sinyal. Rakiplerin hangi URL'lerle kazandığı görünür hale gelir.
- **Güven:** Kaynak URL'leri raporda göstererek "kanıt" sunar; SaaS'ın en zor itirazını kapatır.

## 3. Teknik mimari

Port-adapter deseni korunuyor. Değişiklik `ask()`'in **arkasında** ve dönüş tipinde.

### 3.1 Port değişikliği — `AiVisibilityModelPort`

`ask(query)` bugün `Promise<string>` dönüyor. Yeni sözleşme:

```ts
export type GroundingMode = "parametric" | "web_grounded";

export interface AskResult {
  answer: string;            // cevap gövdesi (bugünkü string)
  citations: Citation[];     // web_grounded'da kaynak listesi; parametric'te []
  groundingMode: GroundingMode;
}

export interface Citation {
  url: string;
  title?: string;
  // Bu kaynağın host'u probe hedefinin domaini mi? (domain eşleştirmesi
  // use-case/domain katmanında yapılır, adapter sadece ham url döner)
}

export interface AiVisibilityModelPort {
  ask(query: string, mode: GroundingMode): Promise<AskResult>;
  // diğer metodlar aynı kalır
}
```

Geriye dönük uyum: `mode` parametresi zorunlu; `namesSpecificOption` vs. dokunulmuyor.

### 3.2 Adapter implementasyonları

- **OpenAI:** Chat Completions yerine **Responses API** + `web_search` tool. Dönüşten
  `output_text` (answer) ve `annotations`/`url_citation` (citations) çıkarılır.
- **Anthropic:** Messages API + `web_search` tool. `content` bloklarından metin + kaynak URL'leri.
- **Gemini (YENİ):** `google-search` grounding tool. `groundingMetadata` → citations.
  (Misyonda var, kodda yok — bu fazda eklenir.)
- **`parametric` modu:** mevcut davranış aynen korunur (chat completion, citations=[]).
  Ücretsiz/hızlı yol, kırılmaz.

DeepSeek web-search desteklemiyorsa: `web_grounded` istenirse net bir hata döner, UI o
sağlayıcı için modu kapatır (bkz. edge case).

### 3.3 Slot mantığı genişlemesi (`slot.ts`)

Yeni bir sinyal ekseni: **CITED** (domain kaynakçada var). Slot enum'una dördüncü değer
EKLEMİYORUZ (won/contested/open kavramsal olarak ayrı); bunun yerine her sample'a paralel bir
boolean: `citedByDomain`. Böylece iki bağımsız ölçü raporlanır:
- **Recommendation slot** (mevcut): MENTIONED / CONTESTED / OPEN
- **Citation** (yeni): cevabın kaynakçasında domain var mı

Bu ayrım kritik: bir marka cevap gövdesinde geçmeyip (OPEN) ama kaynakçada olabilir (CITED) —
"görünmez ama okunuyorsun" durumu, en değerli düzeltme fırsatı.

### 3.4 Etkilenen katmanlar

- `run-ai-visibility-probe-use-case.ts`: `sample()` artık `AskResult` alır, `citedByDomain`
  hesaplar (host eşleştirme), `QueryOutcome`'a taşır.
- `scorecard.ts`: `citedSamples` / `citedPct` + citation-frequency (hangi rakip URL'ler kazanıyor).
- Repository + Prisma şeması: yeni alanlar (bkz. Veri modeli).

## 4. UI/UX tasarımı

Mevcut AI Visibility kartına minimal ekleme — yeni ekran YOK:

- **Grounding toggle:** "Gerçek AI araması (web)" vs "Hızlı (hafıza)" — varsayılan `web_grounded`
  ama maliyet uyarısıyla. Kullanıcı tek karar verir (kriter 6).
- **Scorecard'a ikinci satır:** "Kaynak gösterilme (citation): %X" — mention %'nin yanında.
- **Winnable queries listesinde rozet:** her query için `[Öneriliyor] [Kaynak veriliyor]
  [Rakip kazanıyor]` durumu.
- **Citation drill-down:** bir query'ye tıklayınca cevabın gerçek kaynak URL'leri + hangisi
  rakip hangisi sen. "Kanıt" burada görünür.

## 5. Veri modeli (Prisma)

```prisma
model AiVisibilityProbeRun {
  // mevcut alanlar...
  groundingMode String  // "parametric" | "web_grounded"
}

model AiVisibilityQueryOutcome {
  // mevcut: query, slots (json), competitorsMentioned (json)
  citedSamples      Int      // kaç sample'da domain kaynakçada göründü
  citations         Json     // Citation[] (union, url+title+isTargetDomain+isCompetitor)
}
```

Migration: `prisma/migrations` altında yeni SQL. Mevcut satırlar için `groundingMode`
default `"parametric"`, `citedSamples` default 0 — eski veriyi bozmadan.

## 6. API akışı

1. UI → `POST /api/projects/[id]/ai-visibility/probe` body: `{ groundingMode }`
2. Route → `RunAiVisibilityProbeUseCase.execute(projectId, target, mode)`
3. Her query × N sample: `model.ask(query, mode)` → `AskResult`
4. Domain katmanı: answer'dan slot (mevcut), citations'tan `citedByDomain` (host eşleştirme)
5. Partial-failure toleransı korunur (mevcut retry mantığı `AskResult` için de geçerli)
6. `probe-run` kaydedilir; scorecard hesaplanıp UI'a döner

## 7. Edge case'ler

- **Sağlayıcı web-search desteklemiyor (DeepSeek):** `web_grounded` istenirse adapter net
  hata → use-case o modu düşürür VEYA UI toggle'ı o sağlayıcıda kilitler. Sessiz `parametric`
  fallback YAPMA (ölçüm yalanı olur); açıkça bildir.
- **Model kaynak döndürmez ama web aradı:** `citations=[]` geçerli sonuçtur (kaynaksız cevap);
  citation %0 dürüst okumadır.
- **Domain eşleştirme:** `www.`, subdomain, trailing slash, http/https normalizasyonu.
  `blog.acme.com` hedef `acme.com` ise sayılmalı (registrable domain karşılaştırması).
- **Rate limit / maliyet:** web-grounded çağrılar chat completion'dan pahalı ve yavaş.
  `samplesPerQuery` web modda daha düşük default (örn. 3) veya kullanıcıya tahmini maliyet göster.
- **Non-determinism:** zaten çok-örnekleme ile ele alınmış; citation için de aynı distribution
  mantığı (kaç sample'da cited).

## 8. Güvenlik riskleri

- **Kaynak URL'leri kullanıcı içeriği:** UI'da gösterirken XSS'e karşı escape; tıklama
  `shell.openExternal` ile (mevcut pattern), in-app navigasyon değil.
- **SSRF:** citation URL'lerini crawl ETMİYORUZ bu fazda (sadece gösteriyoruz), ama ileride
  crawlarsak mevcut `private-network-guard.ts` zorunlu.
- **API anahtarı:** web-search tool'u kullanıcının kendi anahtarıyla; ek maliyet kullanıcıya
  ait, net gösterilmeli. Anahtar zaten `credential-cipher` ile şifreli.

## 9. Performans etkisi

- Web-grounded çağrı ~2-5x daha yavaş ve pahalı. Probe zaten arka planda + partial-tolerant.
- Öneri: web modda `samplesPerQuery` default'u düşür, query sayısını sınırla, kullanıcıya süre/
  maliyet tahmini göster. `parametric` modu hızlı-önizleme olarak kalır.
- SQLite yazımı ihmal edilebilir (birkaç JSON alan).

## 10. MVP kapsamı

**Dahil:**
- OpenAI + Anthropic web-grounded `ask()` (Responses/Messages + web_search tool)
- `AskResult` + `Citation` port sözleşmesi
- `citedByDomain` hesabı (registrable-domain eşleştirme) + scorecard'a `citedPct`
- Prisma migration (`groundingMode`, `citedSamples`, `citations`)
- UI: grounding toggle + scorecard'a citation satırı + query drill-down kaynak listesi
- Testler: adapter parse (fixture cevaplarla), domain eşleştirme, scorecard citation matematiği

**Hariç (MVP değil):**
- Gemini (hemen sonraki adım, MVP'yi bloke etmesin)
- Citation URL'lerini crawl edip "neden kazanıyorlar" analizi (Faz 1.5)
- Maliyet tahmin motoru (basit statik uyarı yeter)

## 11. Gelecekte genişletme

- **Gemini + gelecekteki motorlar:** aynı `ask(query, mode)` sözleşmesi arkasına yeni adapter.
- **Citation-gap analizi:** rakiplerin kazandığı URL'leri crawl edip (SSRF-guard'lı) "onlarda
  olup sende olmayan" içerik boşluğunu diagnose'a besle → `generate-citation-content` daha keskin.
- **Motor bazlı segmentasyon:** "ChatGPT'de %60 ama Gemini'de %20 görünürsün" — motor
  karşılaştırma paneli (Faz 3 raporuna girdi).
- **Otomatik before/after (Faz 2):** düzeltme yayınlanınca web-grounded probe'u otomatik
  tekrarla, citation kazanımını kanıtla.
```
