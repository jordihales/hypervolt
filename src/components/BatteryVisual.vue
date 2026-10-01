<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: {
    type: Number,
    required: true,
  },
  target: {
    type: Number,
    required: true,
  },
})

const currentWidth = computed(() => `${Math.min(Math.max(props.current, 0), 100)}%`)
const targetWidth = computed(() => `${Math.min(Math.max(props.target, 0), 100)}%`)
</script>

<template>
  <section class="battery-visual" aria-label="Battery charge visual">
    <div class="battery-shell">
      <div class="battery-fill target" :style="{ width: targetWidth }"></div>
      <div class="battery-fill current" :style="{ width: currentWidth }"></div>
      <div class="battery-grid"></div>
      <span class="battery-copy">{{ current.toFixed(0) }}% → {{ target.toFixed(0) }}%</span>
    </div>
    <div class="battery-cap"></div>
  </section>
</template>
