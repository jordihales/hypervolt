import { computed } from 'vue'

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max)

const formatDuration = (hoursValue) => {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
    return '0 min'
  }

  const totalMinutes = Math.round(hoursValue * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'}`
  }

  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`
}

export function useChargeCalculator(inputs) {
  const normalized = computed(() => {
    const currentPercentage = clamp(inputs.currentPercentage.value, 0, 100)
    const targetPercentage = clamp(inputs.targetPercentage.value, currentPercentage, 100)
    const chargerOutputKw = Math.max(Number(inputs.chargerOutputKw.value) || 0, 0.1)
    const batteryCapacityKwh = Math.max(Number(inputs.batteryCapacityKwh.value) || 0, 0.1)
    const chargingEfficiency = clamp(inputs.chargingEfficiency.value, 1, 100)

    return {
      currentPercentage,
      targetPercentage,
      chargerOutputKw,
      batteryCapacityKwh,
      chargingEfficiency,
    }
  })

  const batteryPercentageNeeded = computed(
    () => normalized.value.targetPercentage - normalized.value.currentPercentage,
  )

  const batteryEnergyRequired = computed(
    () => normalized.value.batteryCapacityKwh * (batteryPercentageNeeded.value / 100),
  )

  const gridEnergyRequired = computed(
    () => batteryEnergyRequired.value / (normalized.value.chargingEfficiency / 100),
  )

  const chargeDurationHours = computed(
    () => gridEnergyRequired.value / normalized.value.chargerOutputKw,
  )

  const chargeDurationLabel = computed(() => formatDuration(chargeDurationHours.value))

  const chargeSummary = computed(
    () =>
      `Charging from ${normalized.value.currentPercentage.toFixed(0)}% to ${normalized.value.targetPercentage.toFixed(0)}% using a ${normalized.value.chargerOutputKw.toFixed(1)}kW charger.`,
  )

  return {
    normalized,
    batteryPercentageNeeded,
    batteryEnergyRequired,
    gridEnergyRequired,
    chargeDurationHours,
    chargeDurationLabel,
    chargeSummary,
  }
}
