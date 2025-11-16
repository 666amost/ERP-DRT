<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '../components/ui/Button.vue';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Email dan password harus diisi';
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    const res = await fetch('/api/auth?endpoint=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
      credentials: 'include'
    });
    
    if (!res.ok) {
      try {
        const data = await res.json();
        error.value = data?.error || 'Email atau password salah';
      } catch {
        error.value = 'Email atau password salah';
      }
      loading.value = false;
      return;
    }
    
    router.push('/dashboard');
  } catch {
    error.value = 'Gagal terhubung ke server';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-xl border border-gray-200 p-8 shadow-sm card">
        <div class="mb-6 text-center">
          <div
            class="h-12 w-12 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xl mx-auto mb-3"
          >
            EP
          </div>
          <h1 class="text-2xl font-bold text-gray-900">
            Enterprise ERP
          </h1>
          <p class="text-sm text-gray-500 mt-1">
            Masuk ke dashboard
          </p>
        </div>

        <form
          class="space-y-4"
          @submit.prevent="handleLogin"
        >
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              required
              class="w-full h-10 px-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="admin@example.com"
            >
          </div>

          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full h-10 px-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="••••••••"
            >
          </div>

          <div
            v-if="error"
            class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
          >
            {{ error }}
          </div>

          <Button
            type="submit"
            variant="primary"
            :disabled="loading"
            class="w-full"
          >
            {{ loading ? 'Memproses...' : 'Masuk' }}
          </Button>
        </form>

        <div class="mt-6 text-center text-xs text-gray-500">
          Hubungi amos jika ada error
        </div>
      </div>
    </div>
  </div>
</template>
