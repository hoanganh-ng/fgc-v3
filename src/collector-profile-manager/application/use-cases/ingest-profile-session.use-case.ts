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
import { transitionCollectorProfileStatus } from "../../domain";
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
    const profileWithSession: CollectorProfile = {
      ...validProfile,
      authenticationState: {
        cookies: [...input.cookies],
        localStorage: [...input.localStorage],
        sessionCapturedAt: capturedAt,
        sessionExpiresAt: input.sessionExpiresAt ?? null,
      },
      provisioningToken: {
        status: "CONSUMED",
        tokenHash: null,
        issuedAt: validProfile.provisioningToken.issuedAt,
        expiresAt: validProfile.provisioningToken.expiresAt,
        consumedAt: capturedAt,
      },
    };
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
