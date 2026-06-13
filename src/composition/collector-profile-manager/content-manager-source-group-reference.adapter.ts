import type { SourceGroupReferencePort } from "../../collector-profile-manager/application";
import type { ProfileSourceAccessSourceGroupId } from "../../collector-profile-manager/domain";
import {
  SourceGroupNotFoundError,
  type GetSourceGroupInput,
} from "../../content-manager/application";
import type { SourceGroup } from "../../content-manager/domain";

interface GetSourceGroupUseCase {
  execute(input: GetSourceGroupInput): Promise<SourceGroup>;
}

export class ContentManagerSourceGroupReferenceAdapter
  implements SourceGroupReferencePort
{
  public constructor(private readonly getSourceGroup: GetSourceGroupUseCase) {}

  public async exists(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<boolean> {
    try {
      await this.getSourceGroup.execute({ sourceGroupId });

      return true;
    } catch (error) {
      if (error instanceof SourceGroupNotFoundError) {
        return false;
      }

      throw error;
    }
  }
}
