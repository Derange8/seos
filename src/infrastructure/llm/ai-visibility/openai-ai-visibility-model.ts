import type { AiVisibilityModelPort } from "@/application/ai-visibility/ports/ai-visibility-model-port";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const JUDGE_SYSTEM = 'You are a strict classifier. Answer with only "yes" or "no".';

function judgePrompt(answer: string): string {
  return (
    "Does the following answer recommend or name at least one specific, real " +
    "product, platform, service, app, or website (an actual brand name), as " +
    'opposed to a generic non-committal answer? Answer only "yes" or "no".\n\n' +
    `"""${answer.slice(0, 1500)}"""`
  );
}

interface Options {
  apiKey: string;
  model?: string;
  // DeepSeek reuses this class via its OpenAI-compatible endpoint, exactly
  // like OpenAiRecommendationProvider.
  baseUrl?: string;
}

// AiVisibilityModelPort over OpenAI Chat Completions. `ask` uses a warm
// temperature on purpose — the probe measures the DISTRIBUTION of answers a
// real user would get, so variance is the signal, not noise; `namesSpecificOption`
// uses temperature 0 for a stable classification.
export class OpenAiAiVisibilityModel implements AiVisibilityModelPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async ask(query: string): Promise<string> {
    return this.chat([{ role: "user", content: query }], 0.7);
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    const verdict = await this.chat(
      [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: judgePrompt(answer) },
      ],
      0
    );
    return verdict.trim().toLowerCase().startsWith("y");
  }

  private async chat(messages: { role: string; content: string }[], temperature: number): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI visibility model request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("AI visibility model response did not contain message content");
    }
    return content;
  }
}
