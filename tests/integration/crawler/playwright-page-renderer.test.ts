import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { PlaywrightPageRenderer } from "@/infrastructure/crawler/playwright/playwright-page-renderer";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

async function startServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe("PlaywrightPageRenderer", () => {
  // These tests render a local 127.0.0.1 test server, which the SSRF guard
  // blocks by default — explicitly opted out here, the same way the
  // HttpPageFetcher integration tests do.
  const renderer = new PlaywrightPageRenderer({ allowPrivateNetworks: true });
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  afterAll(async () => {
    await renderer.close();
  });

  it("renders a page and reports renderMode as PLAYWRIGHT", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1 id='heading'>Rendered Page</h1></body></html>");
    });
    cleanup = server.close;

    const result = await renderer.render(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusCode).toBe(200);
      expect(result.value.html).toContain("Rendered Page");
      expect(result.value.renderMode).toBe("PLAYWRIGHT");
    }
  }, 30000);

  it("waits for an explicit selector when requested", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        "<html><body><div id='app'></div><script>setTimeout(() => { document.getElementById('app').innerHTML = '<p id=\"late\">late content</p>'; }, 100);</script></body></html>"
      );
    });
    cleanup = server.close;

    const result = await renderer.render(url(server.origin), { waitForSelector: "#late" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.html).toContain("late content");
    }
  }, 30000);

  it("returns TIMEOUT when navigation exceeds the configured timeout", async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end("too slow");
      }, 2000);
    });
    cleanup = server.close;

    const result = await renderer.render(url(server.origin), { timeoutMs: 200 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT");
    }
  }, 30000);

  it("blocks navigating to a private/loopback address by default", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>internal</body></html>");
    });
    cleanup = server.close;

    // A fresh, default-options renderer — not the shared one above that
    // opts out for these tests' own use of 127.0.0.1.
    const guardedRenderer = new PlaywrightPageRenderer();
    try {
      const result = await guardedRenderer.render(url(server.origin));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BLOCKED_PRIVATE_NETWORK");
      }
    } finally {
      await guardedRenderer.close();
    }
  }, 30000);
});
