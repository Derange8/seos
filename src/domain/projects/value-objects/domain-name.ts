import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class InvalidDomainNameError extends DomainError {
  readonly code = "INVALID_DOMAIN_NAME";
}

// A bare registrable hostname (e.g. "example.com"), not a full URL — what a
// Project is verified against. Deliberately distinct from the Url value
// object used by the crawling context.
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export class DomainName {
  private constructor(private readonly hostname: string) {}

  static create(input: string): Result<DomainName, InvalidDomainNameError> {
    const normalized = input.trim().toLowerCase();
    if (!DOMAIN_PATTERN.test(normalized)) {
      return err(new InvalidDomainNameError(`"${input}" is not a valid domain name`));
    }
    return ok(new DomainName(normalized));
  }

  get value(): string {
    return this.hostname;
  }

  equals(other: DomainName): boolean {
    return this.hostname === other.hostname;
  }

  toString(): string {
    return this.hostname;
  }
}
