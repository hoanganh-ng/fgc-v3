import { randomUUID } from "node:crypto";

export class CryptoIdGenerator {
  public constructor(private readonly prefix?: string) {}

  public async generateId(): Promise<string> {
    const id = randomUUID();

    return this.prefix === undefined ? id : `${this.prefix}-${id}`;
  }
}
