<script setup lang="ts">
import { useRouter } from 'vue-router';
import Button from '../components/ui/Button.vue';
import { Icon } from '@iconify/vue';

const router = useRouter();

function goBack() {
  router.push('/dashboard');
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <div class="text-center max-w-md">
      <div class="mb-6">
        <Icon icon="mdi:shield-lock-outline" class="text-8xl text-red-500 mx-auto" />
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Akses Ditolak
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        Anda tidak memiliki izin untuk mengakses halaman ini. Silakan hubungi administrator jika Anda memerlukan akses.
      </p>
      <Button variant="primary" @click="goBack">
        <Icon icon="mdi:arrow-left" class="mr-2" />
        Kembali ke Dashboard
      </Button>
    </div>
  </div>
</template>
