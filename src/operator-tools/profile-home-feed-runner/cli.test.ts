import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  UNEXPECTED_CLI_FAILURE_MESSAGE,
  reportUnexpectedCliFailure,
} from "./cli-error-reporter";

interface CapturedError {
  readonly messages: string[];
}

describe("profile home-feed run-next CLI unexpected error handler", () => {
  let originalConsoleError: typeof console.error;
  let originalExitCode: string | number | undefined;
  let captured: CapturedError;

  beforeEach(() => {
    captured = { messages: [] };
    originalConsoleError = console.error;
    console.error = (message: unknown) => {
      captured.messages.push(String(message));
    };
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
  });

  it("prints the fixed safe message for a thrown error containing sensitive data", () => {
    const sensitiveError = new Error(
      "Cookie: c_user=abc; localStorage=session-cookie-value; " +
        "authorization: Bearer xyz; " +
        "proxy user:pass@example.com " +
        "DATABASE_URL=postgres://user:pass@db.test:5432/app " +
        "upstream https://internal.example.com/secret",
    );

    reportUnexpectedCliFailure(sensitiveError);

    expect(captured.messages).toEqual([UNEXPECTED_CLI_FAILURE_MESSAGE]);
    expect(process.exitCode).toBe(1);
    const serialized = captured.messages.join("\n");
    expect(serialized).not.toContain("cookie");
    expect(serialized).not.toContain("localStorage");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("proxy");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("internal.example.com");
    expect(serialized).not.toContain("session-cookie-value");
    expect(serialized).not.toContain("Bearer xyz");
  });

  it("prints the fixed safe message for non-Error rejections", () => {
    reportUnexpectedCliFailure("plain string rejection with proxy credentials");
    reportUnexpectedCliFailure({ secret: "value" });

    expect(captured.messages).toEqual([
      UNEXPECTED_CLI_FAILURE_MESSAGE,
      UNEXPECTED_CLI_FAILURE_MESSAGE,
    ]);
    expect(process.exitCode).toBe(1);
    const serialized = captured.messages.join("\n");
    expect(serialized).not.toContain("proxy");
    expect(serialized).not.toContain("secret");
  });
});

describe("profile home-feed run-next CLI unexpected error handler module", () => {
  it("does not install signal handlers on import", async () => {
    const originalSigintListeners = process.listeners("SIGINT").slice();
    const originalSigtermListeners = process.listeners("SIGTERM").slice();
    const originalExitCodeBefore = process.exitCode;

    await import("./cli-error-reporter");

    expect(process.listeners("SIGINT")).toEqual(originalSigintListeners);
    expect(process.listeners("SIGTERM")).toEqual(originalSigtermListeners);
    expect(process.exitCode).toBe(originalExitCodeBefore);
  });

  it("exposes only the safe message and reporter", async () => {
    const module = await import("./cli-error-reporter");
    const exportedNames = Object.keys(module).sort();

    expect(exportedNames).toEqual([
      "UNEXPECTED_CLI_FAILURE_MESSAGE",
      "reportUnexpectedCliFailure",
    ]);
    expect(module.UNEXPECTED_CLI_FAILURE_MESSAGE).toBe(
      "Profile home-feed runner failed unexpectedly.",
    );
  });
});
