import { resolveTxt } from "node:dns/promises";
import type { DomainOwnershipPort } from "@/application/projects/ports/domain-ownership-port";

const FILE_CHECK_TIMEOUT_MS = 10_000;

export class DomainOwnershipChecker implements DomainOwnershipPort {
  async checkDnsTxtRecord(recordName: string, expectedValue: string): Promise<boolean> {
    try {
      const records = await resolveTxt(recordName);
      // Each TXT record can be split into multiple quoted chunks by the
      // resolver; concatenate before comparing.
      return records.some((chunks) => chunks.join("") === expectedValue);
    } catch {
      // NXDOMAIN, no TXT records, resolver timeout, etc. — all just mean
      // "not verified yet", not a hard failure (DomainOwnershipPort).
      return false;
    }
  }

  async checkWellKnownFile(fileUrl: string, expectedValue: string): Promise<boolean> {
    try {
      const response = await fetch(fileUrl, { signal: AbortSignal.timeout(FILE_CHECK_TIMEOUT_MS) });
      if (!response.ok) return false;
      const text = (await response.text()).trim();
      return text === expectedValue;
    } catch {
      return false;
    }
  }
}
