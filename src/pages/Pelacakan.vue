<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import L, { type Map as LeafletMap, type Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mqtt, { type MqttClient } from 'mqtt';
import {
  accountIdFromTopic,
  isNewerTrackingPayload,
  parseTrackingPayload
} from '../lib/trackingPayload';
import { bearingBetween, interpolatePoint, shortestRotation } from '../lib/mapMotion';

type ActiveTrip = {
  id: number;
  dbl_number: string;
  dbl_date: string;
  driver_name: string | null;
  vehicle_plate: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  shipment_count: number;
  tracking_account_id: number;
};

type TrackingItem = ActiveTrip & {
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  speed_kph: number | null;
  recorded_at: string | null;
};

const route = useRoute();
const loading = ref(true);
const loadError = ref('');
const connectionState = ref<'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error'>('connecting');
const connectionError = ref('');
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '');
const now = ref(Date.now());
const mapContainer = ref<HTMLElement | null>(null);
const tripsByAccount = ref<Record<string, TrackingItem>>({});

const mqttUrl = import.meta.env.VITE_MQTT_WSS_URL || '';
const mqttUsername = import.meta.env.VITE_MQTT_USERNAME || '';
const mqttPassword = import.meta.env.VITE_MQTT_PASSWORD || '';
const mqttTopic = import.meta.env.VITE_MQTT_TOPIC || 'sumbertrans/tracking/driver/+';

let map: LeafletMap | null = null;
let mqttClient: MqttClient | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const markers = new Map<number, Marker>();
const removalTimers = new Map<number, ReturnType<typeof setTimeout>>();
const markerMotion = new Map<number, {
  animationFrame: number | null;
  heading: number;
}>();

const connectionLabel = computed(() => ({
  connecting: 'Menghubungkan',
  connected: 'Terhubung',
  reconnecting: 'Menghubungkan ulang',
  offline: 'Terputus',
  error: 'Bermasalah'
})[connectionState.value]);

const activeItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return Object.values(tripsByAccount.value)
    .filter(item => {
      if (!query) return true;
      return [item.dbl_number, item.driver_name, item.vehicle_plate, item.origin, item.destination]
        .some(value => String(value || '').toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const aTime = a.recorded_at ? Date.parse(a.recorded_at) : 0;
      const bTime = b.recorded_at ? Date.parse(b.recorded_at) : 0;
      return bTime - aTime;
    });
});

function isStale(item: TrackingItem): boolean {
  if (!item.recorded_at) return true;
  return now.value - Date.parse(item.recorded_at) > 15 * 60 * 1000;
}

function formatLastUpdate(value: string | null): string {
  if (!value) return 'Menunggu posisi';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Waktu tidak valid';
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createTruckIcon(stale: boolean): L.DivIcon {
  return L.divIcon({
    className: 'ste-truck-marker',
    html: `
      <div class="ste-truck-vehicle ${stale ? 'stale' : 'active'}" aria-hidden="true">
        <svg viewBox="0 0 48 72" role="img">
          <ellipse class="ste-truck-shadow" cx="24" cy="39" rx="17" ry="29" />
          <path class="ste-truck-outline" d="M14 69c-3 0-5-2-5-5V31c0-2 1-4 3-5V16C12 7 17 3 24 3s12 4 12 13v10c2 1 3 3 3 5v33c0 3-2 5-5 5H14Z" />
          <g class="ste-truck-body">
            <rect class="ste-truck-wheel" x="4" y="25" width="7" height="15" rx="2.5" />
            <rect class="ste-truck-wheel" x="37" y="25" width="7" height="15" rx="2.5" />
            <rect class="ste-truck-wheel" x="4" y="52" width="7" height="14" rx="2.5" />
            <rect class="ste-truck-wheel" x="37" y="52" width="7" height="14" rx="2.5" />
            <path class="ste-truck-mirror" d="M9 17H5c-1 0-2 1-2 2v4h6v-6ZM39 17h4c1 0 2 1 2 2v4h-6v-6Z" />
            <rect class="ste-truck-cargo" x="9" y="29" width="30" height="40" rx="4" />
            <rect class="ste-truck-cargo-panel" x="12" y="32" width="24" height="31" rx="2" />
            <path class="ste-truck-cab" d="M11 31V16C11 7.5 16.3 3 24 3s13 4.5 13 13v15H11Z" />
            <path class="ste-truck-hood" d="M15 13c.7-4.4 4-7 9-7s8.3 2.6 9 7H15Z" />
            <path class="ste-truck-windshield" d="M14 17c0-1.3.2-2.4.5-3.5h19c.3 1.1.5 2.2.5 3.5v5H14v-5Z" />
            <path class="ste-truck-window-divider" d="M24 14v8" />
            <path class="ste-truck-cab-detail" d="M14 25h20M17 25l-2 5M31 25l2 5" />
            <path class="ste-truck-cargo-ridge" d="M15 36h18M15 42h18M15 48h18M15 54h18M24 32v31" />
            <path class="ste-truck-rear-door" d="M12 64h24v3H12z" />
            <path class="ste-truck-bumper" d="M15 3h18M13 69h22" />
            <rect class="ste-truck-headlight" x="12.5" y="8.5" width="4.5" height="3.5" rx="1" />
            <rect class="ste-truck-headlight" x="31" y="8.5" width="4.5" height="3.5" rx="1" />
            <rect class="ste-truck-tail-light" x="10" y="64" width="3.5" height="3" rx="1" />
            <rect class="ste-truck-tail-light" x="34.5" y="64" width="3.5" height="3" rx="1" />
          </g>
        </svg>
      </div>`,
    iconSize: [42, 63],
    iconAnchor: [21, 32],
    popupAnchor: [0, -32]
  });
}

function setMarkerHeading(marker: Marker, heading: number): void {
  const vehicle = marker.getElement()?.querySelector<HTMLElement>('.ste-truck-vehicle');
  if (vehicle) vehicle.style.transform = `rotate(${heading}deg)`;
}

function setMarkerStale(marker: Marker, stale: boolean): void {
  const vehicle = marker.getElement()?.querySelector('.ste-truck-vehicle');
  vehicle?.classList.toggle('stale', stale);
  vehicle?.classList.toggle('active', !stale);
}

function animateMarker(accountId: number, marker: Marker, target: L.LatLng): void {
  const state = markerMotion.get(accountId) || { animationFrame: null, heading: 0 };
  if (state.animationFrame !== null) cancelAnimationFrame(state.animationFrame);

  const start = marker.getLatLng();
  const distance = start.distanceTo(target);
  if (distance < 0.5) {
    marker.setLatLng(target);
    setMarkerHeading(marker, state.heading);
    markerMotion.set(accountId, { ...state, animationFrame: null });
    return;
  }

  const targetHeading = bearingBetween(start, target);
  const startHeading = state.heading;
  const headingDelta = shortestRotation(startHeading, targetHeading);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduceMotion ? 0 : Math.min(2600, Math.max(1400, 1400 + distance * 0.8));
  const startedAt = performance.now();

  const step = (timestamp: number): void => {
    const progress = duration === 0 ? 1 : Math.min(1, (timestamp - startedAt) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    const position = interpolatePoint(start, target, eased);
    const heading = startHeading + headingDelta * eased;
    marker.setLatLng(position);
    setMarkerHeading(marker, heading);
    state.heading = heading;

    if (progress < 1) {
      state.animationFrame = requestAnimationFrame(step);
    } else {
      state.animationFrame = null;
      state.heading = (targetHeading + 360) % 360;
      marker.setLatLng(target);
      setMarkerHeading(marker, state.heading);
    }
  };

  markerMotion.set(accountId, state);
  state.animationFrame = requestAnimationFrame(step);
}

function updateMarker(item: TrackingItem, fitIfFirst = false): void {
  if (!map || item.lat === null || item.lng === null) return;
  const latLng = L.latLng(item.lat, item.lng);
  const stale = isStale(item);
  const popup = `
    <div style="min-width:190px;font-family:Arial,sans-serif">
      <strong>${escapeHtml(item.dbl_number)}</strong><br>
      ${escapeHtml(item.driver_name || 'Driver belum diisi')}<br>
      ${escapeHtml(item.vehicle_plate || '-')}<br>
      <small>${escapeHtml(item.origin || '-')} → ${escapeHtml(item.destination || '-')}</small><br>
      <small>Update: ${escapeHtml(formatLastUpdate(item.recorded_at))}</small>
    </div>`;

  const existing = markers.get(item.tracking_account_id);
  if (existing) {
    existing.setPopupContent(popup);
    setMarkerStale(existing, stale);
    animateMarker(item.tracking_account_id, existing, latLng);
  } else {
    const marker = L.marker(latLng, { icon: createTruckIcon(stale) }).addTo(map).bindPopup(popup);
    markers.set(item.tracking_account_id, marker);
    markerMotion.set(item.tracking_account_id, { animationFrame: null, heading: 0 });
    setMarkerHeading(marker, 0);
    if (fitIfFirst && markers.size === 1) map.setView(latLng, 12);
  }
}

function removeTrip(accountId: number): void {
  const motion = markerMotion.get(accountId);
  if (motion?.animationFrame !== null && motion?.animationFrame !== undefined) {
    cancelAnimationFrame(motion.animationFrame);
  }
  markerMotion.delete(accountId);
  const marker = markers.get(accountId);
  if (marker && map) map.removeLayer(marker);
  markers.delete(accountId);
  const next = { ...tripsByAccount.value };
  delete next[String(accountId)];
  tripsByAccount.value = next;
  const timer = removalTimers.get(accountId);
  if (timer) clearTimeout(timer);
  removalTimers.delete(accountId);
}

function applyPayload(topic: string, raw: string): void {
  const topicAccountId = accountIdFromTopic(mqttTopic, topic);
  const payload = parseTrackingPayload(raw);
  if (!payload || payload.tracking_account_id !== topicAccountId) return;

  const key = String(payload.tracking_account_id);
  const previous = tripsByAccount.value[key];
  if (!isNewerTrackingPayload(previous?.recorded_at || null, payload.recorded_at)) return;

  const item: TrackingItem = {
    id: payload.dbl_id,
    dbl_number: payload.dbl_number,
    dbl_date: previous?.dbl_date || '',
    driver_name: payload.driver_name,
    vehicle_plate: payload.vehicle_plate,
    origin: payload.origin,
    destination: payload.destination,
    status: payload.status,
    shipment_count: previous?.shipment_count || 0,
    tracking_account_id: payload.tracking_account_id,
    lat: payload.status === 'DEPARTED' ? payload.lat : previous?.lat ?? null,
    lng: payload.status === 'DEPARTED' ? payload.lng : previous?.lng ?? null,
    accuracy_m: payload.accuracy_m,
    speed_kph: payload.speed_kph,
    recorded_at: payload.recorded_at
  };
  tripsByAccount.value = { ...tripsByAccount.value, [key]: item };
  updateMarker(item, true);

  if (payload.status === 'COMPLETED') {
    const oldTimer = removalTimers.get(payload.tracking_account_id);
    if (oldTimer) clearTimeout(oldTimer);
    removalTimers.set(payload.tracking_account_id, setTimeout(() => removeTrip(payload.tracking_account_id), 5000));
  }
}

async function loadActiveTrips(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const response = await fetch('/api/tracking?endpoint=active', { credentials: 'include' });
    if (!response.ok) throw new Error(response.status === 403 ? 'Akses live tracking ditolak' : 'Gagal memuat DBL aktif');
    const data = await response.json() as { items?: ActiveTrip[] };
    const next: Record<string, TrackingItem> = {};
    for (const trip of data.items || []) {
      next[String(trip.tracking_account_id)] = {
        ...trip,
        lat: null,
        lng: null,
        accuracy_m: null,
        speed_kph: null,
        recorded_at: null
      };
    }
    tripsByAccount.value = next;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat perjalanan aktif';
  } finally {
    loading.value = false;
  }
}

function initializeMap(): void {
  if (!mapContainer.value || map) return;
  map = L.map(mapContainer.value, { zoomControl: true }).setView([-2.5, 118], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
}

function connectMqtt(): void {
  if (!mqttUrl || !mqttUsername || !mqttPassword || !mqttTopic) {
    connectionState.value = 'error';
    connectionError.value = 'Layanan pelacakan belum tersedia.';
    return;
  }
  connectionState.value = 'connecting';
  mqttClient = mqtt.connect(mqttUrl, {
    username: mqttUsername,
    password: mqttPassword,
    clientId: `ste-web-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,
    connectTimeout: 10_000,
    reconnectPeriod: 5_000,
    protocolVersion: 4
  });
  mqttClient.on('connect', () => {
    connectionState.value = 'connected';
    connectionError.value = '';
    mqttClient?.subscribe(mqttTopic, { qos: 1 }, error => {
      if (error) {
        connectionState.value = 'error';
        connectionError.value = 'Koneksi pelacakan tidak dapat diaktifkan.';
      }
    });
  });
  mqttClient.on('reconnect', () => { connectionState.value = 'reconnecting'; });
  mqttClient.on('offline', () => { connectionState.value = 'offline'; });
  mqttClient.on('close', () => {
    if (connectionState.value !== 'error') connectionState.value = 'offline';
  });
  mqttClient.on('error', error => {
    connectionState.value = 'error';
    connectionError.value = error.message
      ? 'Koneksi pelacakan bermasalah. Sistem akan mencoba kembali.'
      : 'Koneksi pelacakan gagal.';
  });
  mqttClient.on('message', (topic, message) => applyPayload(topic, message.toString()));
}

function focusTrip(item: TrackingItem): void {
  if (!map || item.lat === null || item.lng === null) return;
  map.setView([item.lat, item.lng], 13, { animate: true });
  markers.get(item.tracking_account_id)?.openPopup();
}

function fitAllMarkers(): void {
  if (!map || markers.size === 0) return;
  const bounds = L.latLngBounds(Array.from(markers.values()).map(marker => marker.getLatLng()));
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
}

watch(() => route.query.q, value => {
  searchQuery.value = typeof value === 'string' ? value : '';
});

onMounted(async () => {
  await nextTick();
  initializeMap();
  await loadActiveTrips();
  connectMqtt();
  clockTimer = setInterval(() => {
    now.value = Date.now();
    for (const item of Object.values(tripsByAccount.value)) updateMarker(item);
  }, 60_000);
  window.setTimeout(() => map?.invalidateSize(), 150);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  for (const motion of markerMotion.values()) {
    if (motion.animationFrame !== null) cancelAnimationFrame(motion.animationFrame);
  }
  markerMotion.clear();
  mqttClient?.end(true);
  mqttClient = null;
  map?.remove();
  map = null;
  markers.clear();
});
</script>

<template>
  <div class="space-y-4 pb-20 lg:pb-0">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Pelacakan Armada</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Pantau posisi dan pergerakan armada aktif secara langsung.</p>
      </div>
      <div class="flex items-center text-xs">
        <span :class="[
          'inline-flex items-center rounded-full px-3 py-1.5 font-semibold',
          connectionState === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
          connectionState === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        ]">
          {{ connectionLabel }}
        </span>
      </div>
    </div>

    <div v-if="connectionError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
      {{ connectionError }}
    </div>
    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
      {{ loadError }}
      <button class="ml-2 font-semibold underline" @click="loadActiveTrips">Coba lagi</button>
    </div>

    <div class="grid min-h-[68vh] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div ref="mapContainer" class="h-[55vh] min-h-[420px] w-full xl:h-[72vh]"></div>
        <button
          v-if="activeItems.some(item => item.lat !== null && item.lng !== null)"
          class="absolute right-3 top-3 z-[500] rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
          @click="fitAllMarkers"
        >
          Lihat semua armada
        </button>
      </div>

      <aside class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-200 p-4 dark:border-gray-700">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold text-gray-900 dark:text-gray-100">DBL Aktif</h2>
            <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{{ activeItems.length }}</span>
          </div>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Cari DBL, supir, plat, rute..."
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
        </div>

        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div v-if="loading" class="py-12 text-center text-sm text-gray-500">Memuat perjalanan aktif...</div>
          <div v-else-if="activeItems.length === 0" class="rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            Belum ada DBL aktif dari aplikasi driver.
          </div>
          <button
            v-for="item in activeItems"
            :key="item.tracking_account_id"
            type="button"
            class="w-full rounded-xl border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
            @click="focusTrip(item)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-semibold text-gray-900 dark:text-gray-100">{{ item.dbl_number }}</div>
                <div class="truncate text-sm text-gray-600 dark:text-gray-300">{{ item.driver_name || 'Supir belum diisi' }}</div>
              </div>
              <span :class="[
                'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase',
                item.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                isStale(item) ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              ]">
                {{ item.status === 'COMPLETED' ? 'Selesai' : isStale(item) ? (item.recorded_at ? 'Stale' : 'Menunggu GPS') : 'Live' }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">{{ item.vehicle_plate || 'Tanpa plat' }}</span>
              <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">{{ item.shipment_count }} resi</span>
            </div>
            <div class="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
              {{ item.origin || '-' }} → {{ item.destination || '-' }}
            </div>
            <div class="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
              <span>{{ formatLastUpdate(item.recorded_at) }}</span>
              <span v-if="item.speed_kph !== null">{{ Math.round(item.speed_kph) }} km/j</span>
            </div>
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style>
.ste-truck-marker {
  background: transparent;
  border: 0;
}

.ste-truck-vehicle {
  position: relative;
  width: 42px;
  height: 63px;
  transform-origin: 50% 50%;
  will-change: transform;
}

.ste-truck-vehicle svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ste-truck-shadow {
  fill: rgb(15 23 42 / 22%);
  filter: blur(3px);
}

.ste-truck-outline {
  fill: none;
  stroke: #60a5fa;
  stroke-linejoin: round;
  stroke-width: 2;
  opacity: 0;
  vector-effect: non-scaling-stroke;
}

.ste-truck-wheel {
  fill: #111827;
  stroke: #fff;
  stroke-width: 1.1;
}

.ste-truck-cargo {
  fill: #1e40af;
  stroke: #fff;
  stroke-width: 1.6;
}

.ste-truck-cargo-panel {
  fill: #2563eb;
  stroke: #1e3a8a;
  stroke-width: 1;
}

.ste-truck-cab {
  fill: #1d4ed8;
  stroke: #fff;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.ste-truck-hood {
  fill: #2563eb;
  stroke: #1e3a8a;
  stroke-width: 0.9;
}

.ste-truck-windshield {
  fill: #dbeafe;
  stroke: #1e3a8a;
  stroke-width: 1;
}

.ste-truck-window-divider,
.ste-truck-cab-detail {
  fill: none;
  stroke: #1e3a8a;
  stroke-linecap: round;
  stroke-width: 1;
}

.ste-truck-cargo-ridge {
  fill: none;
  stroke: #60a5fa;
  stroke-linecap: round;
  stroke-width: 0.9;
}

.ste-truck-rear-door {
  fill: #1e3a8a;
}

.ste-truck-bumper {
  fill: none;
  stroke: #e2e8f0;
  stroke-linecap: round;
  stroke-width: 1.5;
}

.ste-truck-mirror {
  fill: #1e40af;
  stroke: #fff;
  stroke-width: 1;
}

.ste-truck-headlight {
  fill: #fef3c7;
}

.ste-truck-tail-light {
  fill: #fb7185;
}

.ste-truck-vehicle.active .ste-truck-outline {
  animation: ste-truck-border-pulse 1.8s ease-in-out infinite;
}

.ste-truck-vehicle.stale .ste-truck-body {
  filter: grayscale(1);
  opacity: 0.78;
}

@keyframes ste-truck-border-pulse {
  0%, 100% {
    stroke-width: 1.5;
    opacity: 0.25;
    filter: drop-shadow(0 0 1px rgb(96 165 250 / 20%));
  }

  50% {
    stroke-width: 3;
    opacity: 0.95;
    filter: drop-shadow(0 0 4px rgb(37 99 235 / 75%));
  }
}

@media (prefers-reduced-motion: reduce) {
  .ste-truck-vehicle.active .ste-truck-outline {
    animation: none;
    opacity: 0.7;
  }
}

.leaflet-container {
  font-family: inherit;
}
</style>
