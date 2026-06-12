import type {
  CollectorProfileManagerHttpService,
} from "../routes/collector-profile-manager.routes";

export function createUnusedCollectorProfileManagerHttpService(): CollectorProfileManagerHttpService {
  const useCase = {
    async execute(_input: unknown): Promise<unknown> {
      throw new Error("Collector Profile Manager service was not expected.");
    },
  };

  return {
    createProfile: useCase,
    getProfile: useCase,
    listProfiles: useCase,
    updateProfileConfiguration: useCase,
    updateProfileAccountStage: useCase,
    startProfileProvisioning: useCase,
    getProvisioningConfiguration: useCase,
    getRuntimeProfileConfiguration: useCase,
    ingestProfileSession: useCase,
    checkoutProfile: useCase,
    releaseProfileLease: useCase,
  } as unknown as CollectorProfileManagerHttpService;
}
