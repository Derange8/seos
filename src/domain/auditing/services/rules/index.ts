import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import { missingTitleRule } from "@/domain/auditing/services/rules/missing-title-rule";
import { titleLengthRule } from "@/domain/auditing/services/rules/title-length-rule";
import { missingMetaDescriptionRule } from "@/domain/auditing/services/rules/missing-meta-description-rule";
import { metaDescriptionLengthRule } from "@/domain/auditing/services/rules/meta-description-length-rule";
import { missingH1Rule } from "@/domain/auditing/services/rules/missing-h1-rule";
import { thinContentRule } from "@/domain/auditing/services/rules/thin-content-rule";
import { brokenStatusCodeRule } from "@/domain/auditing/services/rules/broken-status-code-rule";
import { missingCanonicalRule } from "@/domain/auditing/services/rules/missing-canonical-rule";
import { slowResponseTimeRule } from "@/domain/auditing/services/rules/slow-response-time-rule";
import { missingStructuredDataRule } from "@/domain/auditing/services/rules/missing-structured-data-rule";
import { brokenInternalLinksRule } from "@/domain/auditing/services/rules/broken-internal-links-rule";
import { missingImageAltRule } from "@/domain/auditing/services/rules/missing-image-alt-rule";
import { mixedContentRule } from "@/domain/auditing/services/rules/mixed-content-rule";
import { redirectChainRule } from "@/domain/auditing/services/rules/redirect-chain-rule";
import { duplicateTitleRule } from "@/domain/auditing/services/rules/duplicate-title-rule";
import { duplicateMetaDescriptionRule } from "@/domain/auditing/services/rules/duplicate-meta-description-rule";
import { duplicateContentRule } from "@/domain/auditing/services/rules/duplicate-content-rule";
import { multipleH1Rule } from "@/domain/auditing/services/rules/multiple-h1-rule";
import { multipleCanonicalRule } from "@/domain/auditing/services/rules/multiple-canonical-rule";
import { noindexRule } from "@/domain/auditing/services/rules/noindex-rule";
import { orphanPageRule } from "@/domain/auditing/services/rules/orphan-page-rule";

// The plugin registry — adding a rule means writing one AuditRule and
// listing it here, nothing else in the engine needs to change.
export const DEFAULT_AUDIT_RULES: readonly AuditRule[] = [
  missingTitleRule,
  titleLengthRule,
  missingMetaDescriptionRule,
  metaDescriptionLengthRule,
  missingH1Rule,
  thinContentRule,
  brokenStatusCodeRule,
  missingCanonicalRule,
  slowResponseTimeRule,
  missingStructuredDataRule,
  brokenInternalLinksRule,
  missingImageAltRule,
  mixedContentRule,
  redirectChainRule,
  duplicateTitleRule,
  duplicateMetaDescriptionRule,
  duplicateContentRule,
  multipleH1Rule,
  multipleCanonicalRule,
  noindexRule,
  orphanPageRule,
];
