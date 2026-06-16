export type ProfileReferenceResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly accountStage: string;
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
