import { keepStack } from "./support/config.js";
import { composeDown } from "./support/compose.js";

export default function globalTeardown(): void {
  if (!keepStack) {
    composeDown();
  }
}
