import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@dtpm/core";

export class UuidGenerator implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}
