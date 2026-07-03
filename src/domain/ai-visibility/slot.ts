// How a single AI answer positions the target business for one query:
//  - MENTIONED: the target brand itself appears in the answer (already won)
//  - CONTESTED: a specific competitor/product is named but the target isn't
//  - OPEN:      no specific platform is named at all — a winnable slot
export type Slot = "MENTIONED" | "CONTESTED" | "OPEN";

// Pure detection — case-insensitive substring match. Deliberately dumb and
// deterministic; the fuzzier "does this answer name ANY specific platform,
// even one we don't track" question is answered by the model itself (see
// AiVisibilityModelPort.namesSpecificOption), not here.
export function detectMention(answer: string, aliases: readonly string[]): boolean {
  const haystack = answer.toLowerCase();
  return aliases.some((a) => haystack.includes(a.toLowerCase()));
}

export function detectCompetitors(answer: string, competitors: readonly string[]): string[] {
  const haystack = answer.toLowerCase();
  return competitors.filter((c) => haystack.includes(c.toLowerCase()));
}

// The single trustworthy reading of N noisy samples for one query. LLM
// answers are non-deterministic, so a query's slot is a distribution, not a
// point — this collapses it to the plurality, with MENTIONED winning ties
// (any real self-mention is the strongest signal there is).
export function dominantSlot(slots: readonly Slot[]): Slot {
  const counts: Record<Slot, number> = { MENTIONED: 0, CONTESTED: 0, OPEN: 0 };
  for (const s of slots) counts[s]++;
  if (counts.MENTIONED > 0 && counts.MENTIONED >= counts.CONTESTED && counts.MENTIONED >= counts.OPEN) {
    return "MENTIONED";
  }
  return counts.OPEN > counts.CONTESTED ? "OPEN" : "CONTESTED";
}
