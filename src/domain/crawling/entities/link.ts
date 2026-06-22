import type { Url } from "@/domain/crawling/value-objects/url";

export interface LinkProps {
  id: string;
  pageId: string;
  targetUrl: Url;
  isInternal: boolean;
  isBroken: boolean;
}

export class Link {
  private constructor(private readonly props: LinkProps) {}

  static create(pageId: string, sourceOrigin: Url, targetUrl: Url): Link {
    return new Link({
      id: crypto.randomUUID(),
      pageId,
      targetUrl,
      isInternal: sourceOrigin.isSameOrigin(targetUrl),
      isBroken: false,
    });
  }

  static reconstitute(props: LinkProps): Link {
    return new Link(props);
  }

  get id(): string {
    return this.props.id;
  }

  get pageId(): string {
    return this.props.pageId;
  }

  get targetUrl(): Url {
    return this.props.targetUrl;
  }

  get isInternal(): boolean {
    return this.props.isInternal;
  }

  get isBroken(): boolean {
    return this.props.isBroken;
  }

  markBroken(): void {
    this.props.isBroken = true;
  }
}
