<script setup lang="ts">
import { ref, computed, watch } from 'vue';

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

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const cities = ref<City[]>([]);
const filteredCities = ref<City[]>([]);
const searchQuery = ref(props.modelValue || '');
const showDropdown = ref(false);
const showAddModal = ref(false);
const newCityName = ref('');
const newCityCode = ref('');
const newCityProvince = ref('');
const loading = ref(false);

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
  emit('update:modelValue', cityName);
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

watch(searchQuery, (val, oldVal) => {
  filterCities();
  // Only show dropdown when user types (length change due to user input)
  if (document.activeElement && (document.activeElement as HTMLElement).tagName === 'INPUT') {
    showDropdown.value = true;
  }
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
    <label class="block text-sm font-medium mb-1">{{ label }}</label>
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder || 'Pilih atau ketik kota...'"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg pr-20"
        @focus="showDropdown = true"
        @blur="setTimeout(() => showDropdown = false, 200)"
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
      class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <button
        v-for="city in filteredCities"
        :key="city.id"
        type="button"
        class="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
        @click="selectCity(city.name)"
      >
        <div class="font-medium">
          {{ city.name }}
        </div>
        <div
          v-if="city.province"
          class="text-xs text-gray-500"
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
      <div class="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 card">
        <div class="text-lg font-semibold">
          Tambah Kota Baru
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Nama Kota</label>
          <input
            v-model="newCityName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Nama kota"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Kode (3 huruf)</label>
          <input
            v-model="newCityCode"
            type="text"
            maxlength="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="JKT, SBY, BTM"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Provinsi (optional)</label>
          <input
            v-model="newCityProvince"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Provinsi"
          >
        </div>
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
