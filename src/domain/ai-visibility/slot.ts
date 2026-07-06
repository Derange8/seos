// How a single AI answer positions the target business for one query:
//  - MENTIONED: the target brand itself appears in the answer (already won)
//  - CONTESTED: a specific competitor/product is named but the target isn't
//  - OPEN:      no specific platform is named at all — a winnable slot
export type Slot = "MENTIONED" | "CONTESTED" | "OPEN";

// Ordered by how good the position is for the target's own visibility:
// MENTIONED (recommended) > OPEN (winnable gap, no incumbent) > CONTESTED
// (a competitor is recommended, you aren't). Used to classify whether an
// experiment moved a query forward or back.
export const SLOT_RANK: Record<Slot, number> = { CONTESTED: 0, OPEN: 1, MENTIONED: 2 };

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

// How stable the dominant reading is: the share of samples that landed in the
// dominant slot (0..1). "3 of 4 OPEN" → 0.75; a query split 2/2/0 across slots
// is far less certain than 4/0/0, and this is what tells them apart. Uses the
// same dominant slot as dominantSlot(), so the ratio always describes the slot
// actually reported. Empty input → 0 (nothing measured, no confidence).
export function slotConsensus(slots: readonly Slot[]): number {
  if (slots.length === 0) return 0;
  const dominant = dominantSlot(slots);
  const inDominant = slots.filter((s) => s === dominant).length;
  return inDominant / slots.length;
}

// Below this consensus a query's reading is treated as too unstable to trust —
// e.g. a 2/5 plurality. Deliberately a single tunable constant in one place.
// At 3-5 samples this is the honest bar; raise samples for finer thresholds.
export const CONFIDENCE_THRESHOLD = 0.6;

// Is the dominant reading stable enough to act on? A single sample is trivially
// 100% "consensus" but that's not real confidence — still, if the user chose 1
// sample they aren't asking for a confidence signal, so we don't special-case
// it here; the threshold simply passes it.
export function isConfident(slots: readonly Slot[]): boolean {
  return slots.length > 0 && slotConsensus(slots) >= CONFIDENCE_THRESHOLD;
}
