import type { ProfileLeaseRepository } from "./profile-lease-repository.port";
import type { ProfileRepository } from "./profile-repository.port";
import type { ProfileSourceAccessRepository } from "./profile-source-access-repository.port";

export interface CollectorProfileRepositoryContext {
  readonly profiles: ProfileRepository;
  readonly leases: ProfileLeaseRepository;
  readonly profileSourceAccess: ProfileSourceAccessRepository;
}

export interface TransactionManager {
  runInTransaction<T>(
    work: (repositories: CollectorProfileRepositoryContext) => Promise<T>,
  ): Promise<T>;
}
