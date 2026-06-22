import { describe, expect, it } from "vitest";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { isOk } from "@/shared/result";

function url(input: string): Url {
  const result = Url.create(input);
  if (!isOk(result)) throw new Error("expected ok result");
  return result.value;
}

describe("Page", () => {
  it("creates a page with null attributes by default", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    expect(page.title).toBeNull();
    expect(page.statusCode).toBeNull();
    expect(page.crawlJobId).toBe("job-1");
    expect(page.faqs).toEqual([]);
  });

  it("retains the faqs it was created with", () => {
    const faqs = [{ question: "What is this?", answer: "A test page." }];
    const page = Page.create("job-1", url("https://example.com/"), { faqs });
    expect(page.faqs).toEqual(faqs);
  });

  it("retains the attributes it was created with", () => {
    const page = Page.create("job-1", url("https://example.com/"), {
      statusCode: 200,
      title: "Home",
      wordCount: 350,
    });
    expect(page.statusCode).toBe(200);
    expect(page.title).toBe("Home");
    expect(page.wordCount).toBe(350);
  });

  it("isSuccessful() is true for 2xx status codes", () => {
    const page = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    expect(page.isSuccessful()).toBe(true);
    expect(page.isBroken()).toBe(false);
  });

  it("isBroken() is true for 4xx/5xx status codes", () => {
    const page = Page.create("job-1", url("https://example.com/missing"), { statusCode: 404 });
    expect(page.isBroken()).toBe(true);
    expect(page.isSuccessful()).toBe(false);
  });

  it("isSuccessful()/isBroken() are both false when status is unknown", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    expect(page.isSuccessful()).toBe(false);
    expect(page.isBroken()).toBe(false);
  });

  it("accumulates links added to it", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    const link = Link.create(page.id, page.url, url("https://example.com/about"));
    page.addLink(link);
    expect(page.allLinks).toHaveLength(1);
    expect(page.allLinks[0]).toBe(link);
  });
});
