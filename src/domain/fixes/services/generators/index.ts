import type { FixGenerator } from "@/domain/fixes/services/fix-generator";
import { titleFixGenerator } from "@/domain/fixes/services/generators/title-fix-generator";
import { metaDescriptionFixGenerator } from "@/domain/fixes/services/generators/meta-description-fix-generator";
import { h1FixGenerator } from "@/domain/fixes/services/generators/h1-fix-generator";
import { canonicalFixGenerator } from "@/domain/fixes/services/generators/canonical-fix-generator";

// The plugin registry — not every audit rule has a matching generator.
// thin-content and broken-status-code, for example, aren't generatable
// content; they stay at autonomy Level 1 (recommendation-only), which is a
// deliberate product boundary, not an oversight. Adding a new fixable rule
// means writing one FixGenerator and listing it here.
export const DEFAULT_FIX_GENERATORS: readonly FixGenerator[] = [
  titleFixGenerator,
  metaDescriptionFixGenerator,
  h1FixGenerator,
  canonicalFixGenerator,
];
