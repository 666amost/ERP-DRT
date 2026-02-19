<script setup lang="ts">
import { ref, watch } from 'vue';

type City = {
  id: number;
  name: string;
  code: string;
  province: string | null;
};

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  label: string;
}>();

const emit = defineEmits(['update:modelValue'] as const);
const updateModelValue = (v: string) => emit('update:modelValue', v);

const cities = ref<City[]>([]);
const filteredCities = ref<City[]>([]);
const searchQuery = ref(props.modelValue || '');
const showDropdown = ref(false);
const showAddModal = ref(false);
const newCityName = ref('');
const newCityCode = ref('');
const newCityProvince = ref('');
const loading = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function closeDropdownDelayed() {
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
}

async function loadCities() {
  try {
    const res = await fetch('/api/cities?endpoint=list');
    const data = await res.json();
    cities.value = data.items || [];
    filteredCities.value = cities.value;
  } catch (e) {
    console.error('Failed to load cities:', e);
  }
}

function filterCities() {
  if (!searchQuery.value.trim()) {
    filteredCities.value = cities.value;
  } else {
    const query = searchQuery.value.toLowerCase();
    filteredCities.value = cities.value.filter(c => 
      c.name.toLowerCase().includes(query)
    );
  }
}

function selectCity(cityName: string) {
  updateModelValue(cityName);
  searchQuery.value = cityName;
  showDropdown.value = false;
}

async function addNewCity() {
  if (!newCityName.value.trim() || !newCityCode.value.trim()) return;
  
  loading.value = true;
  try {
    const res = await fetch('/api/cities?endpoint=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newCityName.value.trim(), 
        code: newCityCode.value.trim().toUpperCase(),
        province: newCityProvince.value.trim() || undefined
      })
    });
    
    if (res.ok) {
      const newCity = await res.json();
      cities.value.push(newCity);
      selectCity(newCity.name);
      showAddModal.value = false;
      newCityName.value = '';
      newCityCode.value = '';
      newCityProvince.value = '';
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add city');
    }
  } catch (e) {
    console.error('Add city error:', e);
    alert('Gagal menambah kota');
  } finally {
    loading.value = false;
  }
}

watch(searchQuery, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    filterCities();
    updateModelValue(searchQuery.value);
    if (document.activeElement && (document.activeElement as HTMLElement).tagName === 'INPUT') {
      showDropdown.value = true;
    }
  }, 300);
});

watch(() => props.modelValue, (val) => {
  if (val && val !== searchQuery.value) {
    searchQuery.value = val;
  }
});

loadCities();
</script>

<template>
  <div class="relative">
    <label class="block text-sm font-medium mb-1 dark:text-gray-300">{{ label }}</label>
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder || 'Pilih atau ketik kota...'"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg pr-20 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        @focus="showDropdown = true"
        @blur="closeDropdownDelayed"
      >
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary-dark font-medium"
        @click="showAddModal = true"
      >
        + Tambah
      </button>
    </div>
    
    <div
      v-if="showDropdown && filteredCities.length > 0"
      class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <button
        v-for="city in filteredCities"
        :key="city.id"
        type="button"
        class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
        @click="selectCity(city.name)"
      >
        <div class="font-medium">
          {{ city.name }}
        </div>
        <div
          v-if="city.province"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ city.province }}
        </div>
      </button>
    </div>

    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm space-y-4 card dark:text-gray-100">
        <div class="text-lg font-semibold">
          Tambah Kota Baru
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Nama Kota</label>
          <input
            v-model="newCityName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder="Nama kota"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Kode (3 huruf)</label>
          <input
            v-model="newCityCode"
            type="text"
            maxlength="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder="JKT, SBY, BTM"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Provinsi (optional)</label>
          <input
            v-model="newCityProvince"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder="Provinsi"
          >
        </div>
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-100"
            @click="showAddModal = false"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="loading || !newCityName.trim() || !newCityCode.trim()"
            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
            @click="addNewCity"
          >
            {{ loading ? 'Loading...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
