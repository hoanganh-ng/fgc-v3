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
import type { ProfileId } from "../../domain";

export interface ListProfileSourceAccessForProfileInput {
  readonly profileId: ProfileId;
}

export class ListProfileSourceAccessForProfileUseCase {
  public constructor(
    private readonly profileSourceAccess: ProfileSourceAccessRepository,
  ) {}

  public async execute(
    input: ListProfileSourceAccessForProfileInput,
  ): Promise<readonly ProfileSourceAccessDto[]> {
    const items = await this.profileSourceAccess.listByProfile(input.profileId);

    return items
      .map((item) => validateProfileSourceAccessForApplication(item))
      .map((item) => toProfileSourceAccessDto(item));
  }
}
