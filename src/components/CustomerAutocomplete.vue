<script setup lang="ts">
import { ref, watch } from 'vue';

type Customer = { id:number; name:string; phone:string|null; address?: string | null };

const props = defineProps<{ modelValue:string; label:string; placeholder?:string }>();
const emit = defineEmits(['update:modelValue', 'select-id', 'selected'] as const);
const emitUpdateModelValue = (v: string) => emit('update:modelValue', v);
const emitSelectId = (id: number | null) => emit('select-id', id);
const emitSelected = (c: Customer) => emit('selected', c);

const customers = ref<Customer[]>([]);
const filtered = ref<Customer[]>([]);
const query = ref(props.modelValue || '');
const show = ref(false);
const showModal = ref(false);
const newName = ref('');
const newPhone = ref('');
const newAddress = ref('');
const loading = ref(false);
const selectedId = ref<number|null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function closeDropdownDelayed(): void {
  setTimeout(() => { show.value = false; }, 200);
}

async function loadCustomers() {
  try {
    const res = await fetch('/api/customers?endpoint=list');
    const data = await res.json();
    customers.value = data.items || [];
    filtered.value = customers.value;
    if (props.modelValue) {
      const found = customers.value.find(c => c.name === props.modelValue);
      if (found) selectedId.value = found.id;
    }
  } catch (e) { console.error('Load customers error', e); }
}

function filter() {
  if (!query.value.trim()) { filtered.value = customers.value; return; }
  const q = query.value.toLowerCase();
  filtered.value = customers.value.filter(c => c.name.toLowerCase().includes(q));
}

function pick(c:Customer) {
  query.value = c.name;
  selectedId.value = c.id;
  emitUpdateModelValue(c.name);
  emitSelectId(c.id);
  emitSelected(c);
  show.value = false;
}

watch(query, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    filter();
    emitUpdateModelValue(query.value);
    if (document.activeElement && (document.activeElement as HTMLElement).tagName==='INPUT') show.value=true;
  }, 300);
});
watch(() => props.modelValue, (v) => { if (v && v !== query.value) { query.value = v; const found = customers.value.find(c=>c.name===v); selectedId.value = found?found.id:null; }});

async function addCustomer() {
  if (!newName.value.trim()) return;
  loading.value = true;
  try {
    const res = await fetch('/api/customers?endpoint=create', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name:newName.value.trim(), phone:newPhone.value.trim() || undefined, address: newAddress.value.trim() || undefined }) });
    if (!res.ok) { const err = await res.json(); alert(err.error||'Gagal'); return; }
    const cust = await res.json();
    customers.value.push(cust);
    pick(cust);
    newName.value=''; newPhone.value=''; newAddress.value=''; showModal.value=false;
  } catch (e) { console.error(e); alert('Gagal tambah customer'); } finally { loading.value=false; }
}

loadCustomers();
</script>
<template>
  <div class="relative">
    <label class="block text-sm font-medium mb-1">{{ label }}</label>
    <div class="relative">
      <input
        v-model="query"
        type="text"
        :placeholder="placeholder||'Pilih atau ketik customer...'"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg pr-20"
        @focus="show=true"
        @blur="closeDropdownDelayed"
      >
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary-dark font-medium"
        @click="showModal=true"
      >
        + Tambah
      </button>
    </div>
    <div
      v-if="show && filtered.length>0"
      class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <button
        v-for="c in filtered"
        :key="c.id"
        type="button"
        class="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
        @click="pick(c)"
      >
        <div class="font-medium">
          {{ c.name }}
        </div>
        <div v-if="c.phone" class="text-xs text-gray-500">{{ c.phone }}</div>
        <div v-if="c.address" class="text-xs text-gray-500 truncate">{{ c.address }}</div>
      </button>
    </div>
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showModal=false"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 card">
        <div class="text-lg font-semibold">
          Tambah Customer Baru
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Nama</label>
          <input
            v-model="newName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Nama customer"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Telepon (opsional)</label>
          <input
            v-model="newPhone"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="0812xxxxx"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Alamat (opsional)</label>
          <input
            v-model="newAddress"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Alamat lengkap"
          >
        </div>
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            @click="showModal=false"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="loading || !newName.trim()"
            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
            @click="addCustomer"
          >
            {{ loading?'Loading...':'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
