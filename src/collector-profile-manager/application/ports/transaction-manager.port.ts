import type { ProfileLeaseRepository } from "./profile-lease-repository.port";
import type { ProfileRepository } from "./profile-repository.port";

export interface CollectorProfileRepositoryContext {
  readonly profiles: ProfileRepository;
  readonly leases: ProfileLeaseRepository;
}

export interface TransactionManager {
  runInTransaction<T>(
    work: (repositories: CollectorProfileRepositoryContext) => Promise<T>,
  ): Promise<T>;
}
