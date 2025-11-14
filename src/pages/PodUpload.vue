<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const token = computed(() => (route.params.token as string) || '');

const files = ref<File[]>([]);
const compressedBlobs = ref<Blob[]>([]);
const uploading = ref(false);
const progress = ref<number[]>([]);
const uploads = ref<{ url: string; pathname: string; size: number; type: string }[]>([]);
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
  files.value.push(...selected);
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
    const res = await fetch('/api/pod?endpoint=submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value, photos: uploads.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit gagal');
    alert('POD tersimpan. ID: ' + data.pod_id);
  } catch (e: unknown) {
    errorMsg.value = (e as Error).message;
  }
}
</script>

<template>
  <section style="max-width:720px;margin:24px auto;padding:16px">
    <h2>POD Upload</h2>
    <p>Token: {{ token || '(tanpa token di route)' }}</p>

    <input
      type="file"
      accept="image/*"
      multiple
      :disabled="uploading"
      @change="pickFiles"
    />
    <p v-if="files.length">
      Dipilih: {{ files.length }} (maks {{ MAX_COUNT }})
    </p>

    <div v-if="files.length">
      <button :disabled="uploading" @click="startUpload">
        Upload
      </button>
    </div>

    <div v-if="progress.length">
      <div v-for="(p, i) in progress" :key="i" style="margin:8px 0;">
        <div>File {{ i + 1 }}: {{ p || 0 }}%</div>
        <div style="height:8px;background:#eee;border-radius:4px;overflow:hidden;">
          <div :style="{ width: (p||0)+ '%', height: '8px', background: '#16a34a' }" />
        </div>
      </div>
    </div>

    <div v-if="uploads.length">
      <h3>Uploaded</h3>
      <ul>
        <li v-for="(u, i) in uploads" :key="i">
          {{ u.pathname }} ({{ Math.round(u.size/1024) }} KB)
        </li>
      </ul>
      <button @click="submitPOD">Kirim POD</button>
    </div>

    <p v-if="errorMsg" style="color:#b91c1c">{{ errorMsg }}</p>
  </section>
</template>
