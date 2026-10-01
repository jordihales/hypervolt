<script setup>
import { computed } from 'vue'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  modelValue: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 100,
  },
  step: {
    type: Number,
    default: 1,
  },
  unit: {
    type: String,
    default: '',
  },
  hint: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const displayValue = computed(() => {
  const decimals = props.step < 1 ? 1 : 0
  return `${Number(props.modelValue).toFixed(decimals)}${props.unit}`
})

const progress = computed(() => {
  const span = props.max - props.min
  if (span <= 0) {
    return 0
  }

  return ((props.modelValue - props.min) / span) * 100
})

const updateValue = (event) => {
  emit('update:modelValue', Number(event.target.value))
}
</script>

<template>
  <div class="slider-control">
    <div class="control-heading">
      <div>
        <label :for="id">{{ label }}</label>
        <p v-if="hint">{{ hint }}</p>
      </div>
      <strong>{{ displayValue }}</strong>
    </div>
    <input
      :id="id"
      class="range"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :style="{ '--range-progress': `${progress}%` }"
      @input="updateValue"
    />
  </div>
</template>
