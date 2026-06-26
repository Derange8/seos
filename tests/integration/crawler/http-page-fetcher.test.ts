import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { HttpPageFetcher } from "@/infrastructure/crawler/http/http-page-fetcher";
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

describe("HttpPageFetcher", () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it("fetches a 200 response and reports the renderMode as HTTP", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>hello</body></html>");
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusCode).toBe(200);
      expect(result.value.html).toContain("hello");
      expect(result.value.renderMode).toBe("HTTP");
      expect(result.value.redirectChain).toHaveLength(0);
    }
  });

  it("follows redirects and records the chain", async () => {
    const server = await startServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { location: "/final" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>final destination</body></html>");
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(`${server.origin}/start`));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusCode).toBe(200);
      expect(result.value.html).toContain("final destination");
      expect(result.value.redirectChain).toEqual([`${server.origin}/start`]);
      expect(result.value.finalUrl.href).toBe(`${server.origin}/final`);
    }
  });

  it("returns REDIRECT_LOOP once the chain exceeds the hop limit", async () => {
    const server = await startServer((req, res) => {
      const next = req.url === "/a" ? "/b" : "/a";
      res.writeHead(302, { location: next });
      res.end();
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(`${server.origin}/a`));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REDIRECT_LOOP");
    }
  });

  it("returns TIMEOUT when the server is slower than the configured timeout", async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end("too slow");
      }, 500);
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 50, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT");
    }
  });

  it("returns CONNECTION_ERROR when nothing is listening on the port", async () => {
    const server = await startServer((_req, res) => res.end());
    const { origin } = server;
    await server.close();
    cleanup = null;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(origin));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONNECTION_ERROR");
    }
  });

  it("returns DNS_FAILURE for a domain that cannot resolve", async () => {
    const fetcher = new HttpPageFetcher({ timeoutMs: 5000 });
    const result = await fetcher.fetch(url("https://this-domain-should-not-exist-1234567.invalid/"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DNS_FAILURE");
    }
  }, 10000);

  it("blocks fetching a target that resolves to a private/loopback address by default", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>internal</body></html>");
    });
    cleanup = server.close;

    // No allowPrivateNetworks override — this is the production default,
    // and 127.0.0.1 is exactly the kind of address the SSRF guard exists
    // to block.
    const fetcher = new HttpPageFetcher({ timeoutMs: 2000 });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BLOCKED_PRIVATE_NETWORK");
    }
  });

  it("captures the Content-Security-Policy response header when present", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-security-policy": "default-src 'self'" });
      res.end("<html><body>hello</body></html>");
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cspHeader).toBe("default-src 'self'");
  });

  it("returns a null cspHeader when the response has no CSP header", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>hello</body></html>");
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cspHeader).toBeNull();
  });

  it("treats a non-2xx status as a successful fetch result, not a port error", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(404);
      res.end("not found");
    });
    cleanup = server.close;

    const fetcher = new HttpPageFetcher({ timeoutMs: 2000, allowPrivateNetworks: true });
    const result = await fetcher.fetch(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusCode).toBe(404);
    }
  });
});
