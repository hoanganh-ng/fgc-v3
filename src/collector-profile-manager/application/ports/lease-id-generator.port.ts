import type { ProfileLeaseId } from "../../domain";

export interface LeaseIdGenerator {
  generateLeaseId(): Promise<ProfileLeaseId>;
}
