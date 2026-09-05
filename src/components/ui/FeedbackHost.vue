<script setup lang="ts">
import { requestPending } from '../../composables/useRequestActivity';
import { navigationPending } from '../../composables/useNavigation';
import { notices, dismissNotice, pauseNotice, resumeNotice } from '../../composables/useNotifications';
function resumeWhenIdle(event: Event, id: number) {
  const element = event.currentTarget as HTMLElement;
  if (!element.matches(':hover') && !element.contains(document.activeElement)) resumeNotice(id);
}
</script>

<template>
  <Teleport to="body">
    <div class="feedback-host print:hidden" aria-label="Notifikasi">
      <TransitionGroup name="feedback">
        <div
v-for="notice in notices" :key="notice.id" class="feedback-notice"
          :role="notice.kind === 'error' ? 'alert' : 'status'"
          @mouseenter="pauseNotice(notice.id)" @mouseleave="resumeWhenIdle($event, notice.id)"
          @focusin="pauseNotice(notice.id)" @focusout="resumeWhenIdle($event, notice.id)"
>
          <svg class="mt-0.5 h-5 w-5 shrink-0" :class="notice.kind === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path v-if="notice.kind === 'success'" d="m7 12 3 3 7-7" />
            <path v-else d="M12 7v6m0 3v1" />
          </svg>
          <p class="min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-relaxed">{{ notice.message }}</p>
          <button class="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Tutup notifikasi" @click="dismissNotice(notice.id)">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
    <Transition name="feedback">
      <div v-if="navigationPending || requestPending" class="navigation-feedback print:hidden" role="status">
        <span class="navigation-progress" role="progressbar" :aria-label="navigationPending ? 'Membuka halaman' : 'Memuat data'"><span /></span>
        {{ navigationPending ? 'Membuka halaman...' : 'Memuat data...' }}
      </div>
    </Transition>
  </Teleport>
</template>
