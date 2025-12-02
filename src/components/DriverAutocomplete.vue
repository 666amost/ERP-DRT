<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

interface Driver {
  id: number;
  name: string;
  phone: string | null;
}

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'select-id': [id: number | null];
  'selected': [driver: Driver];
}>();

const inputValue = ref(props.modelValue);
const suggestions = ref<Driver[]>([]);
const showSuggestions = ref(false);
const loading = ref(false);
const showCreateForm = ref(false);
const newDriverName = ref('');
const newDriverPhone = ref('');
const containerRef = ref<HTMLElement | null>(null);

watch(() => props.modelValue, (val) => {
  inputValue.value = val;
});

async function searchDrivers(query: string) {
  if (!query || query.length < 1) {
    suggestions.value = [];
    return;
  }
  
  loading.value = true;
  try {
    const res = await fetch(`/api/drivers?endpoint=list&search=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      suggestions.value = data.items || [];
    }
  } catch (e) {
    console.error('Failed to search drivers:', e);
  } finally {
    loading.value = false;
  }
}

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  inputValue.value = val;
  emit('update:modelValue', val);
  emit('select-id', null);
  searchDrivers(val);
  showSuggestions.value = true;
}

function selectDriver(driver: Driver) {
  inputValue.value = driver.name;
  emit('update:modelValue', driver.name);
  emit('select-id', driver.id);
  emit('selected', driver);
  showSuggestions.value = false;
}

function onFocus() {
  if (inputValue.value) {
    searchDrivers(inputValue.value);
  }
  showSuggestions.value = true;
}

async function createDriver() {
  if (!newDriverName.value.trim()) return;
  
  try {
    const res = await fetch('/api/drivers?endpoint=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDriverName.value.trim(),
        phone: newDriverPhone.value.trim() || null
      })
    });
    
    if (res.ok) {
      const driver = await res.json();
      selectDriver(driver);
      showCreateForm.value = false;
      newDriverName.value = '';
      newDriverPhone.value = '';
    }
  } catch (e) {
    console.error('Failed to create driver:', e);
  }
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    showSuggestions.value = false;
    showCreateForm.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="containerRef" class="relative">
    <label v-if="label" class="block text-sm font-medium mb-1 dark:text-gray-300">{{ label }}</label>
    <input
      :value="inputValue"
      type="text"
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
      :placeholder="placeholder || 'Ketik nama supir...'"
      @input="onInput"
      @focus="onFocus"
    />
    
    <div 
      v-if="showSuggestions && (suggestions.length > 0 || inputValue)"
      class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
    >
      <div v-if="loading" class="p-3 text-sm text-gray-500">Mencari...</div>
      
      <template v-else>
        <div
          v-for="driver in suggestions"
          :key="driver.id"
          class="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
          @click="selectDriver(driver)"
        >
          <div class="font-medium dark:text-gray-100">{{ driver.name }}</div>
          <div v-if="driver.phone" class="text-xs text-gray-500">{{ driver.phone }}</div>
        </div>
        
        <div 
          v-if="inputValue && !suggestions.some(d => d.name.toLowerCase() === inputValue.toLowerCase())"
          class="p-3 border-t border-gray-200 dark:border-gray-700"
        >
          <button
            type="button"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            @click="showCreateForm = true; newDriverName = inputValue"
          >
            + Tambah supir baru "{{ inputValue }}"
          </button>
        </div>
      </template>
    </div>
    
    <div 
      v-if="showCreateForm"
      class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4"
    >
      <div class="text-sm font-medium mb-3 dark:text-gray-100">Tambah Supir Baru</div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Nama</label>
          <input
            v-model="newDriverName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">No. Telepon</label>
          <input
            v-model="newDriverPhone"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-100"
            @click="showCreateForm = false"
          >
            Batal
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            @click="createDriver"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
