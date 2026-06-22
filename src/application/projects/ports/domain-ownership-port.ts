// Both checks collapse any failure (DNS down, record absent, file missing,
// network error) to `false` — "not verified yet" is the only outcome a
// caller can act on; there's no different action for "DNS is down" vs "the
// record just isn't there".
export interface DomainOwnershipPort {
  checkDnsTxtRecord(recordName: string, expectedValue: string): Promise<boolean>;
  checkWellKnownFile(fileUrl: string, expectedValue: string): Promise<boolean>;
}
