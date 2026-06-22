import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain-error";

class InvalidUrlError extends DomainError {
  readonly code = "INVALID_URL";
}

describe("DomainError", () => {
  it("sets the message and name from the concrete subclass", () => {
    const error = new InvalidUrlError("not a valid url");
    expect(error.message).toBe("not a valid url");
    expect(error.name).toBe("InvalidUrlError");
    expect(error.code).toBe("INVALID_URL");
  });

  it("is a real Error instance", () => {
    const error = new InvalidUrlError("not a valid url");
    expect(error).toBeInstanceOf(Error);
  });
});
