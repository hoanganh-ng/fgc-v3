import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_PROVISIONING_BASE_URL,
  ProfileProvisioningCliArgumentError,
  ProfileProvisioningCliHelpRequested,
  getProfileProvisioningCliUsage,
  parseProfileProvisioningCliArgs,
} from "./cli-args";

describe("parseProfileProvisioningCliArgs", () => {
  it("parses the required token and explicit base URL", () => {
    expect(
      parseProfileProvisioningCliArgs([
        "--token",
        " provisioning-token-1 ",
        "--base-url",
        " http://localhost:8081 ",
      ]),
    ).toEqual({
      token: "provisioning-token-1",
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
    });
  });

  it("supports inline option values", () => {
    expect(
      parseProfileProvisioningCliArgs([
        "--token=provisioning-token-1",
        "--base-url=https://profile-manager.test/api",
      ]),
    ).toEqual({
      token: "provisioning-token-1",
      baseUrl: "https://profile-manager.test/api",
      browserProvider: "playwright",
    });
  });

  it("tolerates the pnpm argument separator passed through to the script", () => {
    expect(
      parseProfileProvisioningCliArgs([
        "--",
        "--token",
        "provisioning-token-1",
        "--base-url",
        "http://localhost:8081",
      ]),
    ).toEqual({
      token: "provisioning-token-1",
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
    });
  });

  it("uses environment base URL defaults before the local API default", () => {
    expect(
      parseProfileProvisioningCliArgs(["--token", "token-1"], {
        PROFILE_PROVISIONING_BASE_URL: " http://localhost:8081 ",
        PROFILE_MANAGER_BASE_URL: "http://localhost:3000",
      }),
    ).toEqual({
      token: "token-1",
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
    });

    expect(
      parseProfileProvisioningCliArgs(["--token", "token-1"], {
        PROFILE_MANAGER_BASE_URL: " http://localhost:3000 ",
      }),
    ).toEqual({
      token: "token-1",
      baseUrl: "http://localhost:3000",
      browserProvider: "playwright",
    });

    expect(parseProfileProvisioningCliArgs(["--token", "token-1"])).toEqual({
      token: "token-1",
      baseUrl: DEFAULT_PROFILE_PROVISIONING_BASE_URL,
      browserProvider: "playwright",
    });
  });

  it("uses CLI browser provider before BROWSER_PROVIDER and the Playwright default", () => {
    expect(
      parseProfileProvisioningCliArgs(
        [
          "--token",
          "token-1",
          "--browser-provider",
          " cloakbrowser ",
        ],
        {
          BROWSER_PROVIDER: "playwright",
        },
      ),
    ).toEqual({
      token: "token-1",
      baseUrl: DEFAULT_PROFILE_PROVISIONING_BASE_URL,
      browserProvider: "cloakbrowser",
    });

    expect(
      parseProfileProvisioningCliArgs(["--token", "token-1"], {
        BROWSER_PROVIDER: " cloakbrowser ",
      }),
    ).toEqual({
      token: "token-1",
      baseUrl: DEFAULT_PROFILE_PROVISIONING_BASE_URL,
      browserProvider: "cloakbrowser",
    });

    expect(parseProfileProvisioningCliArgs(["--token", "token-1"])).toEqual({
      token: "token-1",
      baseUrl: DEFAULT_PROFILE_PROVISIONING_BASE_URL,
      browserProvider: "playwright",
    });
  });

  it("rejects invalid browser providers", () => {
    expect(() =>
      parseProfileProvisioningCliArgs([
        "--token",
        "token-1",
        "--browser-provider",
        "unknown",
      ]),
    ).toThrow("Unknown browser provider. Use playwright or cloakbrowser.");

    expect(() =>
      parseProfileProvisioningCliArgs(["--token", "token-1"], {
        BROWSER_PROVIDER: "unknown",
      }),
    ).toThrow("Unknown browser provider. Use playwright or cloakbrowser.");
  });

  it("fails fast when the token is missing or empty", () => {
    expect(() => parseProfileProvisioningCliArgs([])).toThrow(
      new ProfileProvisioningCliArgumentError("--token is required."),
    );
    expect(() =>
      parseProfileProvisioningCliArgs(["--token", " "]),
    ).toThrow("--token is required.");
    expect(() =>
      parseProfileProvisioningCliArgs(["--token="]),
    ).toThrow("--token requires a value.");
  });

  it("fails safely for missing values and unexpected arguments", () => {
    expect(() =>
      parseProfileProvisioningCliArgs(["--token", "--base-url"]),
    ).toThrow("--token requires a value.");
    expect(() =>
      parseProfileProvisioningCliArgs([
        "--token",
        "token-1",
        "raw-token-looking-positional",
      ]),
    ).toThrow("Unexpected positional argument.");
    expect(() =>
      parseProfileProvisioningCliArgs(["--token", "token-1", "--wat"]),
    ).toThrow("Unknown option --wat.");
  });

  it("rejects invalid or credential-bearing base URLs", () => {
    expect(() =>
      parseProfileProvisioningCliArgs([
        "--token",
        "token-1",
        "--base-url",
        "ftp://profile-manager.test",
      ]),
    ).toThrow("--base-url must use http or https.");
    expect(() =>
      parseProfileProvisioningCliArgs([
        "--token",
        "token-1",
        "--base-url",
        "http://user:secret@profile-manager.test",
      ]),
    ).toThrow("--base-url must not contain embedded credentials.");
  });

  it("throws a dedicated help signal and includes safe usage text", () => {
    expect(() => parseProfileProvisioningCliArgs(["--help"])).toThrow(
      ProfileProvisioningCliHelpRequested,
    );
    expect(getProfileProvisioningCliUsage()).toContain(
      "pnpm operator:profile:provision",
    );
    expect(getProfileProvisioningCliUsage()).toContain("--browser-provider");
    expect(getProfileProvisioningCliUsage()).not.toContain("secret");
  });
});
