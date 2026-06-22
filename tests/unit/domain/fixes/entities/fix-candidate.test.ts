import { describe, expect, it } from "vitest";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { isErr, isOk } from "@/shared/result";

describe("FixCandidate", () => {
  it("starts out DRAFT with no previousValue", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    expect(fix.status).toBe("DRAFT");
    expect(fix.previousValue).toBeNull();
  });

  it("markApplied() transitions DRAFT -> APPLIED and captures previousValue", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    const result = fix.markApplied("Old Title");
    expect(isOk(result)).toBe(true);
    expect(fix.status).toBe("APPLIED");
    expect(fix.previousValue).toBe("Old Title");
  });

  it("markApplied() fails when already APPLIED", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    fix.markApplied("Old Title");

    const result = fix.markApplied("Another Old Title");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe("INVALID_FIX_CANDIDATE_STATE");
    expect(fix.previousValue).toBe("Old Title");
  });

  it("markFailed() transitions DRAFT -> FAILED", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    const result = fix.markFailed();
    expect(isOk(result)).toBe(true);
    expect(fix.status).toBe("FAILED");
  });

  it("markApplied() succeeds from FAILED (retry after a failed attempt)", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    fix.markFailed();

    const result = fix.markApplied("Old Title");

    expect(isOk(result)).toBe(true);
    expect(fix.status).toBe("APPLIED");
  });

  it("markFailed() fails when already APPLIED", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    fix.markApplied("Old Title");

    const result = fix.markFailed();

    expect(isErr(result)).toBe(true);
    expect(fix.status).toBe("APPLIED");
  });

  it("revert() transitions APPLIED -> DRAFT and clears previousValue", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");
    fix.markApplied("Old Title");

    const result = fix.revert();

    expect(isOk(result)).toBe(true);
    expect(fix.status).toBe("DRAFT");
    expect(fix.previousValue).toBeNull();
  });

  it("revert() fails when not currently APPLIED", () => {
    const fix = FixCandidate.createRuleBased("issue-1", "page-1", "TITLE", "A Generated Title");

    const result = fix.revert();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe("INVALID_FIX_CANDIDATE_STATE");
  });
});
