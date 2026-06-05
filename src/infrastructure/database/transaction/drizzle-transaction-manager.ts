import type {
  CollectorProfileRepositoryContext,
  TransactionManager,
} from "../../../collector-profile-manager/application";
import type { CollectorProfileDatabase } from "../client";
import { DrizzleProfileLeaseRepository } from "../repositories/drizzle-profile-lease.repository";
import { DrizzleProfileRepository } from "../repositories/drizzle-profile.repository";

export class DrizzleTransactionManager implements TransactionManager {
  public constructor(private readonly db: CollectorProfileDatabase) {}

  public runInTransaction<T>(
    work: (repositories: CollectorProfileRepositoryContext) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        profiles: new DrizzleProfileRepository(tx),
        leases: new DrizzleProfileLeaseRepository(tx),
      }),
    );
  }
}
