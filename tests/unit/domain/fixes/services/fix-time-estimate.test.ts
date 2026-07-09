import { describe, expect, it } from "vitest";
import { estimateFixTime } from "@/domain/fixes/services/fix-time-estimate";

describe("estimateFixTime", () => {
  it("estimates one minute for any fix type with a ready candidate", () => {
    expect(estimateFixTime("technical", "TITLE")).toBe("ONE_MINUTE");
    expect(estimateFixTime("content", "META_DESCRIPTION")).toBe("ONE_MINUTE");
    expect(estimateFixTime("content", "H1")).toBe("ONE_MINUTE");
    expect(estimateFixTime("technical", "CANONICAL_URL")).toBe("ONE_MINUTE");
  });

  it("estimates fifteen-plus minutes for manual content/structured-data issues", () => {
    expect(estimateFixTime("content", null)).toBe("FIFTEEN_MINUTES_PLUS");
    expect(estimateFixTime("structured_data", null)).toBe("FIFTEEN_MINUTES_PLUS");
    expect(estimateFixTime("performance", null)).toBe("FIFTEEN_MINUTES_PLUS");
  });

  it("estimates five minutes for manual technical issues", () => {
    expect(estimateFixTime("technical", null)).toBe("FIVE_MINUTES");
  });
});
