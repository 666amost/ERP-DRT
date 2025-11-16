<script setup lang="ts"></script>

<template>
  <Transition name="page" mode="out-in">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </Transition>
</template>
