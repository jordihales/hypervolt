<script setup>
import { computed } from 'vue'

const props = defineProps({
  products: {
    type: Array,
    default: () => [],
  },
  tariffOptions: {
    type: Array,
    default: () => [],
  },
  productCode: {
    type: String,
    required: true,
  },
  selectedRegionCode: {
    type: String,
    default: '',
  },
  selectedProduct: {
    type: Object,
    default: null,
  },
  selectedTariffOption: {
    type: Object,
    default: null,
  },
  manualRatePence: {
    type: Number,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isCatalogLoading: {
    type: Boolean,
    default: false,
  },
  isTariffOptionsLoading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  catalogErrorMessage: {
    type: String,
    default: '',
  },
  hasLiveRates: {
    type: Boolean,
    default: false,
  },
  lastFetchedAt: {
    type: Date,
    default: null,
  },
  rateCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits([
  'selectProduct',
  'selectRegion',
  'update:manualRatePence',
  'reloadProducts',
  'fetch',
])

const canFetchRates = computed(
  () =>
    Boolean(props.productCode && props.selectedRegionCode && props.selectedTariffOption) &&
    !props.isLoading &&
    !props.isCatalogLoading &&
    !props.isTariffOptionsLoading,
)

const productDescription = computed(() => props.selectedProduct?.description || '')

const selectedRateLabel = computed(() => {
  const rate = props.selectedTariffOption?.unitRatePence

  if (!Number.isFinite(rate)) {
    return ''
  }

  return `${rate.toFixed(1)}p/kWh standard rate`
})
</script>

<template>
  <section class="panel tariff-panel" aria-labelledby="tariff-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Tariff</p>
        <h2 id="tariff-title">Octopus pricing</h2>
      </div>
      <span class="status-dot" :class="{ active: hasLiveRates }"></span>
    </div>

    <div class="form-grid">
      <label class="text-field">
        <span>Tariff</span>
        <select
          :value="productCode"
          :disabled="isCatalogLoading"
          @change="emit('selectProduct', $event.target.value)"
        >
          <option value="">
            {{ isCatalogLoading ? 'Loading Octopus tariffs...' : 'Choose your Octopus tariff' }}
          </option>
          <option v-for="product in products" :key="product.code" :value="product.code">
            {{ product.fullName }}
          </option>
        </select>
      </label>

      <label class="text-field">
        <span>Region</span>
        <select
          :value="selectedRegionCode"
          :disabled="!productCode || isTariffOptionsLoading || tariffOptions.length === 0"
          @change="emit('selectRegion', $event.target.value)"
        >
          <option value="">
            {{ isTariffOptionsLoading ? 'Loading regional rates...' : 'Choose your supply region' }}
          </option>
          <option
            v-for="option in tariffOptions"
            :key="option.regionCode"
            :value="option.regionCode"
          >
            {{ option.regionName }}
          </option>
        </select>
      </label>

      <label class="text-field">
        <span>Manual fallback rate</span>
        <input
          :value="manualRatePence"
          type="number"
          min="0"
          step="0.1"
          inputmode="decimal"
          @input="emit('update:manualRatePence', Number($event.target.value))"
        />
      </label>
    </div>

    <div v-if="selectedTariffOption || productDescription" class="tariff-summary">
      <strong>{{ selectedProduct?.displayName || 'Selected tariff' }}</strong>
      <span v-if="selectedTariffOption">
        {{ selectedTariffOption.regionName }}<template v-if="selectedRateLabel"> · {{ selectedRateLabel }}</template>
      </span>
      <p v-if="productDescription">{{ productDescription }}</p>
    </div>

    <button class="primary-action" type="button" :disabled="!canFetchRates" @click="emit('fetch')">
      {{ isLoading ? 'Fetching rates...' : 'Fetch live rates' }}
    </button>

    <p v-if="catalogErrorMessage" class="state-message error">
      {{ catalogErrorMessage }}
      <button class="inline-action" type="button" @click="emit('reloadProducts')">Retry</button>
    </p>
    <p v-else-if="errorMessage" class="state-message error">{{ errorMessage }} Manual rate remains active.</p>
    <p v-else-if="hasLiveRates" class="state-message success">
      {{ rateCount }} live rate{{ rateCount === 1 ? '' : 's' }} loaded
      <span v-if="lastFetchedAt">at {{ lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>.
    </p>
    <p v-else class="state-message">
      Manual rate is ready immediately. Pick your tariff and region when you want live Octopus pricing.
    </p>
  </section>
</template>
