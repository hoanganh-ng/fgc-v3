import { createHash, randomBytes } from "node:crypto";
import type { TokenGenerator } from "@dtpm/core";

export class CryptoTokenGenerator implements TokenGenerator {
  async generateProvisioningToken(): Promise<{ rawToken: string; tokenHash: string }> {
    const rawToken = randomBytes(32).toString("base64url");
    return {
      rawToken,
      tokenHash: await this.hashProvisioningToken(rawToken)
    };
  }

  async hashProvisioningToken(rawToken: string): Promise<string> {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }
}
