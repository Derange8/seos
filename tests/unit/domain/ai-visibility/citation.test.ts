import { describe, expect, it } from "vitest";
import type { Citation } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { citesDomain, normalizeHost } from "@/domain/ai-visibility/citation";

describe("normalizeHost", () => {
  it("strips scheme, path, port, and leading www", () => {
    expect(normalizeHost("https://www.acme.com:8080/blog/x?y=1")).toBe("acme.com");
  });
  it("accepts a bare domain without a scheme", () => {
    expect(normalizeHost("Acme.com")).toBe("acme.com");
  });
  it("keeps non-www subdomains", () => {
    expect(normalizeHost("https://blog.acme.com")).toBe("blog.acme.com");
  });
  it("returns null for empty or unparseable input", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
  });
});

const cite = (url: string): Citation => ({ url });

describe("citesDomain", () => {
  it("matches an exact domain citation", () => {
    expect(citesDomain([cite("https://acme.com/pricing")], "acme.com")).toBe(true);
  });
  it("matches a www citation for a bare target domain", () => {
    expect(citesDomain([cite("https://www.acme.com/")], "acme.com")).toBe(true);
  });
  it("matches a subdomain of the target", () => {
    expect(citesDomain([cite("https://blog.acme.com/post")], "acme.com")).toBe(true);
  });
  it("normalizes the target domain too (scheme/www ignored)", () => {
    expect(citesDomain([cite("https://acme.com")], "https://www.acme.com/")).toBe(true);
  });
  it("does NOT match a lookalike domain sharing a suffix", () => {
    expect(citesDomain([cite("https://notacme.com")], "acme.com")).toBe(false);
  });
  it("does NOT match the target used as a subdomain of an attacker host", () => {
    expect(citesDomain([cite("https://acme.com.evil.com/x")], "acme.com")).toBe(false);
  });
  it("returns true when at least one of several citations matches", () => {
    expect(
      citesDomain([cite("https://competitor.com"), cite("https://acme.com/x")], "acme.com")
    ).toBe(true);
  });
  it("returns false for an empty citation list (parametric answer)", () => {
    expect(citesDomain([], "acme.com")).toBe(false);
  });
  it("skips unparseable citation urls without throwing", () => {
    expect(citesDomain([cite("not a url"), cite("https://acme.com")], "acme.com")).toBe(true);
    expect(citesDomain([cite("not a url")], "acme.com")).toBe(false);
  });
  it("returns false when the target domain is unusable", () => {
    expect(citesDomain([cite("https://acme.com")], "")).toBe(false);
  });
});
