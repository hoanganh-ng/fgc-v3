import { toIsoDateTime } from "../provisioning-token-policy";
import {
  toProfileSourceAccessDto,
} from "../profile-source-access-dtos";
import type { ProfileSourceAccessDto } from "../profile-source-access-dtos";
import {
  validateProfileSourceAccessForApplication,
} from "../profile-source-access-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type {
  ProfileSourceAccessRepository,
} from "../ports/profile-source-access-repository.port";
import {
  createProfileSourceAccess,
  updateProfileSourceAccess,
} from "../../domain";
import type {
  ProfileId,
  ProfileSourceAccessFailureReason,
  ProfileSourceAccessSourceGroupId,
  ProfileSourceAccessState,
} from "../../domain";

export interface UpsertProfileSourceAccessInput {
  readonly profileId: ProfileId;
  readonly sourceGroupId: ProfileSourceAccessSourceGroupId;
  readonly accessState: ProfileSourceAccessState;
  readonly lastFailureReason?: ProfileSourceAccessFailureReason | null;
  readonly notes?: string;
}

export class UpsertProfileSourceAccessUseCase {
  public constructor(
    private readonly profileSourceAccess: ProfileSourceAccessRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpsertProfileSourceAccessInput,
  ): Promise<ProfileSourceAccessDto> {
    const existing =
      await this.profileSourceAccess.getByProfileAndSourceGroup(
        input.profileId,
        input.sourceGroupId,
      );
    const checkedAt = toIsoDateTime(this.clock.now());
    const profileSourceAccess =
      existing === null
        ? createProfileSourceAccess({
            id: await this.ids.generateId(),
            profileId: input.profileId,
            sourceGroupId: input.sourceGroupId,
            accessState: input.accessState,
            checkedAt,
            ...(input.lastFailureReason !== undefined
              ? { lastFailureReason: input.lastFailureReason }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          })
        : updateProfileSourceAccess(
            validateProfileSourceAccessForApplication(existing),
            {
              accessState: input.accessState,
              checkedAt,
              ...(input.lastFailureReason !== undefined
                ? { lastFailureReason: input.lastFailureReason }
                : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
          );
    const validProfileSourceAccess =
      validateProfileSourceAccessForApplication(profileSourceAccess);

    await this.profileSourceAccess.upsert(validProfileSourceAccess);

    return toProfileSourceAccessDto(validProfileSourceAccess);
  }
}
