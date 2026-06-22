import { describe, expect, it } from "vitest";
import { Url } from "@/domain/crawling/value-objects/url";
import { isErr, isOk } from "@/shared/result";

describe("Url", () => {
  it("accepts a valid http(s) URL", () => {
    const result = Url.create("https://example.com/blog/post");
    expect(isOk(result)).toBe(true);
    expect(isOk(result) && result.value.href).toBe("https://example.com/blog/post");
  });

  it("strips the fragment so pages dedupe regardless of #hash", () => {
    const result = Url.create("https://example.com/page#section-2");
    expect(isOk(result) && result.value.href).toBe("https://example.com/page");
  });

  it("rejects malformed input", () => {
    const result = Url.create("not a url");
    expect(isErr(result)).toBe(true);
    expect(isErr(result) && result.error.code).toBe("INVALID_URL");
  });

  it("rejects unsupported protocols", () => {
    const result = Url.create("ftp://example.com/file.txt");
    expect(isErr(result)).toBe(true);
  });

  it("exposes hostname, origin and pathname", () => {
    const result = Url.create("https://example.com/a/b?x=1");
    if (isOk(result)) {
      expect(result.value.hostname).toBe("example.com");
      expect(result.value.origin).toBe("https://example.com");
      expect(result.value.pathname).toBe("/a/b");
    } else {
      throw new Error("expected ok result");
    }
  });

  it("isSameOrigin() compares origin only", () => {
    const a = Url.create("https://example.com/a");
    const b = Url.create("https://example.com/b");
    const c = Url.create("https://other.com/a");
    if (isOk(a) && isOk(b) && isOk(c)) {
      expect(a.value.isSameOrigin(b.value)).toBe(true);
      expect(a.value.isSameOrigin(c.value)).toBe(false);
    } else {
      throw new Error("expected ok results");
    }
  });

  it("equals() compares full href", () => {
    const a = Url.create("https://example.com/a");
    const b = Url.create("https://example.com/a");
    const c = Url.create("https://example.com/b");
    if (isOk(a) && isOk(b) && isOk(c)) {
      expect(a.value.equals(b.value)).toBe(true);
      expect(a.value.equals(c.value)).toBe(false);
    } else {
      throw new Error("expected ok results");
    }
  });

  it("lowercases the host", () => {
    const result = Url.create("https://SITE.com/Path");
    expect(isOk(result) && result.value.href).toBe("https://site.com/Path");
  });

  it("strips default ports", () => {
    const https = Url.create("https://site.com:443/");
    expect(isOk(https) && https.value.href).toBe("https://site.com/");
    const http = Url.create("http://site.com:80/");
    expect(isOk(http) && http.value.href).toBe("http://site.com/");
  });

  it("strips tracking parameters entirely", () => {
    const result = Url.create("https://site.com/?utm_source=test");
    expect(isOk(result) && result.value.href).toBe("https://site.com/");
  });

  it("keeps non-tracking parameters but sorts them", () => {
    const result = Url.create("https://site.com/?b=2&a=1");
    expect(isOk(result) && result.value.href).toBe("https://site.com/?a=1&b=2");
  });

  it("strips tracking params while keeping and sorting the rest", () => {
    const result = Url.create("https://site.com/?utm_source=test&id=5&utm_campaign=x&a=1");
    expect(isOk(result) && result.value.href).toBe("https://site.com/?a=1&id=5");
  });

  it("uppercases percent-encoding in the path", () => {
    const result = Url.create("https://site.com/a%2fb");
    expect(isOk(result) && result.value.href).toBe("https://site.com/a%2Fb");
  });

  it("collapses the classic four-variant example to one normalized URL", () => {
    const variants = [
      "https://site.com",
      "https://site.com/",
      "https://site.com?utm_source=test",
      "https://SITE.com",
    ];
    const normalized = variants.map((v) => {
      const result = Url.create(v);
      if (!isOk(result)) throw new Error("expected ok result");
      return result.value.href;
    });
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("https://site.com/");
  });
});
