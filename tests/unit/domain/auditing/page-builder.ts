import { Page, type PageAttributes } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

export function buildPage(attributes: PageAttributes = {}, href = "https://example.com/"): Page {
  const result = Url.create(href);
  if (!result.ok) throw new Error("expected ok result");
  return Page.create("job-1", result.value, attributes);
}
