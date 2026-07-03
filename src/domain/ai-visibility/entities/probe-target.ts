// What to probe for one project: the brand to look for, and the buyer-intent
// queries an AI answer engine ideally recommends it for. Plain config, no
// invariants worth an entity yet — it's the input to a probe run, persisted
// per project once the settings UI lands (Faz 1 later steps).
export interface ProbeTarget {
  brand: string;
  domain: string;
  // Other spellings the brand may appear as in an answer (e.g. "janus.vote",
  // "janus vote") — any match counts as a self-mention.
  aliases: readonly string[];
  // Known competitor/product names to detect deterministically. Not
  // exhaustive by design; the model's own judgement covers the rest.
  competitors: readonly string[];
  queries: readonly string[];
}
