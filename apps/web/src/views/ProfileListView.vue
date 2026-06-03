<script setup lang="ts">
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { Plus, RefreshCw, ShieldCheck } from "lucide-vue-next";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Tag from "primevue/tag";
import Toolbar from "primevue/toolbar";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { createProfile, getStoredApiKey, listProfiles, storeApiKey } from "../api/client.js";

const router = useRouter();
const queryClient = useQueryClient();
const apiKey = ref(getStoredApiKey());
const createDialogOpen = ref(false);
const displayName = ref("");
const externalRef = ref("");
const createError = ref<string | null>(null);

const profilesQuery = useQuery({
  queryKey: ["profiles"],
  queryFn: listProfiles
});

const profiles = computed(() => profilesQuery.data.value?.profiles ?? []);

function saveApiKey() {
  storeApiKey(apiKey.value.trim());
  void profilesQuery.refetch();
}

async function submitCreate() {
  createError.value = null;
  try {
    const input = externalRef.value.trim() === ""
      ? { displayName: displayName.value.trim() }
      : { displayName: displayName.value.trim(), externalRef: externalRef.value.trim() };
    await createProfile(input);
    displayName.value = "";
    externalRef.value = "";
    createDialogOpen.value = false;
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "Create failed";
  }
}

function statusSeverity(status: string) {
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
    <header class="topbar">
      <div>
        <p class="eyebrow">Profile Manager</p>
        <h1>Digital twin profiles</h1>
      </div>
      <div class="auth-control">
        <ShieldCheck :size="18" />
        <InputText v-model="apiKey" type="password" placeholder="Admin API key" />
        <Button label="Apply" size="small" @click="saveApiKey" />
      </div>
    </header>

    <Toolbar class="toolbar">
      <template #start>
        <Button severity="secondary" outlined aria-label="Refresh profiles" @click="() => profilesQuery.refetch()">
          <RefreshCw :size="16" />
        </Button>
      </template>
      <template #end>
        <Button @click="createDialogOpen = true">
          <Plus :size="16" />
          <span>Create</span>
        </Button>
      </template>
    </Toolbar>

    <Message v-if="profilesQuery.error.value" severity="error">
      {{ profilesQuery.error.value instanceof Error ? profilesQuery.error.value.message : "Unable to load profiles" }}
    </Message>

    <DataTable
      :value="profiles"
      data-key="id"
      data-testid="profile-table"
      :loading="profilesQuery.isLoading.value"
      table-style="min-width: 52rem"
      class="profile-table"
      @row-click="(event) => router.push(`/profiles/${event.data.id}`)"
    >
      <Column field="pillars.identityMetadata.displayName" header="Name" />
      <Column field="status" header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column field="version" header="Version" />
      <Column field="nextAvailableWindowAt" header="Next window">
        <template #body="{ data }">
          {{ data.nextAvailableWindowAt ?? "Available by routine" }}
        </template>
      </Column>
      <Column field="updatedAt" header="Updated" />
    </DataTable>

    <Dialog v-model:visible="createDialogOpen" modal header="Create profile shell" :style="{ width: '28rem' }">
      <div class="form-grid">
        <label for="displayName">Display name</label>
        <InputText id="displayName" v-model="displayName" />
        <label for="externalRef">External ref</label>
        <InputText id="externalRef" v-model="externalRef" />
      </div>
      <Message v-if="createError" severity="error">{{ createError }}</Message>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="createDialogOpen = false" />
        <Button label="Create" :disabled="displayName.trim() === ''" @click="submitCreate" />
      </template>
    </Dialog>
  </main>
</template>
