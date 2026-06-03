import { composeDown, composeUp, waitForHealth } from "./support/compose.js";

export default async function globalSetup(): Promise<void> {
  composeDown();
  composeUp();
  await waitForHealth();
}
