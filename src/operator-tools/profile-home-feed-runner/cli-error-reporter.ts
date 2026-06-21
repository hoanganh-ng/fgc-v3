export const UNEXPECTED_CLI_FAILURE_MESSAGE =
  "Profile home-feed runner failed unexpectedly.";

export function reportUnexpectedCliFailure(_error: unknown): void {
  process.exitCode = 1;
  console.error(UNEXPECTED_CLI_FAILURE_MESSAGE);
}
