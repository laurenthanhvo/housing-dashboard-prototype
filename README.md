# State of Housing in San Diego Dashboard Prototype

This version is a Power BI-inspired static dashboard: a filter panel on the left, a report-style canvas in the main area, KPI cards across the top, a large map visual, ranking/trend charts, and clear caveats near the visuals.

It is still built with plain HTML/CSS/JavaScript, Leaflet, and D3, so it can run locally without a backend.

## How to use

1. Copy these files into the root of your housing dashboard repo:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `datasets.html`
   - `about.html`
   - `contact.html`
   - `static-pages.css`

2. Make sure your processed data files are in `data/processed/`, matching the paths in `app.js`.

3. Start a local server from the repo root:

```bash
python3 -m http.server 8000
```

4. Open:

```text
http://localhost:8000/index.html
```

Do not open the HTML file directly from Finder, because browser security rules may block local CSV/GeoJSON loading.

## Dashboard structure

- Left filter panel: metric, reporting year, jurisdiction search, selected-area KPIs, map layers, caveat note
- Main report canvas: county snapshot KPIs, map, selected-jurisdiction profile, supply trend, ranking chart, RHNA progress, need/context indicators, and file status
- Static pages: Data & Methods, About, and Contact

## Main data files the app tries to load

- `data/processed/sd_tiger_places.geojson`
- `data/processed/sd_municipal_boundaries.geojson`
- `data/raw/Municipal_Boundaries.geojson`
- `data/processed/sd_kpi_latest_city.csv`
- `data/processed/sd_city_kpis_latest.csv`
- `data/processed/sd_kpi_city_scorecard.csv`
- `data/processed/sd_rhna6_city_totals.csv`
- `data/processed/sd_rhna6_filtered.csv`
- `data/processed/sd_apr_a2_city_year_supply.csv`
- `data/processed/sd_permits_housing_like_units_by_year.csv`
- `data/processed/sd_acs_place_2023_summary_fixed.csv`
- `data/processed/sd_dof_e5_city_year.csv`

If one file is missing, the dashboard still loads and shows a warning in the Data & Maintenance section.
