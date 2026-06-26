import { describe, expect, it } from "vitest";
import { effectiveScriptSources, isOriginAllowedByCsp, parseCspHeader } from "@/domain/auditing/services/csp-parser";

describe("parseCspHeader", () => {
  it("splits directives on semicolons and values on whitespace", () => {
    const directives = parseCspHeader("default-src 'self'; script-src 'self' https://example.com");
    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["script-src"]).toEqual(["'self'", "https://example.com"]);
  });

  it("lowercases directive names but preserves source casing", () => {
    const directives = parseCspHeader("Script-Src https://Example.com");
    expect(directives["script-src"]).toEqual(["https://Example.com"]);
  });

  it("tolerates trailing semicolons and extra whitespace", () => {
    const directives = parseCspHeader("  script-src 'self'  ;  ");
    expect(directives["script-src"]).toEqual(["'self'"]);
  });
});

describe("effectiveScriptSources", () => {
  it("prefers script-src over default-src when both are present", () => {
    const directives = parseCspHeader("default-src 'none'; script-src 'self'");
    expect(effectiveScriptSources(directives)).toEqual(["'self'"]);
  });

  it("falls back to default-src when script-src is absent", () => {
    const directives = parseCspHeader("default-src https://example.com");
    expect(effectiveScriptSources(directives)).toEqual(["https://example.com"]);
  });

  it("returns null when neither directive is present", () => {
    const directives = parseCspHeader("style-src 'self'");
    expect(effectiveScriptSources(directives)).toBeNull();
  });
});

describe("isOriginAllowedByCsp", () => {
  it("matches an exact origin", () => {
    expect(isOriginAllowedByCsp("https://www.googletagmanager.com", ["https://www.googletagmanager.com"])).toBe(true);
  });

  it("rejects an origin not covered by any source", () => {
    expect(isOriginAllowedByCsp("https://www.googletagmanager.com", ["'self'", "https://cdn.jsdelivr.net"])).toBe(false);
  });

  it("does not let 'self' cover a cross-origin source", () => {
    expect(isOriginAllowedByCsp("https://example.com", ["'self'"])).toBe(false);
  });

  it("matches a scheme-only wildcard", () => {
    expect(isOriginAllowedByCsp("https://anything.example.com", ["https:"])).toBe(true);
  });

  it("does not match a scheme-only wildcard for a different scheme", () => {
    expect(isOriginAllowedByCsp("http://example.com", ["https:"])).toBe(false);
  });

  it("matches a subdomain wildcard", () => {
    expect(isOriginAllowedByCsp("https://gtm.googletagmanager.com", ["https://*.googletagmanager.com"])).toBe(true);
  });

  it("does not let a subdomain wildcard match the bare apex domain", () => {
    expect(isOriginAllowedByCsp("https://googletagmanager.com", ["https://*.googletagmanager.com"])).toBe(false);
  });

  it("does not let a subdomain wildcard match an unrelated host", () => {
    expect(isOriginAllowedByCsp("https://evil.com", ["https://*.googletagmanager.com"])).toBe(false);
  });

  it("matches a bare hostname regardless of scheme", () => {
    expect(isOriginAllowedByCsp("https://example.com", ["example.com"])).toBe(true);
  });

  it("matches the wildcard '*' source against any origin", () => {
    expect(isOriginAllowedByCsp("https://anything.at.all", ["*"])).toBe(true);
  });

  it("never lets a nonce or hash token match an external origin", () => {
    expect(isOriginAllowedByCsp("https://example.com", ["'nonce-abc123'", "'sha256-abc123'"])).toBe(false);
  });

  it("matches when any one of several sources allows the origin", () => {
    expect(isOriginAllowedByCsp("https://example.com", ["'self'", "https://example.com"])).toBe(true);
  });
});
