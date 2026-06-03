<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { ArrowLeft, CheckCircle2, KeyRound, Play, RotateCcw, Save } from "lucide-vue-next";
import Button from "primevue/button";
import Message from "primevue/message";
import Panel from "primevue/panel";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  checkout,
  configureProfile,
  getProfile,
  issueProvisioningToken,
  releaseLease
} from "../api/client.js";
import { defaultConfiguration } from "../api/defaultConfiguration.js";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const profileId = computed(() => String(route.params["id"]));
const configText = ref(JSON.stringify(defaultConfiguration, null, 2));
const message = ref<string | null>(null);
const provisioningToken = ref<string | null>(null);

const profileQuery = useQuery({
  queryKey: computed(() => ["profile", profileId.value]),
  queryFn: () => getProfile(profileId.value)
});

watch(profileQuery.data, (profile) => {
  if (profile === undefined || profile.pillars.networkContext === null) {
    return;
  }

  configText.value = JSON.stringify({
    identityMetadata: profile.pillars.identityMetadata,
    networkContext: profile.pillars.networkContext,
    hardwareFingerprint: profile.pillars.hardwareFingerprint,
    behavioralPersona: profile.pillars.behavioralPersona,
    temporalRoutine: profile.pillars.temporalRoutine,
    safetyThresholds: profile.pillars.safetyThresholds,
    contentAffinities: profile.pillars.contentAffinities
  }, null, 2);
}, { immediate: true });

const configureMutation = useMutation({
  mutationFn: async () => configureProfile(profileId.value, JSON.parse(configText.value)),
  onSuccess: async (result) => {
    provisioningToken.value = result.provisioningToken?.token ?? null;
    message.value = result.provisioningToken === null
      ? "Configuration saved"
      : "Configuration saved and provisioning token issued";
    await refreshProfile();
  },
  onError: setErrorMessage
});

const tokenMutation = useMutation({
  mutationFn: () => issueProvisioningToken(profileId.value),
  onSuccess: (result) => {
    provisioningToken.value = result.token;
    message.value = "Provisioning token issued";
  },
  onError: setErrorMessage
});

const checkoutMutation = useMutation({
  mutationFn: () => checkout({ profileId: profileId.value, requestedBy: "admin-console" }),
  onSuccess: async () => {
    message.value = "Profile checked out";
    await refreshProfile();
  },
  onError: setErrorMessage
});

const releaseMutation = useMutation({
  mutationFn: () => {
    const leaseId = profileQuery.data.value?.activeLease?.id;
    if (leaseId === undefined) {
      throw new Error("No active lease");
    }
    return releaseLease(leaseId, {
      sessionDurationMinutes: 0,
      macroActionsPerformed: 0
    });
  },
  onSuccess: async () => {
    message.value = "Lease released";
    await refreshProfile();
  },
  onError: setErrorMessage
});

async function refreshProfile() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["profiles"] }),
    queryClient.invalidateQueries({ queryKey: ["profile", profileId.value] })
  ]);
}

function setErrorMessage(error: unknown) {
  message.value = error instanceof Error ? error.message : "Operation failed";
}

function statusSeverity(status: string | undefined) {
  if (status === "READY") {
    return "success";
  }
  if (status === "BUSY") {
    return "warn";
  }
  if (status === "PENDING_LOGIN") {
    return "info";
  }
  return "secondary";
}
</script>

<template>
  <main class="shell">
    <header class="detail-header">
      <Button severity="secondary" text @click="router.push('/')">
        <ArrowLeft :size="16" />
      </Button>
      <div>
        <p class="eyebrow">Profile detail</p>
        <h1>{{ profileQuery.data.value?.pillars.identityMetadata.displayName ?? "Loading profile" }}</h1>
      </div>
      <Tag
        :value="profileQuery.data.value?.status ?? 'LOADING'"
        :severity="statusSeverity(profileQuery.data.value?.status)"
      />
    </header>

    <Message v-if="profileQuery.error.value" severity="error">
      {{ profileQuery.error.value instanceof Error ? profileQuery.error.value.message : "Unable to load profile" }}
    </Message>
    <Message v-if="message" severity="info">{{ message }}</Message>

    <section class="detail-grid">
      <Panel header="Configuration">
        <Textarea v-model="configText" rows="24" class="json-editor" />
        <div class="action-row">
          <Button :loading="configureMutation.isPending.value" @click="() => configureMutation.mutate()">
            <Save :size="16" />
            <span>Save config</span>
          </Button>
          <Button severity="secondary" outlined @click="configText = JSON.stringify(defaultConfiguration, null, 2)">
            <RotateCcw :size="16" />
            <span>Reset sample</span>
          </Button>
        </div>
      </Panel>

      <Panel header="Operations">
        <dl class="metrics">
          <dt>Version</dt>
          <dd>{{ profileQuery.data.value?.version ?? "-" }}</dd>
          <dt>Token expires</dt>
          <dd>{{ profileQuery.data.value?.provisioningTokenExpiresAt ?? "No active token" }}</dd>
          <dt>Next window</dt>
          <dd>{{ profileQuery.data.value?.nextAvailableWindowAt ?? "Routine controlled" }}</dd>
          <dt>Lease</dt>
          <dd>{{ profileQuery.data.value?.activeLease?.id ?? "No active lease" }}</dd>
        </dl>
        <div class="stacked-actions">
          <Button severity="secondary" outlined :loading="tokenMutation.isPending.value" @click="() => tokenMutation.mutate()">
            <KeyRound :size="16" />
            <span>Issue token</span>
          </Button>
          <Button :disabled="profileQuery.data.value?.status !== 'READY'" :loading="checkoutMutation.isPending.value" @click="() => checkoutMutation.mutate()">
            <Play :size="16" />
            <span>Checkout</span>
          </Button>
          <Button
            severity="success"
            :disabled="profileQuery.data.value?.activeLease == null"
            :loading="releaseMutation.isPending.value"
            @click="() => releaseMutation.mutate()"
          >
            <CheckCircle2 :size="16" />
            <span>Release lease</span>
          </Button>
        </div>
        <div v-if="provisioningToken" class="token-box">
          {{ provisioningToken }}
        </div>
      </Panel>
    </section>
  </main>
</template>
