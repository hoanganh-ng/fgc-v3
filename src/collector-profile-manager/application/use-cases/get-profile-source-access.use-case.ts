import {
  toProfileSourceAccessDto,
} from "../profile-source-access-dtos";
import type { ProfileSourceAccessDto } from "../profile-source-access-dtos";
import {
  loadValidatedProfileSourceAccessByProfileAndSourceGroup,
} from "../profile-source-access-validation";
import type {
  ProfileSourceAccessRepository,
} from "../ports/profile-source-access-repository.port";
import type {
  ProfileId,
  ProfileSourceAccessSourceGroupId,
} from "../../domain";

export interface GetProfileSourceAccessInput {
  readonly profileId: ProfileId;
  readonly sourceGroupId: ProfileSourceAccessSourceGroupId;
}

export class GetProfileSourceAccessUseCase {
  public constructor(
    private readonly profileSourceAccess: ProfileSourceAccessRepository,
  ) {}

  public async execute(
    input: GetProfileSourceAccessInput,
  ): Promise<ProfileSourceAccessDto> {
    const profileSourceAccess =
      await loadValidatedProfileSourceAccessByProfileAndSourceGroup(
        this.profileSourceAccess,
        input.profileId,
        input.sourceGroupId,
      );

    return toProfileSourceAccessDto(profileSourceAccess);
  }
}
