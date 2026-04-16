<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const hasError = ref(false);

onErrorCaptured((err) => {
  console.error('[App Error Captured]', err);
  hasError.value = true;
  return false;
});
</script>

<template>
  <div v-if="hasError" style="font-family:sans-serif;text-align:center;padding:40px">
    <h2>Terjadi kesalahan</h2>
    <p>Silakan muat ulang halaman.</p>
    <button @click="() => { hasError = false; $router.go(0); }">Muat Ulang</button>
  </div>
  <router-view v-else v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </router-view>
</template>
