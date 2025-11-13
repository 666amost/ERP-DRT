<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from './Sidebar.vue';
import Header from './Header.vue';

const sidebarOpen = ref(false);
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-[16rem_1fr] bg-gray-50">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/50 z-20 lg:hidden"
      @click="sidebarOpen = false"
    />
    
    <!-- Sidebar -->
    <div
      class="fixed lg:static inset-y-0 left-0 z-30 transform transition-transform lg:transform-none"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <Sidebar @close="sidebarOpen = false" />
    </div>

    <div class="flex flex-col">
      <Header @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="p-4 lg:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
