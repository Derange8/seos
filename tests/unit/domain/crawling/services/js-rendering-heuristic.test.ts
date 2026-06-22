import { describe, expect, it } from "vitest";
import { needsRendering } from "@/domain/crawling/services/js-rendering-heuristic";

describe("needsRendering", () => {
  it("returns false for a normal server-rendered page", () => {
    const html = `<html><body><h1>Welcome</h1><p>${"Lots of real content. ".repeat(20)}</p></body></html>`;
    expect(needsRendering(html)).toBe(false);
  });

  it("returns true for a near-empty SPA shell with a #root div", () => {
    const html = `<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
    expect(needsRendering(html)).toBe(true);
  });

  it("returns true for a near-empty SPA shell with an #app div", () => {
    const html = `<html><body><div id="app"></div></body></html>`;
    expect(needsRendering(html)).toBe(true);
  });

  it("returns false when a #root div is present but already has substantial content", () => {
    const html = `<html><body><div id="root"><p>${"Server-rendered content. ".repeat(20)}</p></div></body></html>`;
    expect(needsRendering(html)).toBe(false);
  });

  it("returns true when a noscript warning instructs users to enable JavaScript", () => {
    const html = `<html><body><noscript>Please enable JavaScript to run this app.</noscript><div id="root"></div></body></html>`;
    expect(needsRendering(html)).toBe(true);
  });

  it("returns false for an empty page with no SPA shell markers at all", () => {
    const html = `<html><body></body></html>`;
    expect(needsRendering(html)).toBe(false);
  });
});
