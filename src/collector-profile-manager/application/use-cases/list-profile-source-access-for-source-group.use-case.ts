import {
  toProfileSourceAccessDto,
} from "../profile-source-access-dtos";
import type { ProfileSourceAccessDto } from "../profile-source-access-dtos";
import {
  validateProfileSourceAccessForApplication,
} from "../profile-source-access-validation";
import type {
  ProfileSourceAccessRepository,
} from "../ports/profile-source-access-repository.port";
import type { ProfileSourceAccessSourceGroupId } from "../../domain";

export interface ListProfileSourceAccessForSourceGroupInput {
  readonly sourceGroupId: ProfileSourceAccessSourceGroupId;
}

export class ListProfileSourceAccessForSourceGroupUseCase {
  public constructor(
    private readonly profileSourceAccess: ProfileSourceAccessRepository,
  ) {}

  public async execute(
    input: ListProfileSourceAccessForSourceGroupInput,
  ): Promise<readonly ProfileSourceAccessDto[]> {
    const items = await this.profileSourceAccess.listBySourceGroup(
      input.sourceGroupId,
    );

    return items
      .map((item) => validateProfileSourceAccessForApplication(item))
      .map((item) => toProfileSourceAccessDto(item));
  }
}
