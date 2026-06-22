import { describe, expect, it } from "vitest";
import { isPrivateOrReservedIp } from "@/infrastructure/crawler/http/private-network-guard";

describe("isPrivateOrReservedIp", () => {
  it("blocks loopback addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
  });

  it("blocks the cloud metadata link-local range", () => {
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
  });

  it("blocks RFC 1918 private ranges", () => {
    expect(isPrivateOrReservedIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 addresses pointing at a private range", () => {
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("blocks IPv6 unique-local and link-local ranges", () => {
    expect(isPrivateOrReservedIp("fd00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("allows ordinary public IPv4 and IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false); // example.com
    expect(isPrivateOrReservedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("fails closed for a value that isn't a parseable IP at all", () => {
    expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
  });
});
