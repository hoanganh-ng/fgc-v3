import { randomBytes } from "node:crypto";
import type { TokenGenerator } from "../../collector-profile-manager/application";

export class CryptoTokenGenerator implements TokenGenerator {
  public constructor(private readonly tokenByteLength = 32) {}

  public async generateToken(): Promise<string> {
    return randomBytes(this.tokenByteLength).toString("base64url");
  }
}
