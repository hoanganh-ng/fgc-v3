import type {
  ProfileSourceAccessCheckRunListQuery,
  ProfileSourceAccessCheckRunListResult,
  ProfileSourceAccessCheckRunRepository,
} from "../ports/profile-source-access-check-run-repository.port";
import { validateProfileSourceAccessCheckRunForApplication } from "../profile-source-access-check-run-validation";

export class ListProfileSourceAccessCheckRunsUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
  ) {}

  public async execute(
    query: ProfileSourceAccessCheckRunListQuery,
  ): Promise<ProfileSourceAccessCheckRunListResult> {
    const { items, total } = await this.checkRuns.list(query);

    return {
      items: items.map(validateProfileSourceAccessCheckRunForApplication),
      ...(total !== undefined ? { total } : {}),
    };
  }
}
