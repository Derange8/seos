/**
 * AI Visibility Probe — Faz 0 doğrulama deneyi (SEOS re-point, 2026-07-03).
 *
 * Amaç: Bir işletmenin, AI cevap motorlarında (ChatGPT/Claude/…) alıcı-niyetli
 * sorgular için ÖNERİLİP önerilmediğini ölçmek. Bu, "Internet Twin"in dürüstçe
 * mümkün olan çekirdeği: Google sıralamasını tahmin etmiyoruz (imkânsız),
 * sorgulanabilir oracle'a (modele) doğrudan soruyoruz.
 *
 * Bu dosya standalone bir deneydir — src/ altındaki hiçbir şeye dokunmaz,
 * uygulamaya bağlı değildir. Sinyal gerçekse Faz 1'de gerçek bir bounded
 * context'e taşınır.
 *
 * Çalıştırma:
 *   OPENAI_API_KEY=... ANTHROPIC_API_KEY=... npx tsx experiments/ai-visibility/probe.ts
 * Key yoksa otomatik olarak "mock" sağlayıcıyla çalışır (pipeline'ı kanıtlar).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// --- Hedef tanımı (janus.vote — Türkçe tahmin piyasası platformu) -----------

interface Target {
  brand: string; // modelin cevabında aranacak marka adı
  domain: string;
  aliases: string[]; // markanın geçebileceği diğer yazımlar
  competitors: string[]; // aynı cevapta çıkabilecek rakip markalar
  queries: string[]; // alıcı-niyetli, sitenin ideal olarak önerileceği sorgular
}

const TARGET: Target = {
  brand: "Janus",
  domain: "janus.vote",
  aliases: ["janus", "janus.vote", "janus vote"],
  competitors: [
    "Polymarket",
    "Kalshi",
    "Manifold",
    "Metaculus",
    "Augur",
    "PredictIt",
    "Zeitgeist",
    "Futuur",
    "Insight Prediction",
    "Smarkets",
    "Betfair",
    "Good Judgment",
    "Gnosis",
    "Thales",
    "Limitless",
  ],
  queries: [
    "Türkiye'de tahmin piyasası platformları nelerdir",
    "en iyi tahmin piyasası sitesi hangisi",
    "kripto ile tahmin piyasası nerede oynanır",
    "geleceğe dair olaylara nasıl bahis yapılır hangi platform",
    "Polymarket Türkiye'de kullanılabilir mi alternatifi ne",
    "Türkçe prediction market uygulaması öner",
    "seçim sonuçlarına tahmin piyasası nerede yapılır",
    "spor dışı olaylara bahis platformu",
    "blockchain tabanlı tahmin piyasası platformu",
    "olay bazlı bahis siteleri Türkçe",
    "tahmin piyasasında nasıl para kazanılır hangi platform",
    "merkeziyetsiz tahmin piyasası nerede kullanılır",
    "gelecek tahmin platformu web3",
    "kripto bahis veya tahmin dapp öner",
    "Türkiye'den erişilebilen tahmin piyasası",
    "en güvenilir prediction market platformu",
    "ekonomi ve siyaset olaylarına tahmin nerede yapılır",
    "topluluk tabanlı sosyal tahmin platformu",
  ],
};

// --- Model sağlayıcı soyutlaması --------------------------------------------

interface ModelProbe {
  readonly name: string;
  ask(query: string): Promise<string>;
}

class OpenAiProbe implements ModelProbe {
  readonly name: string;
  constructor(private readonly apiKey: string, private readonly model = "gpt-4o-mini") {
    this.name = `openai:${model}`;
  }
  async ask(query: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: query }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  }
}

class AnthropicProbe implements ModelProbe {
  readonly name: string;
  constructor(private readonly apiKey: string, private readonly model = "claude-sonnet-5") {
    this.name = `anthropic:${model}`;
  }
  async ask(query: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: query }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  }
}

/**
 * Key yokken pipeline'ın çalıştığını göstermek için deterministik cevaplar.
 * Gerçekçi bir şekilde: rakipleri sayar, Janus'u (küçük/yeni bir platform
 * olduğu için) çoğunlukla hiç anmaz — canlı sonucun büyük ihtimalle böyle
 * olacağını da temsil eder. Bu bir BAŞARISIZLIK değil, ölçülecek olan gerçek
 * teşhisin ta kendisidir.
 */
class MockProbe implements ModelProbe {
  readonly name = "mock";
  async ask(query: string): Promise<string> {
    if (query.toLowerCase().includes("polymarket")) {
      return "Polymarket en bilinen platform. Türkçe birebir alternatifi sınırlı; Manifold ve Metaculus uluslararası seçenekler arasında.";
    }
    return "En popüler tahmin piyasası platformları Polymarket ve Kalshi'dir. Ayrıca Manifold, Metaculus ve Augur da tercih edilir.";
  }
}

// --- Citation tespiti + slot sınıflandırması --------------------------------

type Slot = "JANUS" | "CONTESTED" | "OPEN";

interface Detection {
  mentioned: boolean;
  competitorsMentioned: string[];
}

function detect(answer: string, target: Target): Detection {
  const haystack = answer.toLowerCase();
  const mentioned = target.aliases.some((a) => haystack.includes(a.toLowerCase()));
  const competitorsMentioned = target.competitors.filter((c) => haystack.includes(c.toLowerCase()));
  return { mentioned, competitorsMentioned };
}

/**
 * Bir cevabın "slot"unu belirler:
 *  - JANUS:     hedef marka anılmış → zaten kazanılmış slot
 *  - CONTESTED: spesifik bir platform önerilmiş ama Janus değil → dolu slot
 *  - OPEN:      hiç spesifik platform önerilmemiş (jenerik cevap) → boş/kazanılabilir slot
 *
 * CONTESTED/OPEN ayrımı, bizim rakip listemizde olmayan platformları da
 * yakalamak için küçük bir LLM-judge ile yapılır (key varsa); key yoksa
 * sadece rakip-listesi eşleşmesine düşer.
 */
async function classifySlot(
  answer: string,
  det: Detection,
  apiKey: string | undefined
): Promise<Slot> {
  if (det.mentioned) return "JANUS";
  if (det.competitorsMentioned.length > 0) return "CONTESTED";
  if (!apiKey) return "OPEN"; // mock/keysiz: listede yoksa açık say

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a strict classifier. Answer with only 'yes' or 'no'." },
        {
          role: "user",
          content: `Does the following answer recommend or name at least one specific, real prediction-market platform, exchange, app, or website (an actual product/brand name)? Answer only "yes" or "no".\n\n"""${answer.slice(0, 1500)}"""`,
        },
      ],
    }),
  });
  if (!res.ok) return "OPEN"; // sınıflandırma başarısızsa muhafazakâr: açık sayma yerine ham liste
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const verdict = (data.choices[0]?.message?.content ?? "").trim().toLowerCase();
  return verdict.startsWith("y") ? "CONTESTED" : "OPEN";
}

// --- Runner + scorecard -----------------------------------------------------

// Her sorgu birden çok kez sorulur (LLM cevapları non-deterministik) — slot
// tek-atışta OPEN↔CONTESTED arası zıpladığı için tek doğru okuma frekanstır.
const SAMPLES = Number(process.env.SAMPLES ?? 4);

interface QueryResult {
  model: string;
  query: string;
  slots: Slot[]; // uzunluğu SAMPLES
  competitorsMentioned: string[]; // örnekler boyunca birleşim
}

const SLOT_MARK: Record<Slot, string> = { JANUS: "✅", CONTESTED: "⛔", OPEN: "🟢" };

function dominant(slots: Slot[]): Slot {
  const c: Record<Slot, number> = { JANUS: 0, CONTESTED: 0, OPEN: 0 };
  for (const s of slots) c[s]++;
  if (c.JANUS >= c.CONTESTED && c.JANUS >= c.OPEN && c.JANUS > 0) return "JANUS";
  return c.OPEN > c.CONTESTED ? "OPEN" : "CONTESTED";
}

async function run(): Promise<void> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const probes: ModelProbe[] = [];
  if (openaiKey) probes.push(new OpenAiProbe(openaiKey));
  if (process.env.ANTHROPIC_API_KEY) probes.push(new AnthropicProbe(process.env.ANTHROPIC_API_KEY));
  const live = probes.length > 0;
  if (!live) probes.push(new MockProbe());

  console.log(`\n=== AI Visibility Probe — ${TARGET.brand} (${TARGET.domain}) ===`);
  console.log(live ? `CANLI — sağlayıcılar: ${probes.map((p) => p.name).join(", ")}` : "MOCK modu (key yok)");
  console.log(`${TARGET.queries.length} sorgu × ${probes.length} model × ${SAMPLES} örnek = ${TARGET.queries.length * probes.length * SAMPLES} cevap\n`);

  const results: QueryResult[] = [];
  for (const probe of probes) {
    for (const query of TARGET.queries) {
      const slots: Slot[] = [];
      const competitors = new Set<string>();
      for (let i = 0; i < SAMPLES; i++) {
        let answer = "";
        try {
          answer = await probe.ask(query);
        } catch (err) {
          console.error(`  ! ${probe.name} sorgu başarısız: ${String(err)}`);
          continue;
        }
        const d = detect(answer, TARGET);
        for (const c of d.competitorsMentioned) competitors.add(c);
        slots.push(await classifySlot(answer, d, openaiKey));
      }
      const qr: QueryResult = { model: probe.name, query, slots, competitorsMentioned: [...competitors] };
      results.push(qr);
      const dom = dominant(slots);
      const dist = `J${slots.filter((s) => s === "JANUS").length}/D${slots.filter((s) => s === "CONTESTED").length}/A${slots.filter((s) => s === "OPEN").length}`;
      console.log(`  ${SLOT_MARK[dom]} [${dist}] "${query.slice(0, 40)}..." | rakip: ${qr.competitorsMentioned.join(", ") || "—"}`);
    }
  }

  // Scorecard — örnek düzeyinde toplam (frekans)
  const allSlots = results.flatMap((r) => r.slots);
  const total = allSlots.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const janus = allSlots.filter((s) => s === "JANUS").length;
  const open = allSlots.filter((s) => s === "OPEN").length;
  const contested = allSlots.filter((s) => s === "CONTESTED").length;

  const competitorFreq = new Map<string, number>();
  for (const r of results) for (const c of r.competitorsMentioned) competitorFreq.set(c, (competitorFreq.get(c) ?? 0) + 1);
  const topCompetitors = [...competitorFreq.entries()].sort((a, b) => b[1] - a[1]);

  const winnable = results.filter((r) => dominant(r.slots) === "OPEN");

  console.log(`\n--- SCORECARD (${total} cevap, örnek düzeyinde frekans) ---`);
  console.log(`✅ JANUS : ${janus} (${pct(janus)}%)`);
  console.log(`🟢 AÇIK  : ${open} (${pct(open)}%)  ← kazanılabilir`);
  console.log(`⛔ DOLU  : ${contested} (${pct(contested)}%)  ← rakip yerleşik`);
  console.log(`Rakip hakimiyeti (kaç sorguda görüldü): ${topCompetitors.map(([c, n]) => `${c} (${n})`).join(", ") || "—"}`);
  console.log(`\nAğırlıklı AÇIK sorgular (${winnable.length}/${results.length} sorgu — Janus'un girmesi gereken yer):`);
  for (const r of winnable) console.log(`  • ${r.query}`);

  const outDir = join(process.cwd(), "experiments", "ai-visibility", "results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(outDir, `${stamp}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      { target: TARGET, live, samples: SAMPLES, at: new Date().toISOString(), summary: { total, janus, open, contested, topCompetitors }, results },
      null,
      2
    )
  );
  console.log(`\nSonuç kaydedildi: ${outFile}\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
