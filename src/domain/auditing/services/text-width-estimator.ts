// Google truncates titles and meta descriptions by rendered pixel width,
// not character count — "iiiiiiiiiiiiiiiiiiiiiiiiiiiiii" (30 narrow
// characters) takes up far less space in a search snippet than "MMMMMMMM"
// (8 wide ones). The common "30-60 characters" / "70-160 characters" SEO
// guidance is really shorthand for "roughly that many AVERAGE-width
// characters" — applying it as a flat character count (as the rules in
// this directory used to) flags wide-character titles too leniently and
// narrow-character ones too aggressively.
//
// This weights each character by its typical relative width in a
// standard sans-serif UI font, calibrated so an "average" character is
// 1.0 — i.e. estimateTextWidth("60 average characters...") still comes
// out near 60, so the existing MIN/MAX_LENGTH thresholds in
// title-length-rule.ts and meta-description-length-rule.ts stay valid
// without retuning. It's a deliberately coarse three-bucket model, not a
// real font metrics table — good enough to stop flagging a title just
// because it's long in characters when it isn't long on screen, not a
// pixel-perfect truncation predictor.
const NARROW_CHARS = new Set("iIl'.,:;!|jft- ");
const WIDE_CHARS = new Set("mwMW@%");

function charWidth(char: string): number {
  if (NARROW_CHARS.has(char)) return 0.5;
  if (WIDE_CHARS.has(char)) return 1.6;
  if (char >= "A" && char <= "Z") return 1.3;
  return 1.0;
}

export function estimateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return Math.round(width);
}
