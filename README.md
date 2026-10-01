# Hypervolt

Hypervolt is a lightweight Vue 3 EV charging calculator for UK Tesla owners using Octopus Energy tariffs. It is designed to work perfectly with a manual p/kWh rate first, then optionally enhance the estimate with public Octopus half-hourly tariff data.

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## How The Calculator Works

The app estimates the energy needed to move from the current battery percentage to the target percentage:

```text
battery energy required = battery capacity kWh * ((target - current) / 100)
grid energy required = battery energy required / (charging efficiency / 100)
charge duration hours = grid energy required / charger output kW
```

Charging efficiency defaults to 90% and can be changed in the Advanced section. Results are estimates, not billing-grade values.

## Manual Pricing

Manual tariff input is the default pricing mode. Enter a fallback unit rate in p/kWh and Hypervolt calculates:

```text
estimated cost = grid energy required * (manual p/kWh / 100)
```

This path works without network access or Octopus tariff codes.

## Scheduled Charging

Use the charge window controls to pick an estimated start and stop time. Hypervolt prices the energy that can be delivered inside that window:

- If the window is long enough to reach the target percentage, the estimate covers the full target charge.
- If the window is shorter, the estimate covers the partial charge delivered before the stop time and shows the approximate battery percentage reached.
- To compare the same charging duration at different times of day, set the start and stop pickers to the window you want to test.
- The `Full charge` shortcut sets the stop time from the selected start time using the calculated charging duration.

## Design System

The interface uses a Tesla UI-kit-inspired console system: matte surfaces, 7px radii, segmented controls, thin neutral borders, blue active actions, muted grey labels, and compact semi-bold UI typography. A persistent header toggle switches between dark and light console modes. It avoids Tesla logos or proprietary assets while matching the quiet in-car settings feel.

## Octopus Tariffs

Hypervolt loads current Octopus import tariffs from the public products endpoint, then lets you choose:

- Your Octopus tariff by display name, such as Agile Octopus, Octopus Go, Intelligent Octopus Go, Flexible Octopus, or Cosy Octopus
- Your electricity supply region
- Manual fallback rate in p/kWh

Behind the scenes, Hypervolt resolves the selected tariff and region to the correct Octopus product and electricity tariff codes, then calls:

```text
/products/
/products/{productCode}/
/products/{productCode}/electricity-tariffs/{tariffCode}/standard-unit-rates/
```

It sends `period_from` and `period_to`, then reads `value_inc_vat`, `valid_from`, and `valid_to` from the returned rates. If the catalogue or rate call fails, the app keeps using the manual fallback rate.

For half-hourly data, Hypervolt assumes charging starts now, allocates charger output across each tariff window, and sums the cost for the overlapping periods.

## Assumptions

- Tesla battery capacities are usable pack estimates and can be overridden manually.
- Charging speed can vary with charger limits, vehicle behaviour, battery temperature, and state of charge.
- Tariff data depends on the product and tariff code entered.
- A backend is not included because the Octopus public tariff endpoint can be called directly from the browser where CORS permits it.
