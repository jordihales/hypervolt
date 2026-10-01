const OCTOPUS_BASE_URL = 'https://api.octopus.energy/v1'

const REGION_LABELS = {
  _A: 'Eastern England',
  _B: 'East Midlands',
  _C: 'London',
  _D: 'Merseyside and North Wales',
  _E: 'West Midlands',
  _F: 'North Eastern England',
  _G: 'North Western England',
  _H: 'Southern England',
  _J: 'South Eastern England',
  _K: 'Southern Wales',
  _L: 'South Western England',
  _M: 'Yorkshire',
  _N: 'Southern Scotland',
  _P: 'Northern Scotland',
}

const toIso = (date) => date.toISOString()

const normalizeRate = (rate) => ({
  valueIncVat: Number(rate.value_inc_vat),
  validFrom: new Date(rate.valid_from),
  validTo: new Date(rate.valid_to),
})

const getJson = async (url, fallbackMessage = 'Octopus API request failed.') => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${fallbackMessage} Octopus returned ${response.status}.`)
  }

  return response.json()
}

const getPaymentTariff = (tariffsByPaymentMethod) =>
  tariffsByPaymentMethod?.direct_debit_monthly ||
  tariffsByPaymentMethod?.direct_debit_quarterly ||
  tariffsByPaymentMethod?.varying ||
  Object.values(tariffsByPaymentMethod || {})[0]

export async function fetchProducts() {
  const products = []
  let nextUrl = `${OCTOPUS_BASE_URL}/products/`
  let pageCount = 0

  while (nextUrl && pageCount < 10) {
    const payload = await getJson(nextUrl, 'Unable to fetch Octopus tariffs.')
    products.push(...(Array.isArray(payload.results) ? payload.results : []))
    nextUrl = payload.next
    pageCount += 1
  }

  return products
    .filter(
      (product) =>
        product.direction === 'IMPORT' &&
        product.brand === 'OCTOPUS_ENERGY' &&
        !product.is_business &&
        !product.is_prepay &&
        !product.available_to,
    )
    .map((product) => ({
      code: product.code,
      displayName: product.display_name || product.full_name || product.code,
      fullName: product.full_name || product.display_name || product.code,
      description: product.description || '',
      isVariable: Boolean(product.is_variable),
      isRestricted: Boolean(product.is_restricted),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function fetchProductTariffOptions(productCode) {
  if (!productCode) {
    return []
  }

  const payload = await getJson(
    `${OCTOPUS_BASE_URL}/products/${encodeURIComponent(productCode)}/`,
    'Unable to fetch regional tariff options.',
  )
  const tariffGroups = [
    payload.single_register_electricity_tariffs,
    payload.dual_register_electricity_tariffs,
    payload.four_rate_ev_electricity_tariffs,
  ].filter(Boolean)
  const options = []

  tariffGroups.forEach((group) => {
    Object.entries(group).forEach(([regionCode, tariffsByPayment]) => {
      const tariff = getPaymentTariff(tariffsByPayment)

      if (!tariff?.code) {
        return
      }

      options.push({
        regionCode,
        regionName: REGION_LABELS[regionCode] || regionCode.replace(/^_/, 'Region '),
        tariffCode: tariff.code,
        unitRatePence: Number(tariff.standard_unit_rate_inc_vat),
        standingChargePence: Number(tariff.standing_charge_inc_vat),
      })
    })
  })

  return options.sort((a, b) => a.regionName.localeCompare(b.regionName))
}

export async function fetchStandardUnitRates({
  productCode,
  tariffCode,
  periodFrom,
  periodTo,
}) {
  if (!productCode || !tariffCode) {
    throw new Error('Enter both an Octopus product code and electricity tariff code.')
  }

  const url = new URL(
    `${OCTOPUS_BASE_URL}/products/${encodeURIComponent(productCode)}/electricity-tariffs/${encodeURIComponent(tariffCode)}/standard-unit-rates/`,
  )

  if (periodFrom) {
    url.searchParams.set('period_from', toIso(periodFrom))
  }

  if (periodTo) {
    url.searchParams.set('period_to', toIso(periodTo))
  }

  const results = []
  let nextUrl = url.toString()
  let pageCount = 0

  while (nextUrl && pageCount < 10) {
    const payload = await getJson(nextUrl, 'Check the selected Octopus tariff.')
    results.push(...(Array.isArray(payload.results) ? payload.results : []))
    nextUrl = payload.next
    pageCount += 1
  }

  const rates = results
    .map(normalizeRate)
    .filter(
      (rate) =>
        Number.isFinite(rate.valueIncVat) &&
        !Number.isNaN(rate.validFrom.getTime()) &&
        !Number.isNaN(rate.validTo.getTime()),
    )
    .sort((a, b) => a.validFrom - b.validFrom)

  if (rates.length === 0) {
    throw new Error('No unit rates were returned for that period.')
  }

  return rates
}

export function estimateCostFromRates({ rates, startDate, durationHours, chargerOutputKw }) {
  if (!rates?.length || durationHours <= 0 || chargerOutputKw <= 0) {
    return null
  }

  const start = startDate.getTime()
  const end = start + durationHours * 60 * 60 * 1000
  const rows = []
  let totalCost = 0
  let totalEnergy = 0

  rates.forEach((rate) => {
    const periodStart = Math.max(rate.validFrom.getTime(), start)
    const periodEnd = Math.min(rate.validTo.getTime(), end)

    if (periodEnd <= periodStart) {
      return
    }

    const hours = (periodEnd - periodStart) / (60 * 60 * 1000)
    const energyKwh = hours * chargerOutputKw
    const cost = energyKwh * (rate.valueIncVat / 100)

    rows.push({
      ...rate,
      overlapHours: hours,
      energyKwh,
      cost,
    })

    totalCost += cost
    totalEnergy += energyKwh
  })

  const expectedEnergy = durationHours * chargerOutputKw

  if (totalEnergy < expectedEnergy - 0.01) {
    return null
  }

  const sortedByRate = [...rows].sort((a, b) => a.valueIncVat - b.valueIncVat)

  return {
    totalCost,
    totalEnergy,
    averageRatePence: (totalCost / totalEnergy) * 100,
    rows,
    cheapest: sortedByRate[0],
    mostExpensive: sortedByRate[sortedByRate.length - 1],
  }
}
