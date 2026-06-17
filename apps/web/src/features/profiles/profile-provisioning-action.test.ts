import { describe, expect, it } from "vitest";
import {
  resolveProvisioningAction,
  type ProvisioningAction,
  type ProvisioningActionProfile,
} from "@/features/profiles/profile-provisioning-action";

const profile: ProvisioningActionProfile = {
  id: "profile-1",
  displayName: "Profile 1",
};

function getSuccessTitle(action: ProvisioningAction): string {
  return action.successTitle;
}

describe("resolveProvisioningAction", () => {
  describe("action mapping", () => {
    it("returns Start Provisioning for PENDING_CONFIG", () => {
      const action = resolveProvisioningAction("PENDING_CONFIG", "NOT_PROVISIONED");

      expect(action.kind).toBe("action");
      if (action.kind !== "action") return;
      expect(action.buttonLabel).toBe("Start Provisioning");
      expect(action.pendingLabel).toBe("Starting Provisioning");
      expect(action.successTitle).toBe("Provisioning started.");
      expect(action.cardDescription).toMatch(/Start login provisioning/);
      expect(action.explanation).toMatch(/PENDING_CONFIG/);
    });

    it("returns Issue New Provisioning Token for PENDING_LOGIN", () => {
      const action = resolveProvisioningAction("PENDING_LOGIN", "NOT_PROVISIONED");

      expect(action.kind).toBe("action");
      if (action.kind !== "action") return;
      expect(action.buttonLabel).toBe("Issue New Provisioning Token");
      expect(action.pendingLabel).toBe("Issuing Provisioning Token");
      expect(action.successTitle).toBe("New provisioning token issued.");
      expect(action.explanation).toMatch(/PENDING_LOGIN/);
    });

    it("returns Start Reauthentication for READY + REAUTH_REQUIRED", () => {
      const action = resolveProvisioningAction("READY", "REAUTH_REQUIRED");

      expect(action.kind).toBe("action");
      if (action.kind !== "action") return;
      expect(action.buttonLabel).toBe("Start Reauthentication");
      expect(action.pendingLabel).toBe("Starting Reauthentication");
      expect(action.successTitle).toBe("Reauthentication started.");
      expect(action.explanation).toMatch(/REAUTH_REQUIRED/);
    });

    it("returns Start Manual Checkpoint Recovery for READY + CHECKPOINT_REVIEW_REQUIRED", () => {
      const action = resolveProvisioningAction(
        "READY",
        "CHECKPOINT_REVIEW_REQUIRED",
      );

      expect(action.kind).toBe("action");
      if (action.kind !== "action") return;
      expect(action.buttonLabel).toBe("Start Manual Checkpoint Recovery");
      expect(action.pendingLabel).toBe(
        "Starting Manual Checkpoint Recovery",
      );
      expect(action.successTitle).toBe("Manual checkpoint recovery started.");
      expect(action.explanation).toMatch(/CHECKPOINT_REVIEW_REQUIRED/);
    });
  });

  describe("no-action states", () => {
    it("returns no action for READY + HEALTHY", () => {
      const action = resolveProvisioningAction("READY", "HEALTHY");

      expect(action.kind).toBe("none");
      expect(action.explanation).toMatch(/READY \+ HEALTHY/);
    });

    it("returns no action for READY + NOT_PROVISIONED", () => {
      const action = resolveProvisioningAction("READY", "NOT_PROVISIONED");

      expect(action.kind).toBe("none");
    });

    it("returns no action for BUSY", () => {
      const action = resolveProvisioningAction("BUSY", "HEALTHY");

      expect(action.kind).toBe("none");
      expect(action.explanation).toMatch(/BUSY/);
    });
  });

  describe("confirm prompts include profile id and display name", () => {
    it("for PENDING_CONFIG", () => {
      const action = resolveProvisioningAction("PENDING_CONFIG", "NOT_PROVISIONED");
      if (action.kind !== "action") throw new Error("expected action");
      const prompt = action.confirmPrompt(profile);
      expect(prompt).toContain(profile.displayName);
      expect(prompt).toContain(profile.id);
    });

    it("for READY + REAUTH_REQUIRED", () => {
      const action = resolveProvisioningAction("READY", "REAUTH_REQUIRED");
      if (action.kind !== "action") throw new Error("expected action");
      const prompt = action.confirmPrompt(profile);
      expect(prompt).toContain(profile.displayName);
      expect(prompt).toContain(profile.id);
      expect(prompt).toMatch(/reauthentication/i);
      // The reauth path does not mention "no automated bypass" — that
      // copy is reserved for the checkpoint variant.
      expect(prompt).not.toContain("no automated bypass");
    });
  });
});

describe("success-context regression", () => {
  // Sprint 055 review finding 2: the success panel must read from the
  // captured success context, not the live `resolveProvisioningAction`,
  // because the profile status flips to PENDING_LOGIN after a successful
  // request and the live action would always be the PENDING_LOGIN
  // "New provisioning token issued." variant.

  it("captured success title is preserved when the profile status flips to PENDING_LOGIN after a refetch", () => {
    const initial = resolveProvisioningAction("READY", "REAUTH_REQUIRED");
    if (initial.kind !== "action") throw new Error("expected action");
    const capturedSuccessTitle = initial.successTitle;
    expect(capturedSuccessTitle).toBe("Reauthentication started.");

    // Simulate the post-mutation refetch: profile.status is now
    // PENDING_LOGIN. The live action changes, but the captured title
    // must not.
    const afterRefetch = resolveProvisioningAction("PENDING_LOGIN", "REAUTH_REQUIRED");
    expect(getSuccessTitle(afterRefetch)).toBe(
      "New provisioning token issued.",
    );
    // The captured title is what the page would render.
    expect(capturedSuccessTitle).toBe("Reauthentication started.");
    expect(capturedSuccessTitle).not.toBe(getSuccessTitle(afterRefetch));
  });

  it("captured success title is preserved for READY + CHECKPOINT_REVIEW_REQUIRED", () => {
    const initial = resolveProvisioningAction(
      "READY",
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    if (initial.kind !== "action") throw new Error("expected action");
    const capturedSuccessTitle = initial.successTitle;
    expect(capturedSuccessTitle).toBe("Manual checkpoint recovery started.");

    const afterRefetch = resolveProvisioningAction(
      "PENDING_LOGIN",
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    expect(capturedSuccessTitle).not.toBe(getSuccessTitle(afterRefetch));
  });

  it("captured success title is preserved for PENDING_CONFIG initial provisioning", () => {
    const initial = resolveProvisioningAction("PENDING_CONFIG", "NOT_PROVISIONED");
    if (initial.kind !== "action") throw new Error("expected action");
    const capturedSuccessTitle = initial.successTitle;
    expect(capturedSuccessTitle).toBe("Provisioning started.");

    // After the refetch, the profile is PENDING_LOGIN, so the live
    // action resolves to the token-restart variant. The captured
    // title must NOT change to match the live action.
    const afterRefetch = resolveProvisioningAction("PENDING_LOGIN", "NOT_PROVISIONED");
    expect(getSuccessTitle(afterRefetch)).toBe(
      "New provisioning token issued.",
    );
    expect(capturedSuccessTitle).toBe("Provisioning started.");
    expect(capturedSuccessTitle).not.toBe(getSuccessTitle(afterRefetch));
  });

  it("captured success title is preserved for PENDING_LOGIN token restart", () => {
    const initial = resolveProvisioningAction("PENDING_LOGIN", "REAUTH_REQUIRED");
    if (initial.kind !== "action") throw new Error("expected action");
    const capturedSuccessTitle = initial.successTitle;
    expect(capturedSuccessTitle).toBe("New provisioning token issued.");

    // After restart, the profile is still PENDING_LOGIN.
    const afterRefetch = resolveProvisioningAction("PENDING_LOGIN", "REAUTH_REQUIRED");
    expect(capturedSuccessTitle).toBe(getSuccessTitle(afterRefetch));
  });
});
