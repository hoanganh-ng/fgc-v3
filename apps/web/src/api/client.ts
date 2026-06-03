import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  configureProfileResponseSchema,
  createProfileRequestSchema,
  createProfileResponseSchema,
  profileConfigurationRequestSchema,
  profileListResponseSchema,
  profileReadSchema,
  provisioningTokenResponseSchema,
  releaseLeaseRequestSchema,
  releaseLeaseResponseSchema,
  type CheckoutRequest,
  type ProfileConfigurationRequest
} from "@dtpm/contracts";
import type { z } from "zod";

const runtimeConfig = window.__DTPM_CONFIG__ ?? {};
const baseUrl = runtimeConfig.API_BASE_URL ?? import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";
const apiKeyStorageKey = "dtpm.adminApiKey";

export function getStoredApiKey(): string {
  return localStorage.getItem(apiKeyStorageKey) ??
    runtimeConfig.ADMIN_API_KEY ??
    import.meta.env["VITE_ADMIN_API_KEY"] ??
    "";
}

export function storeApiKey(value: string): void {
  localStorage.setItem(apiKeyStorageKey, value);
}

export async function listProfiles() {
  return request("/admin/profiles", profileListResponseSchema, {
    method: "GET",
    admin: true
  });
}

export async function getProfile(id: string) {
  return request(`/admin/profiles/${id}`, profileReadSchema, {
    method: "GET",
    admin: true
  });
}

export async function createProfile(input: { displayName: string; externalRef?: string }) {
  const body = createProfileRequestSchema.parse(input);
  return request("/admin/profiles", createProfileResponseSchema, {
    method: "POST",
    admin: true,
    body
  });
}

export async function configureProfile(id: string, input: ProfileConfigurationRequest) {
  const body = profileConfigurationRequestSchema.parse(input);
  return request(`/admin/profiles/${id}/configuration`, configureProfileResponseSchema, {
    method: "PUT",
    admin: true,
    body
  });
}

export async function issueProvisioningToken(id: string) {
  return request(`/admin/profiles/${id}/provisioning-token`, provisioningTokenResponseSchema, {
    method: "POST",
    admin: true
  });
}

export async function checkout(input: CheckoutRequest) {
  const body = checkoutRequestSchema.parse(input);
  return request("/admin/checkout", checkoutResponseSchema, {
    method: "POST",
    admin: true,
    body
  });
}

export async function releaseLease(leaseId: string, input: z.infer<typeof releaseLeaseRequestSchema>) {
  const body = releaseLeaseRequestSchema.parse(input);
  return request(`/admin/leases/${leaseId}/release`, releaseLeaseResponseSchema, {
    method: "POST",
    admin: true,
    body
  });
}

async function request<T>(
  path: string,
  schema: z.ZodSchema<T>,
  options: {
    method: string;
    admin?: boolean;
    body?: unknown;
  }
): Promise<T> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  if (options.admin === true) {
    headers.set("x-admin-api-key", getStoredApiKey());
  }

  const requestInit: RequestInit = {
    method: options.method,
    headers
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, requestInit);
  const payload: unknown = await response.json();

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "message" in payload
      ? String(payload.message)
      : `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return schema.parse(payload);
}
