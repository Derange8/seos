import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { HttpRobotsFetcher } from "@/infrastructure/crawler/http/http-robots-fetcher";
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

describe("HttpRobotsFetcher", () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it("fetches the raw robots.txt body on 200", async () => {
    const server = await startServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("User-agent: *\nDisallow: /admin/");
        return;
      }
      res.writeHead(404);
      res.end();
    });
    cleanup = server.close;

    const fetcher = new HttpRobotsFetcher({ allowPrivateNetworks: true });
    const result = await fetcher.fetchRobotsTxt(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("Disallow: /admin/");
  });

  it("returns null (not an error) when robots.txt doesn't exist", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(404);
      res.end("not found");
    });
    cleanup = server.close;

    const fetcher = new HttpRobotsFetcher({ allowPrivateNetworks: true });
    const result = await fetcher.fetchRobotsTxt(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns null (not an error) on a 5xx — an unreachable robots.txt must never fail the crawl", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(500);
      res.end("server error");
    });
    cleanup = server.close;

    const fetcher = new HttpRobotsFetcher({ allowPrivateNetworks: true });
    const result = await fetcher.fetchRobotsTxt(url(server.origin));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns null on a connection failure rather than propagating the error", async () => {
    const fetcher = new HttpRobotsFetcher({ allowPrivateNetworks: true });
    // Port 1 is reserved and nothing listens there.
    const result = await fetcher.fetchRobotsTxt(url("http://127.0.0.1:1"));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });
});
