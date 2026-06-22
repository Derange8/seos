import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "@/infrastructure/security/credential-cipher";

describe("credential-cipher", () => {
  const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "cxwoFsx6+cS3WlObH+HvJkyEKIst7SV2W1hOoCpVTR0=";
  });

  afterEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a plaintext value through encrypt/decrypt", () => {
    const encrypted = encryptCredential("my-application-password");
    expect(decryptCredential(encrypted)).toBe("my-application-password");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptCredential("same-input");
    const b = encryptCredential("same-input");
    expect(a).not.toBe(b);
    expect(decryptCredential(a)).toBe("same-input");
    expect(decryptCredential(b)).toBe("same-input");
  });

  it("throws when CREDENTIAL_ENCRYPTION_KEY is not set", () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptCredential("x")).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  });

  it("throws when CREDENTIAL_ENCRYPTION_KEY does not decode to 32 bytes", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptCredential("x")).toThrow(/32 bytes/);
  });

  it("throws when decrypting with the wrong key (auth tag mismatch)", () => {
    const encrypted = encryptCredential("secret");
    process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    expect(() => decryptCredential(encrypted)).toThrow();
  });
});
