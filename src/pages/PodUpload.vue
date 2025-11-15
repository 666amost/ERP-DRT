<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const token = computed(() => (route.params.token as string) || '');
const scannedCode = ref('');
const scannedAt = ref('');
const note = ref('');
const scanning = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
let qrScanner: any = null;

const files = ref<File[]>([]);
// cached preview URLs for files; must keep indexes synced with `files`
const filePreviews = ref<string[]>([]);
const compressedBlobs = ref<Blob[]>([]);
const uploading = ref(false);
const progress = ref<number[]>([]);
const uploads = ref<{ url?: string; pathname?: string; size: number; type: string; dataUrl?: string }[]>([]);
const errorMsg = ref('');

const MAX_FILE_MB = 5;
const MAX_COUNT = 3;

function pickFiles(e: Event) {
  errorMsg.value = '';
  const input = e.target as HTMLInputElement;
  const selected = Array.from(input.files || []);
  if (selected.length + files.value.length > MAX_COUNT) {
    errorMsg.value = `Max ${MAX_COUNT} files.`;
    return;
  }
  for (const f of selected) {
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_MB) {
      errorMsg.value = `File ${f.name} > ${MAX_FILE_MB}MB.`;
      return;
    }
  }
  for (const f of selected) {
    files.value.push(f);
    try {
      if (typeof window !== 'undefined' && typeof URL !== 'undefined') {
        filePreviews.value.push(URL.createObjectURL(f));
      } else {
        filePreviews.value.push('');
      }
    } catch {
      filePreviews.value.push('');
    }
  }
}

function removeFile(idx: number) {
  try {
    const url = filePreviews.value[idx];
    if (url && typeof URL !== 'undefined') URL.revokeObjectURL(url);
  } catch {
    // noop
  }
  files.value.splice(idx, 1);
  filePreviews.value.splice(idx, 1);
}

function resetScan() {
  scannedCode.value = '';
  scannedAt.value = '';
  note.value = '';
  errorMsg.value = '';
  // revoke and clear previews
  try {
    filePreviews.value.forEach((u) => { if (u && typeof URL !== 'undefined') URL.revokeObjectURL(u); });
  } catch {}
  filePreviews.value = [];
  files.value = [];
  uploads.value = [];
}

import imageCompression from 'browser-image-compression';

async function compressToTarget(input: File, maxWidth = 1280, maxHeight = 1280, targetKB = 200) {
  const options = {
    maxWidthOrHeight: Math.max(maxWidth, maxHeight),
    maxSizeMB: targetKB / 1024,
    useWebWorker: true,
    initialQuality: 0.7,
    fileType: 'image/jpeg',
  };
  const compressed = await imageCompression(input, options);
  if (compressed.size > targetKB * 1024) {
    throw new Error('Gambar terlalu besar setelah kompresi');
  }
  return compressed;
}

async function uploadOne(blob: Blob, name: string, index: number) {
  // If manual flow (no delivery token), don't upload to /api/blob; instead encode to dataUrl
  if (token.value === 'manual' || !token.value) {
    return await new Promise<{ dataUrl: string; size: number; type: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        progress.value[index] = 100;
        resolve({ dataUrl: String(reader.result), size: (blob as any).size || 0, type: blob.type || 'image/jpeg' });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(blob);
    });
  }

  return await new Promise<{ url: string; pathname: string; size: number; type: string }>((resolve, reject) => {
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const xhr = new XMLHttpRequest();
    const q = new URLSearchParams({ ext, token: token.value });
    xhr.open('POST', `/api/blob?endpoint=upload&${q.toString()}`);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        progress.value[index] = Math.round((ev.loaded / ev.total) * 100);
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: data.url, pathname: data.pathname, size: data.size, type: blob.type });
        } else {
          reject(new Error(data.error || `Upload failed: ${xhr.status}`));
        }
      } catch {
        reject(new Error('Invalid server response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(blob);
  });
}

async function startUpload() {
  try {
    errorMsg.value = '';
    if (files.value.length === 0) {
      errorMsg.value = 'Pilih minimal 1 foto.';
      return;
    }
    uploading.value = true;
    progress.value = files.value.map(() => 0);
    compressedBlobs.value = [];
    uploads.value = [];
  // Optionally, if you want to clear original file previews after successful upload, revoke them
  // but keeping them allows user to see the images while upload finishes.

    for (let i = 0; i < files.value.length; i++) {
      const f = files.value[i];
      const blob = await compressToTarget(f, 1280, 1280, 400); // ~300-500 KB target
      compressedBlobs.value.push(blob);
      const u = await uploadOne(blob, f.name, i);
      uploads.value.push(u);
    }
  } catch (e: unknown) {
    errorMsg.value = (e as Error).message;
  } finally {
    uploading.value = false;
  }
}

async function submitPOD() {
    try {
      errorMsg.value = '';
      const payload: any = { photos: uploads.value };
      if (token.value === 'manual' || !token.value) {
        if (!scannedCode.value) {
          throw new Error('Masukkan atau scan resi terlebih dahulu');
        }
        payload.public_code = scannedCode.value;
        payload.scanned_at = scannedAt.value || new Date().toISOString();
        payload.note = note.value || null;
      } else {
        payload.token = token.value;
      }

      // Debugging: log payload before sending
      console.debug('submitPOD payload', payload);
      // Validate uploads content
      if (!uploads.value || uploads.value.length === 0) {
        throw new Error('Belum ada foto yang diupload');
      }
      if (token.value === 'manual' || !token.value) {
        // ensure we have dataUrl in uploads
        const missing = uploads.value.some(u => !u || !u.dataUrl);
        if (missing) throw new Error('Beberapa file belum ter-encode ke dataUrl. Silakan upload ulang.');
      } else {
        const missing = uploads.value.some(u => !u || !u.url);
        if (missing) throw new Error('Beberapa file belum diupload. Silakan upload ulang.');
      }

      const res = await fetch('/api/pod?endpoint=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let text = await res.text();
      let data: any = undefined;
      try { data = text ? JSON.parse(text) : undefined; } catch {
        // not JSON
      }
      if (!res.ok) {
        const errMsg = (data && data.error) || text || `Submit failed: ${res.status}`;
        console.error('submitPOD server error', res.status, errMsg);
        throw new Error(errMsg);
      }
      alert('POD tersimpan. ID: ' + data.pod_id);
      // after successful POD submission, redirect to dashboard or close
      window.location.href = '/';
    } catch (e: unknown) {
      // Display error message to UI and also console for debug
      const message = (e as Error).message || String(e);
      console.error('submitPOD error', message);
      errorMsg.value = message;
    }
}

async function startScanner() {
  try {
    errorMsg.value = '';
    scanning.value = true;
    const mod = await import('qr-scanner');
    const QrScanner = (mod as any).default || (mod as any);
    // Use unpkg worker path so we don't need to bundle the worker file
    (QrScanner as any).WORKER_PATH = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';
    if (!videoRef.value) throw new Error('No video element');
    qrScanner = new (QrScanner as any)(videoRef.value, (result: string) => {
      scannedCode.value = result;
      scannedAt.value = new Date().toISOString();
      stopScanner();
    });
    await qrScanner.start();
  } catch (e) {
    scanning.value = false;
    errorMsg.value = 'Scanner gagal: ' + String(e);
  }
}

function stopScanner() {
  try {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy && qrScanner.destroy();
      qrScanner = null;
    }
  } finally {
    scanning.value = false;
  }
}

onBeforeUnmount(() => {
  try {
    filePreviews.value.forEach((u) => { if (u && typeof URL !== 'undefined') URL.revokeObjectURL(u); });
  } catch {}
  filePreviews.value = [];
  stopScanner();
});
</script>

<template>
  <section class="max-w-lg mx-auto p-4 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold">
          POD Upload
        </h2>
        <p class="text-xs text-gray-500">
          Token: <span class="font-medium text-gray-700">{{ token || '(tanpa token di route)' }}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="scanning"
          class="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-60"
          @click="startScanner"
        >
          Scan Resi
        </button>
        <button
          class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm"
          @click="resetScan"
        >
          Reset
        </button>
      </div>
    </div>

    <div
      v-if="scanning"
      class="mb-3"
    >
      <div class="w-full rounded-md overflow-hidden border border-gray-200">
        <video
          ref="videoRef"
          autoplay
          muted
          playsinline
          class="w-full h-56 object-cover bg-black"
        />
      </div>
      <div class="mt-2 flex justify-end">
        <button
          class="px-3 py-1 bg-red-600 text-white rounded-md text-sm"
          @click="stopScanner"
        >
          Stop Scanner
        </button>
      </div>
    </div>

    <div class="space-y-3 mb-4">
      <div>
        <label class="block text-sm font-medium mb-1">Resi (kode)</label>
        <input
          v-model="scannedCode"
          placeholder="Scan atau masukkan kode resi"
          class="w-full px-3 py-2 border rounded-md"
        >
        <div class="text-xs text-gray-500 mt-1">
          Scanned at: <span class="font-mono">{{ scannedAt || '-' }}</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Note (opsional)</label>
        <textarea
          v-model="note"
          rows="3"
          class="w-full px-3 py-2 border rounded-md"
          placeholder="Catatan untuk POD (mis. kondisi paket)"
        />
      </div>
    </div>

    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">Foto POD (max {{ MAX_COUNT }})</label>
      <div class="flex gap-2">
        <label class="inline-flex items-center px-3 py-2 bg-white border rounded-md cursor-pointer text-sm shadow-sm">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            :disabled="uploading"
            class="hidden"
            @change="pickFiles"
          >
          <span class="text-sm">Pick from camera / gallery</span>
        </label>
        <button
          :disabled="uploading || files.length===0"
          class="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm disabled:opacity-60"
          @click="startUpload"
        >
          Compress & Upload
        </button>
      </div>
      <div
        v-if="files.length"
        class="mt-3 grid grid-cols-3 gap-2"
      >
        <div
          v-for="(f, i) in files"
          :key="i"
          class="relative"
        >
          <img
            :src="filePreviews[i] || ''"
            class="w-full h-24 object-cover rounded-md border"
          >
          <button
            class="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-xs"
            @click="removeFile(i)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="progress.length"
      class="mb-4"
    >
      <div
        v-for="(p, i) in progress"
        :key="i"
        class="mb-2"
      >
        <div class="text-xs">
          File {{ i + 1 }}: {{ p || 0 }}%
        </div>
        <div class="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div
            :style="{ width: (p||0)+ '%' }"
            class="h-full bg-emerald-500"
          />
        </div>
      </div>
    </div>

    <div
      v-if="uploads.length"
      class="mb-6"
    >
      <h3 class="text-sm font-medium mb-2">
        Uploaded
      </h3>
      <ul class="text-sm space-y-1">
        <li
          v-for="(u, i) in uploads"
          :key="i"
        >
          <span class="font-mono">
            <template v-if="u.url">
              <a
                :href="u.url"
                target="_blank"
                rel="noopener noreferrer"
              >{{ u.url }}</a>
            </template>
            <template v-else-if="u.pathname">{{ u.pathname }}</template>
            <template v-else-if="u.dataUrl">local:dataUrl</template>
            <template v-else>-</template>
          </span>
          <span class="text-xs text-gray-500"> ({{ Math.round((u.size || 0)/1024) }} KB)</span>
        </li>
      </ul>
    </div>

    <div class="flex items-center justify-between">
      <div class="text-sm text-red-600">
        <span v-if="errorMsg">{{ errorMsg }}</span>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="(token==='manual' && !scannedCode) || uploads.length===0"
          class="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-60"
          @click="submitPOD"
        >
          Kirim POD
        </button>
      </div>
    </div>
  </section>
</template>
