import { computed, ref } from 'vue'
import {
  estimateCostFromRates,
  fetchProductTariffOptions,
  fetchProducts,
  fetchStandardUnitRates,
} from '../services/octopusTariffService'

export function useOctopusTariff() {
  const productCode = ref('')
  const tariffCode = ref('')
  const selectedRegionCode = ref('')
  const manualRatePence = ref(30)
  const products = ref([])
  const tariffOptions = ref([])
  const rates = ref([])
  const isLoading = ref(false)
  const isCatalogLoading = ref(false)
  const isTariffOptionsLoading = ref(false)
  const errorMessage = ref('')
  const catalogErrorMessage = ref('')
  const lastFetchedAt = ref(null)

  const hasLiveRates = computed(() => rates.value.length > 0)
  const modeLabel = computed(() => (hasLiveRates.value ? 'Live tariff mode' : 'Manual rate mode'))
  const selectedProduct = computed(() =>
    products.value.find((product) => product.code === productCode.value),
  )
  const selectedTariffOption = computed(() =>
    tariffOptions.value.find((option) => option.regionCode === selectedRegionCode.value),
  )

  const syncSelectedTariffCode = () => {
    tariffCode.value = selectedTariffOption.value?.tariffCode || ''
  }

  const loadProducts = async () => {
    isCatalogLoading.value = true
    catalogErrorMessage.value = ''

    try {
      products.value = await fetchProducts()
    } catch (error) {
      products.value = []
      catalogErrorMessage.value = error.message || 'Unable to load Octopus tariff options.'
    } finally {
      isCatalogLoading.value = false
    }
  }

  const loadTariffOptions = async () => {
    const previousRegionCode = selectedRegionCode.value
    const previousTariffCode = tariffCode.value

    tariffOptions.value = []
    rates.value = []
    tariffCode.value = ''

    if (!productCode.value) {
      selectedRegionCode.value = ''
      return
    }

    isTariffOptionsLoading.value = true
    catalogErrorMessage.value = ''

    try {
      const options = await fetchProductTariffOptions(productCode.value)
      tariffOptions.value = options

      const matchingStoredRegion = options.find(
        (option) => option.regionCode === previousRegionCode,
      )
      const matchingStoredTariff = options.find((option) => option.tariffCode === previousTariffCode)
      const nextSelection = matchingStoredRegion || matchingStoredTariff || options[0]

      selectedRegionCode.value = nextSelection?.regionCode || ''
      tariffCode.value = nextSelection?.tariffCode || ''
    } catch (error) {
      selectedRegionCode.value = ''
      catalogErrorMessage.value = error.message || 'Unable to load regions for that tariff.'
    } finally {
      isTariffOptionsLoading.value = false
    }
  }

  const selectProduct = async (code) => {
    productCode.value = code
    await loadTariffOptions()
  }

  const selectRegion = (regionCode) => {
    selectedRegionCode.value = regionCode
    syncSelectedTariffCode()
  }

  const fetchRates = async ({ durationHours = 8, periodFrom = new Date(), periodTo = null } = {}) => {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const from = periodFrom
      const to = periodTo || new Date(from.getTime() + Math.max(durationHours, 8) * 60 * 60 * 1000)

      rates.value = await fetchStandardUnitRates({
        productCode: productCode.value,
        tariffCode: tariffCode.value,
        periodFrom: from,
        periodTo: to,
      })
      lastFetchedAt.value = new Date()
    } catch (error) {
      rates.value = []
      errorMessage.value = error.message || 'Unable to fetch Octopus tariff data.'
    } finally {
      isLoading.value = false
    }
  }

  const estimateCost = ({
    gridEnergyRequired,
    chargeDurationHours,
    chargerOutputKw,
    startDate = new Date(),
  }) => {
    const manualCost = gridEnergyRequired * (Number(manualRatePence.value || 0) / 100)

    if (!hasLiveRates.value) {
      return {
        source: 'manual',
        totalCost: manualCost,
        averageRatePence: Number(manualRatePence.value || 0),
        breakdown: null,
      }
    }

    const liveBreakdown = estimateCostFromRates({
      rates: rates.value,
      startDate,
      durationHours: chargeDurationHours,
      chargerOutputKw,
    })

    if (!liveBreakdown) {
      return {
        source: 'manual',
        totalCost: manualCost,
        averageRatePence: Number(manualRatePence.value || 0),
        breakdown: null,
      }
    }

    return {
      source: 'live',
      totalCost: liveBreakdown.totalCost,
      averageRatePence: liveBreakdown.averageRatePence,
      breakdown: liveBreakdown,
    }
  }

  return {
    productCode,
    tariffCode,
    selectedRegionCode,
    manualRatePence,
    products,
    tariffOptions,
    rates,
    isLoading,
    isCatalogLoading,
    isTariffOptionsLoading,
    errorMessage,
    catalogErrorMessage,
    lastFetchedAt,
    hasLiveRates,
    modeLabel,
    selectedProduct,
    selectedTariffOption,
    loadProducts,
    loadTariffOptions,
    selectProduct,
    selectRegion,
    fetchRates,
    estimateCost,
  }
}
