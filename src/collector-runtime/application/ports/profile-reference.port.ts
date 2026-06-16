export type CollectorRuntimeAccountStage =
  | "NEW_ACCOUNT"
  | "WARMING"
  | "COLLECTION_READY"
  | "LIMITED"
  | "NEEDS_REVIEW"
  | "RETIRED";

export type ProfileReferenceResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly accountStage: CollectorRuntimeAccountStage;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface ProfileReferencePort {
  getProfileAccountStage(profileId: string): Promise<ProfileReferenceResult>;
}
