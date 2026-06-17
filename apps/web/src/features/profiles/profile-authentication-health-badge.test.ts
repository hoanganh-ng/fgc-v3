import { describe, expect, it } from "vitest";
import { healthMeta } from "@/features/profiles/profile-authentication-health-badge";
import type { KnownProfileAuthenticationHealth } from "@/lib/api/profile-manager-client";

describe("ProfileAuthenticationHealthBadge healthMeta", () => {
  const expected: readonly {
    readonly health: KnownProfileAuthenticationHealth;
    readonly label: string;
    readonly tone: "neutral" | "info" | "success" | "warning" | "danger";
  }[] = [
    { health: "NOT_PROVISIONED", label: "NOT_PROVISIONED", tone: "neutral" },
    { health: "HEALTHY", label: "HEALTHY", tone: "success" },
    { health: "REAUTH_REQUIRED", label: "REAUTH_REQUIRED", tone: "warning" },
    {
      health: "CHECKPOINT_REVIEW_REQUIRED",
      label: "CHECKPOINT_REVIEW_REQUIRED",
      tone: "danger",
    },
  ];

  for (const { health, label, tone } of expected) {
    it(`maps ${health} to label "${label}" with tone "${tone}"`, () => {
      const meta = healthMeta[health];
      expect(meta.label).toBe(label);
      expect(meta.tone).toBe(tone);
    });
  }

  it("covers exactly the four known health values", () => {
    expect(Object.keys(healthMeta).sort()).toEqual(
      [
        "CHECKPOINT_REVIEW_REQUIRED",
        "HEALTHY",
        "NOT_PROVISIONED",
        "REAUTH_REQUIRED",
      ].sort(),
    );
  });
});
