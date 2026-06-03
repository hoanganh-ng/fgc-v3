import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminApiKey } from "./support/config.js";

test("recovers from an invalid admin API key", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("profile-table")).toBeVisible();

  const apiKeyInput = page.getByPlaceholder("Admin API key");
  await apiKeyInput.fill("invalid-admin-api-key");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText("A valid admin API key is required")).toBeVisible();

  await apiKeyInput.fill(adminApiKey);
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText("A valid admin API key is required")).toBeHidden();
  await expect(page.getByTestId("profile-table")).toBeVisible();
});

test("runs the profile lifecycle through provisioning, checkout, and release", async ({ page, request }) => {
  const profileName = `e2e-profile-${Date.now()}`;
  const externalRef = `e2e-${randomUUID()}`;
  const configuration = e2eConfiguration();

  await page.goto("/");
  await expect(page.getByTestId("profile-table")).toBeVisible();
  await page.getByRole("button", { name: "Create" }).click();

  const createDialog = page.getByRole("dialog", { name: "Create profile shell" });
  await createDialog.getByLabel("Display name").fill(profileName);
  await createDialog.getByLabel("External ref").fill(externalRef);
  await createDialog.getByRole("button", { name: "Create" }).click();

  const profileRow = page.getByRole("row").filter({ hasText: profileName });
  await expect(profileRow).toContainText("PENDING_CONFIG");
  await profileRow.click();

  await expect(page.getByRole("heading", { name: profileName })).toBeVisible();
  const profileId = extractProfileId(page.url());

  await page.getByTestId("profile-configuration-json").fill(JSON.stringify(configuration, null, 2));
  await page.getByRole("button", { name: "Save config" }).click();

  await expect(page.getByText("Configuration saved and provisioning token issued")).toBeVisible();
  const token = (await page.getByTestId("provisioning-token").innerText()).trim();
  expect(token.length).toBeGreaterThanOrEqual(32);

  const provisioningConfig = await request.get("/api/provisioning/configuration", {
    headers: {
      "x-provisioning-token": token
    }
  });
  expect(provisioningConfig.ok()).toBe(true);
  expect((await provisioningConfig.json()) as unknown).toMatchObject({
    profileId,
    hardwareFingerprint: configuration.hardwareFingerprint,
    networkContext: configuration.networkContext
  });

  const sessionPayload = {
    authenticationState: {
      cookies: [
        {
          name: "session_id",
          value: "e2e-session",
          domain: "example.test",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax"
        }
      ],
      localStorage: [
        {
          origin: "https://example.test",
          entries: {
            authenticated: "true"
          }
        }
      ]
    }
  };

  const ingested = await request.post("/api/provisioning/session", {
    headers: {
      "x-provisioning-token": token
    },
    data: sessionPayload
  });
  expect(ingested.ok()).toBe(true);
  expect((await ingested.json()) as unknown).toMatchObject({
    profile: {
      id: profileId,
      status: "READY"
    }
  });

  const replay = await request.post("/api/provisioning/session", {
    headers: {
      "x-provisioning-token": token
    },
    data: sessionPayload
  });
  expect(replay.status()).toBe(409);

  await page.reload();
  await expect(page.getByTestId("profile-status")).toHaveText("READY");

  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByText("Profile checked out")).toBeVisible();
  await expect(page.getByTestId("profile-status")).toHaveText("BUSY");

  await page.getByRole("button", { name: "Release lease" }).click();
  await expect(page.getByText("Lease released")).toBeVisible();
  await expect(page.getByTestId("profile-status")).toHaveText("READY");
});

function extractProfileId(url: string): string {
  const profileId = new URL(url).pathname.split("/").filter(Boolean).at(-1);

  if (profileId === undefined) {
    throw new Error(`Unable to extract profile id from ${url}`);
  }

  return profileId;
}

function e2eConfiguration() {
  return {
    networkContext: {
      proxy: {
        host: "203.0.113.10",
        port: 8080
      },
      killswitchEnabled: true
    },
    hardwareFingerprint: {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      viewport: {
        width: 1366,
        height: 768
      },
      languageHeaders: ["en-US", "en"],
      hardwareConcurrency: 8
    },
    behavioralPersona: {
      scrollingStyle: "SMOOTH",
      microDelayMs: {
        min: 120,
        max: 900
      },
      reverseScrollProbability: 0.08
    },
    temporalRoutine: {
      timezone: "UTC",
      activeWindows: Array.from({ length: 7 }, (_, dayOfWeek) => [
        {
          dayOfWeek,
          start: "00:00",
          end: "23:59"
        },
        {
          dayOfWeek,
          start: "23:59",
          end: "00:00"
        }
      ]).flat(),
      cooldownMinutes: 0
    },
    safetyThresholds: {
      maxSessionsPerDay: 10,
      maxSessionDurationMinutes: 240,
      maxMacroActionsPerDay: 1000
    },
    contentAffinities: {
      primaryTopics: ["news"],
      secondaryTopics: ["technology"],
      interactionWeights: {
        like: 0.3,
        comment: 0.1
      }
    }
  };
}
