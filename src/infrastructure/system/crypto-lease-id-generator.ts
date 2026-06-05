import { randomUUID } from "node:crypto";
import type { LeaseIdGenerator } from "../../collector-profile-manager/application";
import type { ProfileLeaseId } from "../../collector-profile-manager/domain";

export class CryptoLeaseIdGenerator implements LeaseIdGenerator {
  public constructor(private readonly prefix = "lease") {}

  public async generateLeaseId(): Promise<ProfileLeaseId> {
    return `${this.prefix}-${randomUUID()}`;
  }
}
