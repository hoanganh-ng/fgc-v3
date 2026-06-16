import {
  InvalidApplicationOperationError,
  InvalidProvisioningTokenError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import {
  assertUsableProvisioningToken,
  toIsoDateTime,
} from "../provisioning-token-policy";
import { validateProfileForApplication } from "../profile-validation";
import {
  markCollectorProfileSessionIngested,
  transitionCollectorProfileStatus,
} from "../../domain";
import type {
  BrowserCookie,
  CollectorProfile,
  IsoDateTime,
  LocalStorageEntry,
} from "../../domain";

export interface IngestProfileSessionInput {
  readonly provisioningToken: string;
  readonly cookies: readonly BrowserCookie[];
  readonly localStorage: readonly LocalStorageEntry[];
  readonly sessionExpiresAt?: IsoDateTime | null;
}

export class IngestProfileSessionUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: IngestProfileSessionInput,
  ): Promise<CollectorProfile> {
    if (input.cookies.length === 0) {
      throw new InvalidApplicationOperationError(
        "Session ingestion requires at least one cookie.",
      );
    }

    const profile = await this.profiles.findByProvisioningToken(
      input.provisioningToken,
    );

    if (profile === null) {
      throw new InvalidProvisioningTokenError();
    }

    const validProfile = validateProfileForApplication(profile);

    if (validProfile.identity.status !== "PENDING_LOGIN") {
      throw new InvalidApplicationOperationError(
        "Profile session ingestion requires a PENDING_LOGIN profile.",
      );
    }

    const now = this.clock.now();
    assertUsableProvisioningToken(validProfile, input.provisioningToken, now);

    const capturedAt = toIsoDateTime(now);
    const consumedToken = {
      status: "CONSUMED" as const,
      tokenHash: null,
      issuedAt: validProfile.provisioningToken.issuedAt,
      expiresAt: validProfile.provisioningToken.expiresAt,
      consumedAt: capturedAt,
    };
    const profileWithSession = markCollectorProfileSessionIngested(
      validProfile,
      capturedAt,
      {
        cookies: input.cookies,
        localStorage: input.localStorage,
        sessionExpiresAt: input.sessionExpiresAt ?? null,
      },
      consumedToken,
    );
    const readyProfile = transitionCollectorProfileStatus(
      profileWithSession,
      "READY",
      capturedAt,
    );
    const parsedProfile = validateProfileForApplication(readyProfile);

    await this.profiles.save(parsedProfile);

    return parsedProfile;
  }
}
