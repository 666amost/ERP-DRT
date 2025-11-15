<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from '../components/ui/Button.vue';
import { Icon } from '@iconify/vue';

type Company = {
  id?: number;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

const company = ref<Company>({ name: '', address: '', phone: '', email: '', website: '' });
const loading = ref(true);
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await fetch('/api/company');
    const d = await res.json();
    if (d.company) company.value = d.company;
  } catch (e) {
    console.error('Failed to fetch company:', e);
    company.value = { name: '', address: '', phone: '', email: '', website: '' };
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const res = await fetch('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company.value)
    });
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    if (d.company) company.value = d.company;
    alert('Berhasil disimpan');
  } catch (e) {
    console.error('Failed to save company:', e);
    alert('Gagal menyimpan');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex items-center justify-between">
      <div class="text-xl font-semibold">
        Company Settings
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-64"
    >
      <div class="text-gray-500">
        Loading...
      </div>
    </div>

    <div
      v-else
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden card p-6"
    >
      <div class="space-y-3">
        <div class="text-lg font-semibold">
          Company Settings
        </div>
        <div class="text-sm text-gray-500">
          Edit company profile used in print templates and receipts
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1">Company Name</label>
            <input
              v-model="company.name"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
            <label class="block text-sm font-medium mb-1 mt-2">Address</label>
            <textarea
              v-model="company.address"
              rows="2"
              class="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">Phone</label>
              <input
                v-model="company.phone"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Email</label>
              <input
                v-model="company.email"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Website</label>
              <input
                v-model="company.website"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
            </div>
          </div>
        </div>
        <div class="pt-4 flex gap-2 justify-end">
          <Button
            variant="default"
            :disabled="saving"
            @click="load"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
