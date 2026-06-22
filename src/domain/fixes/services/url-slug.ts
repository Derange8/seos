// Shared by the title and H1 fix generators — both fall back to the
// page's URL slug when there's no better signal (an existing H1 or title)
// to draw from.
export function humanizeUrlSlug(pathname: string): string {
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const words = lastSegment.replace(/[-_]+/g, " ").trim();
  return words.length > 0 ? words.replace(/\b\w/g, (char) => char.toUpperCase()) : "Home";
}
