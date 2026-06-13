import type { SourceGroupReferencePort } from "../../../collector-profile-manager/application";
import type { ProfileSourceAccessSourceGroupId } from "../../../collector-profile-manager/domain";

export class FakeSourceGroupReferencePort implements SourceGroupReferencePort {
  public readonly calls: ProfileSourceAccessSourceGroupId[] = [];
  private readonly existingSourceGroupIds =
    new Set<ProfileSourceAccessSourceGroupId>();

  public constructor(
    sourceGroupIds: readonly ProfileSourceAccessSourceGroupId[] = [
      "source-group-1",
    ],
  ) {
    for (const sourceGroupId of sourceGroupIds) {
      this.existingSourceGroupIds.add(sourceGroupId);
    }
  }

  public setExists(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
    exists: boolean,
  ): void {
    if (exists) {
      this.existingSourceGroupIds.add(sourceGroupId);
      return;
    }

    this.existingSourceGroupIds.delete(sourceGroupId);
  }

  public async exists(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<boolean> {
    this.calls.push(sourceGroupId);

    return this.existingSourceGroupIds.has(sourceGroupId);
  }
}
