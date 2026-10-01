<script setup>
import { computed, onMounted, ref, watch } from "vue";
import BatteryVisual from "./components/BatteryVisual.vue";
import ResultCard from "./components/ResultCard.vue";
import SliderControl from "./components/SliderControl.vue";
import TariffSettings from "./components/TariffSettings.vue";
import { useChargeCalculator } from "./composables/useChargeCalculator";
import { useOctopusTariff } from "./composables/useOctopusTariff";

const STORAGE_KEY = "hypervolt:settings";

const chargerPresets = [
  { label: "Granny", value: 2.3 },
  { label: "Wall", value: 7.4 },
  { label: "11kW", value: 11 },
  { label: "22kW", value: 22 },
];

const batteryPresets = [
  { label: "Model 3 RWD", value: 57.5 },
  { label: "Model 3 LR", value: 75 },
  { label: "Model Y RWD", value: 60 },
  { label: "Model Y LR", value: 75 },
  { label: "Model S/X", value: 100 },
];

const pad = (value) => String(value).padStart(2, "0");

const toDateTimeLocalValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const roundToNextHalfHour = (date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const nextMinutes =
    minutes === 0 || minutes === 30 ? minutes : minutes < 30 ? 30 : 60;

  if (nextMinutes === 60) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  } else {
    rounded.setMinutes(nextMinutes);
  }

  return rounded;
};

const addHours = (date, hours) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

const formatDuration = (hoursValue) => {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(hoursValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
};

const formatTime = (date) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const readStoredSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const stored = readStoredSettings();
const defaultStartDate = roundToNextHalfHour(new Date());
const defaultStopDate = addHours(defaultStartDate, 5);

const chargerOutputKw = ref(stored.chargerOutputKw ?? 7.4);
const currentPercentage = ref(stored.currentPercentage ?? 34);
const targetPercentage = ref(stored.targetPercentage ?? 90);
const batteryCapacityKwh = ref(stored.batteryCapacityKwh ?? 75);
const chargingEfficiency = ref(stored.chargingEfficiency ?? 90);
const advancedOpen = ref(stored.advancedOpen ?? false);
const theme = ref(stored.theme === "light" ? "light" : "dark");
const chargeStartAt = ref(
  stored.chargeStartAt ?? toDateTimeLocalValue(defaultStartDate),
);
const chargeStopAt = ref(
  stored.chargeStopAt ?? toDateTimeLocalValue(defaultStopDate),
);
const isLightTheme = computed(() => theme.value === "light");

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
  },
  { immediate: true },
);

const calculator = useChargeCalculator({
  chargerOutputKw,
  currentPercentage,
  targetPercentage,
  batteryCapacityKwh,
  chargingEfficiency,
});

const tariff = useOctopusTariff();
tariff.productCode.value = stored.productCode ?? "";
tariff.tariffCode.value = stored.tariffCode ?? "";
tariff.selectedRegionCode.value = stored.selectedRegionCode ?? "";
tariff.manualRatePence.value = stored.manualRatePence ?? 30;

onMounted(async () => {
  await tariff.loadProducts();

  if (tariff.productCode.value) {
    await tariff.loadTariffOptions();
  }
});

watch(currentPercentage, (value) => {
  if (targetPercentage.value < value) {
    targetPercentage.value = value;
  }
});

watch(chargeStartAt, (value) => {
  const start = new Date(value);
  const stop = new Date(chargeStopAt.value);

  if (
    !Number.isNaN(start.getTime()) &&
    (Number.isNaN(stop.getTime()) || stop <= start)
  ) {
    chargeStopAt.value = toDateTimeLocalValue(addHours(start, 5));
  }
});

watch(
  [
    chargerOutputKw,
    currentPercentage,
    targetPercentage,
    batteryCapacityKwh,
    chargingEfficiency,
    advancedOpen,
    theme,
    chargeStartAt,
    chargeStopAt,
    tariff.productCode,
    tariff.tariffCode,
    tariff.selectedRegionCode,
    tariff.manualRatePence,
  ],
  () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chargerOutputKw: chargerOutputKw.value,
        currentPercentage: currentPercentage.value,
        targetPercentage: targetPercentage.value,
        batteryCapacityKwh: batteryCapacityKwh.value,
        chargingEfficiency: chargingEfficiency.value,
        advancedOpen: advancedOpen.value,
        theme: theme.value,
        chargeStartAt: chargeStartAt.value,
        chargeStopAt: chargeStopAt.value,
        productCode: tariff.productCode.value,
        tariffCode: tariff.tariffCode.value,
        selectedRegionCode: tariff.selectedRegionCode.value,
        manualRatePence: tariff.manualRatePence.value,
      }),
    );
  },
  { deep: true },
);

const scheduledStartDate = computed(() => new Date(chargeStartAt.value));
const scheduledStopDate = computed(() => new Date(chargeStopAt.value));
const hasValidSchedule = computed(
  () =>
    !Number.isNaN(scheduledStartDate.value.getTime()) &&
    !Number.isNaN(scheduledStopDate.value.getTime()) &&
    scheduledStopDate.value > scheduledStartDate.value,
);
const scheduleWindowHours = computed(() => {
  if (!hasValidSchedule.value) {
    return calculator.chargeDurationHours.value;
  }

  return (
    (scheduledStopDate.value - scheduledStartDate.value) / (60 * 60 * 1000)
  );
});
const effectiveChargeHours = computed(() =>
  Math.min(calculator.chargeDurationHours.value, scheduleWindowHours.value),
);
const scheduledGridEnergyRequired = computed(() =>
  Math.min(
    calculator.gridEnergyRequired.value,
    effectiveChargeHours.value * calculator.normalized.value.chargerOutputKw,
  ),
);
const scheduledBatteryEnergy = computed(
  () =>
    scheduledGridEnergyRequired.value *
    (calculator.normalized.value.chargingEfficiency / 100),
);
const scheduledBatteryPercentage = computed(
  () =>
    calculator.normalized.value.currentPercentage +
    (scheduledBatteryEnergy.value /
      calculator.normalized.value.batteryCapacityKwh) *
      100,
);
const scheduledStopPercentage = computed(() =>
  Math.min(
    calculator.normalized.value.targetPercentage,
    scheduledBatteryPercentage.value,
  ),
);
const reachesTargetInWindow = computed(
  () =>
    scheduledGridEnergyRequired.value >=
    calculator.gridEnergyRequired.value - 0.05,
);
const scheduleWindowLabel = computed(() =>
  formatDuration(scheduleWindowHours.value),
);
const scheduleWindowSummary = computed(() => {
  if (!hasValidSchedule.value) {
    return "Choose a valid charging window.";
  }

  return `${formatTime(scheduledStartDate.value)} to ${formatTime(scheduledStopDate.value)} · ${scheduleWindowLabel.value}`;
});
const scheduleCostDetail = computed(() => {
  if (!hasValidSchedule.value) {
    return "Using fallback until the window is valid";
  }

  if (reachesTargetInWindow.value) {
    return "Selected window reaches target";
  }

  return `Selected window reaches about ${scheduledStopPercentage.value.toFixed(0)}%`;
});

const pricing = computed(() =>
  tariff.estimateCost({
    gridEnergyRequired: scheduledGridEnergyRequired.value,
    chargeDurationHours: effectiveChargeHours.value,
    chargerOutputKw: calculator.normalized.value.chargerOutputKw,
    startDate: hasValidSchedule.value ? scheduledStartDate.value : new Date(),
  }),
);

const formatKwh = (value) => `${value.toFixed(1)} kWh`;
const formatPence = (value) => `${value.toFixed(1)}p/kWh`;
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);

const fetchTariffRates = () => {
  tariff.fetchRates({
    durationHours: Math.max(
      scheduleWindowHours.value,
      calculator.chargeDurationHours.value,
    ),
    periodFrom: hasValidSchedule.value ? scheduledStartDate.value : new Date(),
    periodTo: hasValidSchedule.value ? scheduledStopDate.value : null,
  });
};

const setChargerPreset = (value) => {
  chargerOutputKw.value = value;
};

const setBatteryPreset = (value) => {
  batteryCapacityKwh.value = value;
};

const setFullChargeWindow = () => {
  const start = hasValidSchedule.value
    ? scheduledStartDate.value
    : roundToNextHalfHour(new Date());
  chargeStartAt.value = toDateTimeLocalValue(start);
  chargeStopAt.value = toDateTimeLocalValue(
    addHours(start, calculator.chargeDurationHours.value),
  );
};

const toggleTheme = () => {
  theme.value = isLightTheme.value ? "dark" : "light";
};
</script>

<template>
  <main class="app-shell" :data-theme="theme">
    <section class="tesla-console" aria-label="Hypervolt charging console">
      <header class="console-nav">
        <div class="driver-profile">
          <span class="profile-icon" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">Charge planner</p>
            <h1>Hypervolt</h1>
          </div>
        </div>
        <div class="console-status">
          <button
            class="theme-toggle"
            type="button"
            :aria-pressed="isLightTheme"
            :aria-label="`Switch to ${isLightTheme ? 'dark' : 'light'} mode`"
            @click="toggleTheme"
          >
            <span class="theme-track" aria-hidden="true">
              <span class="theme-thumb"></span>
            </span>
            {{ isLightTheme ? "Light" : "Dark" }}
          </button>
          <div class="mode-pill" :class="{ live: tariff.hasLiveRates.value }">
            <span></span>
            {{ tariff.modeLabel.value }}
          </div>
        </div>
      </header>

      <section class="dashboard">
        <div class="panel calculator-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Energy</p>
              <h2>Charging setup</h2>
            </div>
          </div>

          <BatteryVisual
            :current="calculator.normalized.value.currentPercentage"
            :target="calculator.normalized.value.targetPercentage"
          />

          <section class="schedule-panel" aria-labelledby="schedule-title">
            <div class="control-heading">
              <div>
                <label id="schedule-title">Charge window</label>
                <p>{{ scheduleWindowSummary }}</p>
              </div>
              <strong>{{
                reachesTargetInWindow
                  ? "Target"
                  : `${scheduledStopPercentage.toFixed(0)}%`
              }}</strong>
            </div>

            <div class="time-grid">
              <label class="text-field">
                <span>Start</span>
                <input v-model="chargeStartAt" type="datetime-local" />
              </label>

              <label class="text-field">
                <span>Stop</span>
                <input v-model="chargeStopAt" type="datetime-local" />
              </label>
            </div>

            <div class="schedule-actions">
              <button type="button" @click="setFullChargeWindow">
                Full charge
              </button>
            </div>
          </section>

          <div class="preset-row segmented-row" aria-label="Charger presets">
            <button
              v-for="preset in chargerPresets"
              :key="preset.label"
              type="button"
              :class="{ selected: chargerOutputKw === preset.value }"
              @click="setChargerPreset(preset.value)"
            >
              {{ preset.label }}
            </button>
          </div>

          <SliderControl
            id="charger"
            v-model="chargerOutputKw"
            label="Charger output"
            :min="1.4"
            :max="22"
            :step="0.1"
            unit="kW"
            hint="Set the usable AC charging power."
          />

          <SliderControl
            id="current"
            v-model="currentPercentage"
            label="Current battery"
            :min="0"
            :max="100"
            :step="1"
            unit="%"
          />

          <SliderControl
            id="target"
            v-model="targetPercentage"
            label="Target battery"
            :min="calculator.normalized.value.currentPercentage"
            :max="100"
            :step="1"
            unit="%"
          />

          <div class="capacity-area">
            <div class="control-heading">
              <div>
                <label for="capacity">Battery capacity</label>
                <p>Use a preset or enter a usable pack estimate.</p>
              </div>
              <strong>{{ batteryCapacityKwh.toFixed(1) }}kWh</strong>
            </div>

            <div
              class="preset-row battery-presets tile-row"
              aria-label="Tesla battery presets"
            >
              <button
                v-for="preset in batteryPresets"
                :key="preset.label"
                type="button"
                :class="{ selected: batteryCapacityKwh === preset.value }"
                @click="setBatteryPreset(preset.value)"
              >
                {{ preset.label }}
              </button>
            </div>

            <input
              id="capacity"
              v-model.number="batteryCapacityKwh"
              class="number-input"
              type="number"
              min="1"
              step="0.1"
              inputmode="decimal"
            />
          </div>

          <details
            class="advanced"
            :open="advancedOpen"
            @toggle="advancedOpen = $event.target.open"
          >
            <summary>Advanced</summary>
            <SliderControl
              id="efficiency"
              v-model="chargingEfficiency"
              label="Charging efficiency"
              :min="60"
              :max="100"
              :step="1"
              unit="%"
              hint="Accounts for energy lost between the grid and the battery."
            />
          </details>
        </div>

        <aside class="results-stack">
          <section class="panel results-panel" aria-labelledby="results-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Results</p>
                <h2 id="results-title">Charge estimate</h2>
              </div>
            </div>

            <div class="result-grid">
              <ResultCard
                label="Battery energy"
                :value="formatKwh(scheduledBatteryEnergy)"
                :detail="
                  reachesTargetInWindow
                    ? `${calculator.batteryPercentageNeeded.value.toFixed(0)}% added to the pack`
                    : 'Delivered in selected window'
                "
              />
              <ResultCard
                label="Grid energy"
                :value="formatKwh(scheduledGridEnergyRequired)"
                :detail="`${calculator.normalized.value.chargingEfficiency.toFixed(0)}% efficiency`"
              />
              <ResultCard
                label="Charge window"
                :value="formatDuration(effectiveChargeHours)"
                :detail="`Full target needs ${calculator.chargeDurationLabel.value}`"
              />
              <ResultCard
                label="Estimated cost"
                :value="formatCurrency(pricing.totalCost)"
                :detail="
                  pricing.source === 'live'
                    ? scheduleCostDetail
                    : 'Using manual fallback rate'
                "
              />
            </div>

            <div class="summary-strip">
              <span
                >{{ calculator.chargeSummary.value }}
                {{ scheduleCostDetail }}.</span
              >
              <strong>{{ formatPence(pricing.averageRatePence) }}</strong>
            </div>
          </section>

          <section
            v-if="pricing.breakdown"
            class="panel breakdown-panel"
            aria-labelledby="breakdown-title"
          >
            <div class="section-heading compact">
              <div>
                <p class="eyebrow">Breakdown</p>
                <h2 id="breakdown-title">Rate windows</h2>
              </div>
            </div>
            <div class="breakdown-grid">
              <ResultCard
                label="Cheapest"
                :value="formatPence(pricing.breakdown.cheapest.valueIncVat)"
                :detail="
                  pricing.breakdown.cheapest.validFrom.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                "
              />
              <ResultCard
                label="Most expensive"
                :value="
                  formatPence(pricing.breakdown.mostExpensive.valueIncVat)
                "
                :detail="
                  pricing.breakdown.mostExpensive.validFrom.toLocaleTimeString(
                    [],
                    { hour: '2-digit', minute: '2-digit' },
                  )
                "
              />
            </div>
          </section>

          <TariffSettings
            :products="tariff.products.value"
            :tariff-options="tariff.tariffOptions.value"
            :product-code="tariff.productCode.value"
            :selected-region-code="tariff.selectedRegionCode.value"
            :selected-product="tariff.selectedProduct.value"
            :selected-tariff-option="tariff.selectedTariffOption.value"
            v-model:manual-rate-pence="tariff.manualRatePence.value"
            :is-loading="tariff.isLoading.value"
            :is-catalog-loading="tariff.isCatalogLoading.value"
            :is-tariff-options-loading="tariff.isTariffOptionsLoading.value"
            :error-message="tariff.errorMessage.value"
            :catalog-error-message="tariff.catalogErrorMessage.value"
            :has-live-rates="tariff.hasLiveRates.value"
            :last-fetched-at="tariff.lastFetchedAt.value"
            :rate-count="tariff.rates.value.length"
            @select-product="tariff.selectProduct"
            @select-region="tariff.selectRegion"
            @reload-products="tariff.loadProducts"
            @fetch="fetchTariffRates"
          />
        </aside>
      </section>

      <footer class="disclaimer">
        Hypervolt provides estimates only. Actual charging speed and cost can
        vary with charger limits, battery temperature, state of charge, tariff
        availability, and vehicle behaviour.
      </footer>
    </section>
  </main>
</template>
