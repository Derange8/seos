import { DomainError } from "@/shared/domain-error";
import type { DomainName } from "@/domain/projects/value-objects/domain-name";

export class ProjectNotFoundError extends DomainError {
  readonly code = "PROJECT_NOT_FOUND";
}

// Gates write-capable integrations (WordPress connect) only — crawling/
// auditing a domain is read-only, the same as any SEO audit tool or search
// engine crawler, and doesn't need proof of ownership. Verification matters
// once Seos is asked to store credentials and push real changes to a live
// site; it never mattered for just reading one.
export class DomainNotVerifiedError extends DomainError {
  readonly code = "DOMAIN_NOT_VERIFIED";
}

const WELL_KNOWN_VERIFICATION_PATH = "/.well-known/seos-verify.txt";

export interface ProjectProps {
  id: string;
  name: string;
  domain: DomainName;
  verificationToken: string;
  domainVerifiedAt: Date | null;
}

// Single-project desktop program: a verified owner may crawl a domain, but
// verification is required first — this entity holds that state, the
// actual DNS/HTTP checks live behind DomainOwnershipPort.
export class Project {
  private constructor(private readonly props: ProjectProps) {}

  static create(name: string, domain: DomainName): Project {
    return new Project({
      id: crypto.randomUUID(),
      name,
      domain,
      verificationToken: crypto.randomUUID(),
      domainVerifiedAt: null,
    });
  }

  static reconstitute(props: ProjectProps): Project {
    return new Project(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get domain(): DomainName {
    return this.props.domain;
  }

  get verificationToken(): string {
    return this.props.verificationToken;
  }

  get domainVerifiedAt(): Date | null {
    return this.props.domainVerifiedAt;
  }

  get isVerified(): boolean {
    return this.props.domainVerifiedAt !== null;
  }

  // _seos-challenge.<domain> — a dedicated subdomain record name, so the
  // check never collides with a customer's own unrelated TXT records.
  get dnsTxtRecordName(): string {
    return `_seos-challenge.${this.domain.value}`;
  }

  get wellKnownFileUrl(): string {
    return `https://${this.domain.value}${WELL_KNOWN_VERIFICATION_PATH}`;
  }

  // Idempotent: verifying an already-verified project is a harmless no-op,
  // not an error — there's no invariant a second "yes, still verified" call
  // could violate.
  markVerified(): void {
    if (!this.isVerified) {
      this.props.domainVerifiedAt = new Date();
    }
  }
}
