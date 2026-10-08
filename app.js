/*
  State of Housing in San Diego dashboard prototype
  -------------------------------------------------
  Drop these files into the repo root so relative paths like
  data/processed/sd_rhna6_city_totals.csv resolve correctly.
*/

const PATHS = {
  boundaries: [
    './data/processed/municipal_boundaries_with_rhna6.geojson',
    './data/processed/sd_municipal_boundaries_with_rhna6.geojson',
    './data/processed/sd_tiger_places.geojson',
    './data/processed/sd_municipal_boundaries.geojson',
    './data/raw/Municipal_Boundaries.geojson',
  ],
  countyBoundary: [
    './data/processed/sd_county_boundary.geojson',
    './data/raw/San_Diego_County_Boundary.geojson',
  ],
  zoningBase: [
    './data/raw/sandag/Zoning_Base_SD.geojson',
    './data/raw/sandag/zoning_base_sd.geojson',
  ],
  zoningUnincorporated: [
    './data/raw/sandag/Zoning_Unincorporated.geojson',
    './data/raw/sandag/zoning_unincorporated.geojson',
  ],
  ws1Long: [
    './data/processed/powerbi_rhna_production_2018_2025_long.csv',
  ],
  productionType: [
    './data/processed/powerbi_production_by_housing_type_2018_2025.csv',
  ],
  dof: [
    './data/processed/powerbi_dof_annual_housing_stock_2020_2025.csv',
  ],
  benchmarks: [
    './data/processed/powerbi_housing_stock_benchmarks_2000_2010_2021_2024.csv',
  ],
  affordability: [
    './data/processed/housing_need_affordability_acs2024_hud2026.csv',
    './data/processed/acs_2024_housing_need_affordability_by_jurisdiction.csv',
  ],
  nhpdSummary: [
    './data/processed/nhpd_san_diego_by_jurisdiction.csv',
  ],
  nhpdRisk: [
    './data/processed/nhpd_san_diego_subsidy_expiration_risk.csv',
  ],
};

const CITY_FIELDS = [
  'jur_clean', 'jur_norm', '_jur_raw', 'jurisdiction_clean', 'jurisdiction_name',
  'jurisdiction', 'Jurisdiction', 'JURISDICTION', 'JURIS_NAME', 'JURISDICTION_NAME',
  'city', 'City', 'NAME', 'Name', 'place_name', 'Place Name', 'NAME10', 'Geography', 'geography'
];

const YEAR_FIELDS = ['year', 'YEAR', 'Year', 'report_year', 'REPORT_YEAR', 'calendar_year'];

const PALETTE = [
  '#FFF4B8',  // pale yellow
  '#FFCD00',  // UCSD bright yellow
  '#C69214',  // gold
  '#00C6D7',  // turquoise
  '#00629B',  // UCSD blue
  '#182B49',  // navy
];

const NO_DATA_FILL = '#EEF2F5';

const METRICS = {
  rhna_progress: {
    label: 'RHNA progress',
    unit: '%',
    decimals: 0,
    description: 'Cumulative 6th Cycle qualifying building permits as a share of the RHNA allocation.',
    caveat: 'RHNA progress is cumulative and is not the same as annual APR production.',
    getter: stats => stats.rhnaPct,
  },
  permitted_units: {
    label: 'Permitted units',
    unit: 'units',
    decimals: 0,
    description: 'Building permits reported in HCD APR Table A2 for the selected reporting year.',
    caveat: 'Annual building permits are separate from cumulative RHNA progress.',
    getter: stats => stats.permitted,
  },
  completed_units: {
    label: 'Completed units',
    unit: 'units',
    decimals: 0,
    description: 'Completed / certificate-of-occupancy units reported in HCD APR Table A2.',
    caveat: 'Recent-year completion data may be revised as jurisdictions update APR filings.',
    getter: stats => stats.completed,
  },
  entitlement_units: {
    label: 'Entitled units',
    unit: 'units',
    decimals: 0,
    description: 'Units with entitlement or planning approval reported for the selected year.',
    caveat: 'Entitlements are not permits and are not counted as completed units.',
    getter: stats => stats.approved,
  },
  application_units: {
    label: 'Applications submitted',
    unit: 'units',
    decimals: 0,
    description: 'Application units reported in HCD APR Table A for the selected year.',
    caveat: 'Applications are an early pipeline stage and are not combined with later development stages.',
    getter: stats => stats.proposed,
  },
  permits_per_1k: {
    label: 'Permits per 1,000 residents',
    unit: 'per 1k',
    decimals: 1,
    description: 'Annual building permits normalized by population.',
    caveat: 'Population is taken from the validated housing-stock / ACS context available for the jurisdiction.',
    getter: stats => ratio(stats.permitted, stats.population) * 1000,
  },
  housing_per_1k: {
    label: 'Housing units per 1,000 residents',
    unit: 'per 1k',
    decimals: 1,
    description: 'Existing housing stock normalized by population.',
    caveat: 'This is a housing-stock measure, not annual production.',
    getter: stats => ratio(stats.housingUnits, stats.population) * 1000,
  },
  median_rent: {
    label: '1BR median gross rent',
    unit: '$',
    decimals: 0,
    description: 'Median gross rent for a one-bedroom unit from the 2020–2024 ACS 5-year estimate.',
    caveat: 'ACS estimates have sampling uncertainty and should not be treated as exact market asking rents.',
    getter: stats => stats.medianRent,
  },
  rent_to_income: {
    label: '1BR rent-to-income benchmark',
    unit: '%',
    decimals: 1,
    description: 'Annual one-bedroom median gross rent divided by median household income.',
    caveat: 'This is a benchmark ratio, not an observed renter cost-burden rate.',
    getter: stats => stats.rentToIncomePct,
  },
  rent_burden: {
    label: 'Rent-burdened renter households',
    unit: '%',
    decimals: 1,
    description: 'Share of renter households spending more than 30% of household income on housing costs.',
    caveat: 'Based on ACS 5-year estimates.',
    getter: stats => stats.rentBurdenShare,
  },
  median_home_value: {
    label: 'Median home value',
    unit: '$',
    decimals: 0,
    description: 'ACS median home value where available.',
    caveat: 'Home value is not the same as a home sale price.',
    getter: stats => stats.medianHomeValue,
  },
  income_ratio: {
    label: 'Income vs. county median',
    unit: '%',
    decimals: 1,
    description: 'Jurisdiction median household income as a percent of San Diego County median household income.',
    caveat: 'Uses the same ACS median household income definition in numerator and denominator.',
    getter: stats => stats.incomeRatioPct,
  },
  assisted_units: {
    label: 'Estimated federally assisted units',
    unit: 'units',
    decimals: 0,
    description: 'Validated conservative NHPD estimate of federally assisted units by jurisdiction.',
    caveat: 'Property-level subsidies can overlap; the dashboard uses the validated conservative estimate.',
    getter: stats => stats.assistedUnits,
  },
};

const state = {
  geojson: null,
  zoningBaseGeojson: null,
  zoningUnincorporatedGeojson: null,
  zoningBaseLayer: null,
  zoningUnincorporatedLayer: null,
  showZoningBase: false,
  showZoningUnincorporated: false,
  countyGeojson: null,
  boundaryLayer: null,
  countyLayer: null,
  permitPointLayer: null,
  dataMaps: {},
  allKeys: new Set(),
  selectedKey: null,
  selectedYear: null,
  metric: 'rhna_progress',
  showChoro: true,
  showOutlines: true,
  showPermitPoints: false,
  loadedFiles: [],
  missingFiles: [],
  bins: [],
  valuesByKey: new Map(),
  hasFit: false,
};

const $ = id => document.getElementById(id);
const isNum = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const toNum = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') v = v.replace(/[$,%]/g, '').trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function cleanKey(v) {
  if (v === null || v === undefined) return '';
  let s = String(v).trim().toLowerCase();
  s = s.replace(/^city\s+of\s+/, '');
  s = s.replace(/^county\s+of\s+/, 'county ');
  s = s.replace(/\s+city$/, '');
  s = s.replace(/\s+county$/, ' county');
  s = s.replace(/unincorporated\s+(area\s+)?of\s+san\s+diego\s+county/, 'unincorporated');
  s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.includes('san diego region')) return 'county san diego';
  if (s === 'unincorporated san diego county') return 'unincorporated';
  if (s.includes('san diego county') && s.includes('countywide')) return 'county san diego';
  if (s === 's d county' || s === 'sd county' || s === 'san diego county' || s === 'county san diego') return 'county san diego';
  return s;
}

function titleCase(s) {
  if (!s) return 'San Diego County';
  return String(s)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => ['of', 'and', 'the'].includes(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bCa\b/g, 'CA')
    .replace(/\bUsa\b/g, 'USA');
}

function firstValue(row, fields) {
  if (!row) return null;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(row, f) && row[f] !== null && row[f] !== undefined && String(row[f]).trim() !== '') return row[f];
  }
  return null;
}

function fmtMetric(v) {
  if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) {
    return "No data";
  }

  return Number(v).toLocaleString();
}

function numFrom(row, candidates) {
  if (!row) return null;

  for (const col of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, col)) {
      const raw = row[col];

      if (raw === null || raw === undefined || raw === "") {
        continue;
      }

      const cleaned = String(raw).replace(/,/g, "").trim();
      const n = Number(cleaned);

      if (Number.isFinite(n)) {
        return n;
      }
    }
  }

  return null;
}

function includesAll(name, words) {
  const lower = name.toLowerCase();
  return words.every(w => lower.includes(w));
}

function sumMatching(row, predicate) {
  if (!row) return null;
  let total = 0;
  let found = false;
  Object.entries(row).forEach(([k, v]) => {
    if (predicate(k)) {
      const n = toNum(v);
      if (n !== null) {
        total += n;
        found = true;
      }
    }
  });
  return found ? total : null;
}

function pct(num, den) {
  if (!isNum(num) || !isNum(den) || Number(den) === 0) return null;
  return (Number(num) / Number(den)) * 100;
}
function ratio(num, den) {
  if (!isNum(num) || !isNum(den) || Number(den) === 0) return null;
  return Number(num) / Number(den);
}
function safeAdd(...vals) {
  const nums = vals.filter(isNum).map(Number);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}
function maxNonNull(...vals) {
  const nums = vals.filter(isNum).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

async function loadFirst(kind, candidates, parser = 'csv') {
  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = parser === 'json' ? await res.json() : await d3.csv(path, d3.autoType);
      state.loadedFiles.push({ kind, path, rows: Array.isArray(data) ? data.length : data?.features?.length ?? 1 });
      return data;
    } catch (err) {
      // Try the next candidate. Record only the final failure below.
    }
  }
  state.missingFiles.push({ kind, paths: candidates });
  return parser === 'json' ? null : [];
}

function detectCity(row) {
  return firstValue(row, CITY_FIELDS);
}
function detectYear(row) {
  return numFrom(row, YEAR_FIELDS);
}
function featureName(feature) {
  const p = feature?.properties || {};
  return firstValue(p, CITY_FIELDS) || p.name || p.NAME || 'Unknown area';
}

function cityMapFromRows(rows, reducer) {
  const map = new Map();
  rows.forEach(row => {
    const rawName = detectCity(row);
    const key = cleanKey(rawName);
    if (!key) return;
    state.allKeys.add(key);
    const label = String(rawName || titleCase(key));
    if (!map.has(key)) map.set(key, { key, label, rows: [] });
    map.get(key).rows.push(row);
  });
  if (reducer) {
    const reduced = new Map();
    map.forEach((entry, key) => reduced.set(key, reducer(entry.rows, entry.label, key)));
    return reduced;
  }
  return map;
}

function reduceRhna(rows, label, key) {
  const latest = rows[rows.length - 1] || {};
  const vliUnits = maxNonNull(numFrom(latest, ['VLI UNITS', 'vli_units', 'VLI_UNITS']), sumMatching(latest, k => includesAll(k, ['vli']) && includesAll(k, ['unit']) && !includesAll(k, ['rhna'])));
  const liUnits = maxNonNull(numFrom(latest, ['LI UNITS', 'li_units', 'LI_UNITS']), sumMatching(latest, k => /^li\b/i.test(k.replace(/[_-]/g, ' ')) && k.toLowerCase().includes('unit') && !k.toLowerCase().includes('rhna')));
  const modUnits = maxNonNull(numFrom(latest, ['MOD UNITS', 'mod_units', 'MOD_UNITS']), sumMatching(latest, k => includesAll(k, ['mod']) && includesAll(k, ['unit']) && !includesAll(k, ['rhna'])));
  const aboveUnits = maxNonNull(numFrom(latest, ['ABOVE MOD UNITS', 'above_mod_units', 'ABOVE_MOD_UNITS']), sumMatching(latest, k => includesAll(k, ['above']) && includesAll(k, ['unit']) && !includesAll(k, ['rhna'])));

  const vliTarget = maxNonNull(numFrom(latest, ['RHNA VLI', 'rhna_vli', 'RHNA_VLI']), sumMatching(latest, k => includesAll(k, ['rhna', 'vli'])));
  const liTarget = maxNonNull(numFrom(latest, ['RHNA LI', 'rhna_li', 'RHNA_LI']), sumMatching(latest, k => /^rhna[ _-]?li$/i.test(k)));
  const modTarget = maxNonNull(numFrom(latest, ['RHNA MOD', 'rhna_mod', 'RHNA_MOD']), sumMatching(latest, k => includesAll(k, ['rhna', 'mod']) && !includesAll(k, ['above'])));
  const aboveTarget = maxNonNull(numFrom(latest, ['RHNA ABOVE MOD', 'rhna_above_mod', 'RHNA_ABOVE_MOD']), sumMatching(latest, k => includesAll(k, ['rhna', 'above'])));

  const units = safeAdd(vliUnits, liUnits, modUnits, aboveUnits) ?? numFrom(latest, ['total_units', 'units', 'RHNA_UNITS']);
  const target = safeAdd(vliTarget, liTarget, modTarget, aboveTarget) ?? numFrom(latest, ['rhna_total', 'target', 'total_target']);
  return { key, label, units, target, tiers: { vliUnits, liUnits, modUnits, aboveUnits, vliTarget, liTarget, modTarget, aboveTarget }, raw: latest };
}

function reduceAcs(rows, label, key) {
  const latest = rows[rows.length - 1] || {};
  return {
    key,
    label,
    acsYear: numFrom(latest, ['acs_year', 'year']),
    acsPeriod: firstValue(latest, ['acs_period']) || '2020–2024 ACS 5-year',
    population: numFrom(latest, ['population', 'population_total', 'total_population', 'B01003_001E']),
    medianHouseholdIncome: numFrom(latest, ['median_household_income']),
    countyMedianHouseholdIncome: numFrom(latest, ['county_median_household_income']),
    incomeRatio: numFrom(latest, ['jurisdiction_county_income_ratio']),
    incomeRatioPct: numFrom(latest, ['jurisdiction_county_income_pct']),
    renterHouseholds: numFrom(latest, ['renter_households_computed', 'renter_households_total']),
    renterBurdenedCount: numFrom(latest, ['renter_cost_burdened_count']),
    renterSevereCount: numFrom(latest, ['renter_severely_burdened_count']),
    rentBurdenShare: numFrom(latest, ['renter_cost_burdened_pct']),
    rentSevereShare: numFrom(latest, ['renter_severely_burdened_pct']),
    ownerHouseholds: numFrom(latest, ['owner_households_computed']),
    ownerBurdenedCount: numFrom(latest, ['owner_cost_burdened_count']),
    ownerSevereCount: numFrom(latest, ['owner_severely_burdened_count']),
    ownerBurdenShare: numFrom(latest, ['owner_cost_burdened_pct']),
    ownerSevereShare: numFrom(latest, ['owner_severely_burdened_pct']),
    ownerWithMortgageBurdenShare: numFrom(latest, ['owner_with_mortgage_burdened_pct']),
    ownerWithoutMortgageBurdenShare: numFrom(latest, ['owner_without_mortgage_burdened_pct']),
    ownerWithMortgageSevereShare: numFrom(latest, ['owner_with_mortgage_severely_burdened_pct']),
    ownerWithoutMortgageSevereShare: numFrom(latest, ['owner_without_mortgage_severely_burdened_pct']),
    medianRent: numFrom(latest, ['median_gross_rent_1br', 'median_gross_rent']),
    rentToIncomePct: numFrom(latest, ['one_br_rent_to_income_pct']),
    medianOwnerCostMortgage: numFrom(latest, ['median_owner_cost_with_mortgage']),
    medianOwnerCostNoMortgage: numFrom(latest, ['median_owner_cost_without_mortgage']),
    ownerCostMortgagePct: numFrom(latest, ['owner_cost_with_mortgage_to_income_pct']),
    ownerCostNoMortgagePct: numFrom(latest, ['owner_cost_without_mortgage_to_income_pct']),
    medianOwnerCostMortgageDisplay: firstValue(latest, ['median_owner_cost_with_mortgage_display']),
    medianOwnerCostNoMortgageDisplay: firstValue(latest, ['median_owner_cost_without_mortgage_display']),
    medianHomeValue: numFrom(latest, ['median_home_value', 'B25077_001E']),
    hudFiscalYear: numFrom(latest, ['hud_fiscal_year']),
    hudMedianFamilyIncome: numFrom(latest, ['hud_four_person_median_family_income']),
    hudExtremelyLow: numFrom(latest, ['hud_four_person_extremely_low_income_limit']),
    hudVeryLow: numFrom(latest, ['hud_four_person_very_low_income_limit']),
    hudLow: numFrom(latest, ['hud_four_person_low_income_limit']),
    raw: latest,
  };
}

function reduceKpi(rows, label, key) {
  const latest = rows[rows.length - 1] || {};
  return {
    key, label,
    permitted: numFrom(latest, ['permitted_units', 'units_permitted', 'bp_units_total', 'bp_units', 'building_permit_units', 'permits_units', 'total_permitted_units']),
    completed: numFrom(latest, ['completed_units', 'co_units_total', 'co_units', 'certificate_of_occupancy_units', 'units_completed']),
    approved: numFrom(latest, ['approved_units', 'pipeline_units', 'entitled_units', 'units_approved', 'approved_total']),
    proposed: numFrom(latest, ['proposed_units', 'submitted_units', 'units_proposed', 'proposed_total']),
    affordable: numFrom(latest, ['affordable_units', 'lower_income_units', 'vli_li_mod_units', 'bp_affordable_total', 'co_affordable_total']),
    aboveModerate: numFrom(latest, ['above_moderate_units', 'above_mod_units']),
    raw: latest,
  };
}

function reduceDof(rows, label, key) {
  const byYear = new Map();

  rows.forEach(row => {
    const year = detectYear(row);
    if (!isNum(year)) return;
    const y = Number(year);
    if (!byYear.has(y)) {
      byYear.set(y, {
        year: y,
        population: null,
        housingUnits: null,
        occupiedUnits: null,
        vacantUnits: null,
        singleFamilyUnits: null,
        multifamilyUnits: null,
        mobileHomeUnits: null,
      });
    }

    const target = byYear.get(y);
    const metric = String(firstValue(row, ['metric']) || '').trim();
    const value = numFrom(row, ['value']);

    if (metric === 'total_housing_units') target.housingUnits = value;
    if (metric === 'occupied_housing_units') target.occupiedUnits = value;
    if (metric === 'vacant_housing_units') target.vacantUnits = value;
    if (metric === 'single_family_total') target.singleFamilyUnits = value;
    if (metric === 'multifamily_total') target.multifamilyUnits = value;
    if (metric === 'mobile_homes') target.mobileHomeUnits = value;
  });

  return {
    key,
    label,
    series: [...byYear.values()].sort((a, b) => a.year - b.year),
  };
}

function buildWs1Maps(rows) {
  const supply = new Map();
  const rhna = new Map();

  const ensureSupply = (key, label, year) => {
    if (!supply.has(key)) supply.set(key, []);
    let row = supply.get(key).find(d => Number(d.year) === Number(year));
    if (!row) {
      row = blankSupplyYear(key, label, Number(year));
      supply.get(key).push(row);
    }
    return row;
  };

  const ensureRhna = (key, label) => {
    if (!rhna.has(key)) {
      rhna.set(key, {
        key,
        label,
        year: null,
        allocation: null,
        progress: null,
        remaining: null,
        pct: null,
        tiers: {
          very_low: {},
          low: {},
          moderate: {},
          above_moderate: {},
        },
      });
    }
    return rhna.get(key);
  };

  rows.forEach(row => {
    const rawName = firstValue(row, ['jurisdiction', 'jur_clean']);
    let key = cleanKey(rawName);
    if (!key) return;

    const geographicLevel = String(firstValue(row, ['geographic_level']) || '').toLowerCase();
    if (geographicLevel.includes('regional')) key = 'county san diego';

    const label = key === 'county san diego'
      ? 'San Diego Region'
      : (key === 'unincorporated' ? 'Unincorporated San Diego County' : titleCase(rawName));

    state.allKeys.add(key);
    if (!state.dataMaps.labels?.has(key)) state.dataMaps.labels?.set(key, label);

    const year = detectYear(row);
    const stage = String(firstValue(row, ['development_stage']) || '').trim();
    const income = String(firstValue(row, ['income_category']) || '').trim().toLowerCase();
    const value = numFrom(row, ['value']);

    if (['Application', 'Entitlement', 'Building Permit', 'Completion'].includes(stage) && income === 'all' && isNum(year)) {
      const target = ensureSupply(key, label, Number(year));
      if (stage === 'Application') target.proposed = value;
      if (stage === 'Entitlement') target.approved = value;
      if (stage === 'Building Permit') target.permitted = value;
      if (stage === 'Completion') target.completed = value;
      target.reportingStatus = firstValue(row, ['reporting_status']);
    }

    if (stage.startsWith('RHNA')) {
      const target = ensureRhna(key, label);
      if (isNum(year)) target.year = Math.max(target.year || 0, Number(year));

      const slot = income === 'all' ? target : target.tiers[income];
      if (!slot) return;

      if (stage === 'RHNA Allocation') slot.allocation = value;
      if (stage === 'RHNA Progress (Building Permits)') slot.progress = value;
      if (stage === 'RHNA Remaining') slot.remaining = value;
      if (stage === 'RHNA Percent Complete') slot.pct = isNum(value) ? Number(value) * 100 : null;
    }
  });

  supply.forEach(arr => arr.sort((a, b) => a.year - b.year));

  rhna.forEach(r => {
    if (!isNum(r.pct) && isNum(r.progress) && isNum(r.allocation)) r.pct = pct(r.progress, r.allocation);
    Object.values(r.tiers).forEach(t => {
      if (!isNum(t.pct) && isNum(t.progress) && isNum(t.allocation)) t.pct = pct(t.progress, t.allocation);
    });
  });

  return { supply, rhna };
}

function buildProductionTypeMap(rows) {
  const map = new Map();

  rows.forEach(row => {
    const rawName = firstValue(row, ['jurisdiction', 'jur_clean']);
    let key = cleanKey(rawName);
    if (!key) return;
    if (String(firstValue(row, ['geographic_level']) || '').toLowerCase().includes('regional')) key = 'county san diego';

    const year = detectYear(row);
    const stage = String(firstValue(row, ['development_stage']) || '').trim();
    const housingType = String(firstValue(row, ['housing_type']) || '').trim();
    const value = numFrom(row, ['value']);
    if (!isNum(year) || !housingType || !['Building Permit', 'Completion'].includes(stage)) return;

    if (!map.has(key)) map.set(key, new Map());
    const byYear = map.get(key);
    if (!byYear.has(Number(year))) byYear.set(Number(year), new Map());
    const byType = byYear.get(Number(year));
    if (!byType.has(housingType)) byType.set(housingType, { housingType, permitted: null, completed: null });
    const target = byType.get(housingType);
    if (stage === 'Building Permit') target.permitted = value;
    if (stage === 'Completion') target.completed = value;
  });

  return map;
}

function buildBenchmarkMap(rows) {
  const map = new Map();
  rows.forEach(row => {
    const rawName = firstValue(row, ['jurisdiction', 'jur_clean']);
    const key = cleanKey(rawName);
    if (!key) return;
    const year = numFrom(row, ['benchmark_year']);
    const value = numFrom(row, ['housing_units_total']);
    if (!isNum(year) || !isNum(value)) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      year: Number(year),
      value: Number(value),
      label: firstValue(row, ['benchmark_label']) || String(year),
      source: firstValue(row, ['source']) || '',
    });
  });
  map.forEach(arr => arr.sort((a, b) => a.year - b.year));
  return map;
}

function reduceNhpd(rows, label, key) {
  const latest = rows[rows.length - 1] || {};
  return {
    key,
    label,
    assistedProperties: numFrom(latest, ['federally_assisted_properties']),
    assistedUnits: numFrom(latest, ['federally_assisted_units_estimated_conservative', 'total_units_in_assisted_properties']),
    totalUnitsInAssistedProperties: numFrom(latest, ['total_units_in_assisted_properties']),
    atRiskProperties: numFrom(latest, ['properties_expiring_within_5_years']),
    atRiskAssistedUnits: numFrom(latest, ['at_risk_assisted_units_estimated_conservative', 'units_in_expiring_properties']),
    unitsInExpiringProperties: numFrom(latest, ['units_in_expiring_properties']),
    raw: latest,
  };
}

function buildNhpdRiskMap(rows) {
  const map = new Map();
  rows.forEach(row => {
    const key = cleanKey(firstValue(row, ['jurisdiction']));
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      program: firstValue(row, ['program_name']) || 'Program not reported',
      expiringSubsidies: numFrom(row, ['expiring_subsidies']),
      assistedUnits: numFrom(row, ['assisted_units_with_expiring_subsidy']),
    });
  });
  return map;
}

function blankSupplyYear(key, label, year) {
  return {
    key,
    label,
    year,
    permitted: null,
    completed: null,
    approved: null,
    proposed: null,
    affordable: null,
    aboveModerate: null,
    points: [],
  };
}

function buildSupplySeries(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const name = detectCity(row) || 'San Diego';
    const key = cleanKey(name);
    const year = detectYear(row) || yearFromDate(firstValue(row, ['DATE_APPROVAL_ISSUE', 'DATE_APPROVAL_CREATE', 'BP_ISSUE_DT1', 'CO_ISSUE_DT1']));
    if (!key || !isNum(year)) return;
    state.allKeys.add(key);
    const permitted =
      numFrom(row, ['permitted_units', 'units_permitted', 'bp_units_total', 'bp_units', 'building_permit_units', 'BP_TOTAL_UNITS']) ??
      sumMatching(row, k => k.toUpperCase().startsWith('BP_') && (k.toUpperCase().includes('INCOME') || k.toUpperCase().includes('ABOVE_MOD')) && !k.toUpperCase().includes('NO_')) ??
      numFrom(row, ['APPROVAL_DU_TOTAL', 'total_units']);
    const completed =
      numFrom(row, ['completed_units', 'co_units_total', 'co_units', 'certificate_of_occupancy_units', 'CO_TOTAL_UNITS']) ??
      sumMatching(row, k => k.toUpperCase().startsWith('CO_') && (k.toUpperCase().includes('INCOME') || k.toUpperCase().includes('ABOVE_MOD')) && !k.toUpperCase().includes('NO_'));
    const approved =
      numFrom(row, ['approved_units', 'pipeline_units', 'entitled_units', 'TOT_APPROVED_UNITS']) ??
      sumMatching(row, k => k.toUpperCase().includes('APPROVED') && k.toUpperCase().includes('UNITS'));
    const proposed =
      numFrom(row, ['proposed_units', 'submitted_units', 'TOT_PROPOSED_UNITS']);
    // const adu =
    //   numFrom(row, ['adu_units', 'APPROVAL_ADU_TOTAL', 'approval_adu_total']) ??
    //   sumMatching(row, k => k.toUpperCase().includes('ADU') && !k.toUpperCase().includes('JADU') && k.toUpperCase().includes('TOTAL'));
    // const jadu =
    //   numFrom(row, ['jadu_units', 'APPROVAL_JADU_TOTAL', 'approval_jadu_total']);
    const affordable =
      numFrom(row, ['affordable_units', 'lower_income_units', 'vli_li_mod_units', 'bp_affordable_total', 'co_affordable_total']) ??
      sumMatching(row, k => /(VLOW|VERY_LOW|LOW_INCOME|MOD_INCOME|EXTREMELY_LOW|VLI|LI_|MOD_)/i.test(k) && !/ABOVE/i.test(k));
    const aboveModerate =
      numFrom(row, ['above_moderate_units', 'above_mod_units', 'BP_ABOVE_MOD_INCOME', 'ABOVE_MOD_INCOME']) ??
      sumMatching(row, k => /ABOVE[_\s-]?MOD/i.test(k));
    const lat = numFrom(row, ['LAT_JOB', 'lat', 'latitude', 'LAT']);
    const lng = numFrom(row, ['LNG_JOB', 'lng', 'lon', 'longitude', 'LON']);

    const id = `${key}|${Math.trunc(Number(year))}`;

    if (!groups.has(id)) {
      groups.set(
        id,
        blankSupplyYear(key, String(name), Math.trunc(Number(year)))
      );
    }

    const g = groups.get(id);
    addIfNum(g, 'permitted', permitted);
    addIfNum(g, 'completed', completed);
    addIfNum(g, 'approved', approved);
    addIfNum(g, 'proposed', proposed);
    // addIfNum(g, 'adu', adu);
    // addIfNum(g, 'jadu', jadu);
    addIfNum(g, 'affordable', affordable);
    addIfNum(g, 'aboveModerate', aboveModerate);
    if (isNum(lat) && isNum(lng)) {
  g.points.push({
    lat: Number(lat),
    lng: Number(lng),
    title: firstValue(row, ['PROJECT_TITLE', 'PROJECT_NAME']) || 'Permit record',
    units: permitted ?? null,
  });
}
  });

  const byCity = new Map();
  groups.forEach(g => {
    if (!byCity.has(g.key)) byCity.set(g.key, []);
    byCity.get(g.key).push(g);
  });
  byCity.forEach(arr => arr.sort((a, b) => a.year - b.year));
  return byCity;
}

function addIfNum(obj, field, val) {
  if (!isNum(val)) return;

  if (!isNum(obj[field])) {
    obj[field] = 0;
  }

  obj[field] += Number(val);
}

function yearFromDate(v) {
  if (!v) return null;
  const m = String(v).match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function rowForYear(series = [], year = state.selectedYear) {
  if (!series.length) return null;
  const exact = series.find(d => Number(d.year) === Number(year));
  if (exact) return exact;
  const before = series.filter(d => isNum(d.year) && Number(d.year) <= Number(year)).sort((a, b) => b.year - a.year)[0];
  return before || null;
}

function aggregateCountyStats(year) {
  const stats = blankStats('county san diego', 'San Diego Region');

  const supply = rowForYear(state.dataMaps.supply?.get('county san diego'), year);
  if (supply) {
    ['permitted', 'completed', 'approved', 'proposed'].forEach(f => {
      if (isNum(supply[f])) stats[f] = supply[f];
    });
  } else {
    state.allKeys.forEach(key => {
      if (key === 'county san diego') return;
      const s = statsForKey(key, year, false);
      ['permitted', 'completed', 'approved', 'proposed'].forEach(f => {
        if (isNum(s[f])) stats[f] = (stats[f] || 0) + Number(s[f]);
      });
    });
  }

  const rhna = state.dataMaps.rhna?.get('county san diego');
  if (rhna) {
    stats.rhnaAllocation = rhna.allocation;
    stats.rhnaProgress = rhna.progress;
    stats.rhnaRemaining = rhna.remaining;
    stats.rhnaPct = rhna.pct;
    stats.rhnaTiers = rhna.tiers || {};
    stats.rhnaYear = rhna.year;
  }

  const acs = state.dataMaps.acs?.get('county san diego');
  if (acs) applyAcsToStats(stats, acs);

  const dof = rowForYear(state.dataMaps.dof?.get('county san diego')?.series, year);
  if (dof) applyDofToStats(stats, dof);
  else {
    state.allKeys.forEach(key => {
      if (key === 'county san diego') return;
      const d = rowForYear(state.dataMaps.dof?.get(key)?.series, year);
      if (!d) return;
      ['housingUnits', 'occupiedUnits', 'vacantUnits', 'singleFamilyUnits', 'multifamilyUnits', 'mobileHomeUnits'].forEach(f => {
        if (isNum(d[f])) stats[f] = (stats[f] || 0) + Number(d[f]);
      });
    });
  }

  let assistedProperties = 0;
  let assistedUnits = 0;
  let totalUnitsInAssistedProperties = 0;
  let atRiskProperties = 0;
  let atRiskAssistedUnits = 0;
  let unitsInExpiringProperties = 0;
  let hasNhpd = false;

  state.dataMaps.nhpd?.forEach((n, key) => {
    if (key === 'county san diego') return;
    hasNhpd = true;
    assistedProperties += Number(n.assistedProperties || 0);
    assistedUnits += Number(n.assistedUnits || 0);
    totalUnitsInAssistedProperties += Number(n.totalUnitsInAssistedProperties || 0);
    atRiskProperties += Number(n.atRiskProperties || 0);
    atRiskAssistedUnits += Number(n.atRiskAssistedUnits || 0);
    unitsInExpiringProperties += Number(n.unitsInExpiringProperties || 0);
  });

  if (hasNhpd) {
    Object.assign(stats, {
      assistedProperties,
      assistedUnits,
      totalUnitsInAssistedProperties,
      atRiskProperties,
      atRiskAssistedUnits,
      unitsInExpiringProperties,
    });
  }

  return stats;
}

function blankStats(key, label) {
  return {
    key,
    label,
    proposed: null,
    approved: null,
    permitted: null,
    completed: null,
    rhnaAllocation: null,
    rhnaProgress: null,
    rhnaRemaining: null,
    rhnaPct: null,
    rhnaYear: null,
    rhnaTiers: {},
    population: null,
    housingUnits: null,
    occupiedUnits: null,
    vacantUnits: null,
    singleFamilyUnits: null,
    multifamilyUnits: null,
    mobileHomeUnits: null,
    acsYear: null,
    acsPeriod: null,
    medianHouseholdIncome: null,
    countyMedianHouseholdIncome: null,
    incomeRatio: null,
    incomeRatioPct: null,
    renterHouseholds: null,
    renterBurdenedCount: null,
    renterSevereCount: null,
    rentBurdenShare: null,
    rentSevereShare: null,
    ownerHouseholds: null,
    ownerBurdenedCount: null,
    ownerSevereCount: null,
    ownerBurdenShare: null,
    ownerSevereShare: null,
    ownerWithMortgageBurdenShare: null,
    ownerWithoutMortgageBurdenShare: null,
    ownerWithMortgageSevereShare: null,
    ownerWithoutMortgageSevereShare: null,
    medianRent: null,
    rentToIncomePct: null,
    medianOwnerCostMortgage: null,
    medianOwnerCostNoMortgage: null,
    medianOwnerCostMortgageDisplay: null,
    medianOwnerCostNoMortgageDisplay: null,
    ownerCostMortgagePct: null,
    ownerCostNoMortgagePct: null,
    medianHomeValue: null,
    hudFiscalYear: null,
    hudMedianFamilyIncome: null,
    hudExtremelyLow: null,
    hudVeryLow: null,
    hudLow: null,
    assistedProperties: null,
    assistedUnits: null,
    totalUnitsInAssistedProperties: null,
    atRiskProperties: null,
    atRiskAssistedUnits: null,
    unitsInExpiringProperties: null,
  };
}

function applyAcsToStats(stats, acs) {
  [
    'acsYear', 'acsPeriod', 'population', 'medianHouseholdIncome', 'countyMedianHouseholdIncome',
    'incomeRatio', 'incomeRatioPct', 'renterHouseholds', 'renterBurdenedCount', 'renterSevereCount',
    'rentBurdenShare', 'rentSevereShare', 'ownerHouseholds', 'ownerBurdenedCount', 'ownerSevereCount',
    'ownerBurdenShare', 'ownerSevereShare', 'ownerWithMortgageBurdenShare', 'ownerWithoutMortgageBurdenShare',
    'ownerWithMortgageSevereShare', 'ownerWithoutMortgageSevereShare', 'medianRent', 'rentToIncomePct',
    'medianOwnerCostMortgage', 'medianOwnerCostNoMortgage', 'medianOwnerCostMortgageDisplay',
    'medianOwnerCostNoMortgageDisplay', 'ownerCostMortgagePct', 'ownerCostNoMortgagePct', 'medianHomeValue',
    'hudFiscalYear', 'hudMedianFamilyIncome', 'hudExtremelyLow', 'hudVeryLow', 'hudLow',
  ].forEach(f => {
    if (acs[f] !== null && acs[f] !== undefined && acs[f] !== '') stats[f] = acs[f];
  });
}

function applyDofToStats(stats, dof) {
  ['population', 'housingUnits', 'occupiedUnits', 'vacantUnits', 'singleFamilyUnits', 'multifamilyUnits', 'mobileHomeUnits'].forEach(f => {
    if (isNum(dof[f])) stats[f] = dof[f];
  });
}

function statsForKey(key, year = state.selectedYear, allowCountyAggregate = true) {
  if (key === 'county san diego' && allowCountyAggregate) return aggregateCountyStats(year);

  const label = state.dataMaps.labels?.get(key) || titleCase(key);
  const stats = blankStats(key, label);

  const supply = rowForYear(state.dataMaps.supply?.get(key), year);
  if (supply) {
    ['permitted', 'completed', 'approved', 'proposed'].forEach(f => {
      if (isNum(supply[f])) stats[f] = supply[f];
    });
  }

  const rhna = state.dataMaps.rhna?.get(key);
  if (rhna) {
    stats.rhnaAllocation = rhna.allocation;
    stats.rhnaProgress = rhna.progress;
    stats.rhnaRemaining = rhna.remaining;
    stats.rhnaPct = rhna.pct;
    stats.rhnaYear = rhna.year;
    stats.rhnaTiers = rhna.tiers || {};
  }

  const acs = state.dataMaps.acs?.get(key);
  if (acs) applyAcsToStats(stats, acs);

  const dof = rowForYear(state.dataMaps.dof?.get(key)?.series, year);
  if (dof) applyDofToStats(stats, dof);

  const nhpd = state.dataMaps.nhpd?.get(key);
  if (nhpd) {
    ['assistedProperties', 'assistedUnits', 'totalUnitsInAssistedProperties', 'atRiskProperties', 'atRiskAssistedUnits', 'unitsInExpiringProperties'].forEach(f => {
      if (isNum(nhpd[f])) stats[f] = nhpd[f];
    });
  }

  return stats;
}

function formatMetricValue(value, metricKey = state.metric) {
  if (!isNum(value)) return 'No data';
  const meta = METRICS[metricKey];
  const n = Number(value);
  const decimals = Number(meta?.decimals || 0);
  if (meta.unit === '$') return fmtMoney.format(n);
  if (meta.unit === '%') return `${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
  if (meta.unit === 'per 1k') return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return fmtInt.format(n);
}

function metricValueForKey(key, year = state.selectedYear, metricKey = state.metric) {
  return METRICS[metricKey].getter(statsForKey(key, year));
}

const CARTO_API_KEY = 'cb1_4dn0_1_f53a3c2645eb86a749a9b521';

const map = L.map('map', {
  zoomControl: false,
  preferCanvas: true,
  attributionControl: true,
}).setView([32.84, -116.98], 10);

L.control.zoom({
  position: 'bottomright',
}).addTo(map);

L.tileLayer(
  `https://basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  }
).addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';

L.tileLayer(
  `https://basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  {
    pane: 'labels',
    maxZoom: 20,
  }
).addTo(map);

async function init() {
  setupUi();
  setStatus('Loading validated source files…');

  const [
  geojson,
  countyGeojson,
  ws1Rows,
  productionTypeRows,
  dofRows,
  benchmarkRows,
  affordabilityRows,
  nhpdSummaryRows,
  nhpdRiskRows,
] = await Promise.all([
  loadFirst(
    'Municipal/place boundaries',
    PATHS.boundaries,
    'json'
  ),

  loadFirst(
    'County boundary',
    PATHS.countyBoundary,
    'json'
  ),

  loadFirst(
    'Validated RHNA + APR production',
    PATHS.ws1Long,
    'csv'
  ),

  loadFirst(
    'Validated production by housing type',
    PATHS.productionType,
    'csv'
  ),

  loadFirst(
    'Validated DOF housing stock',
    PATHS.dof,
    'csv'
  ),

  loadFirst(
    'Validated housing-stock benchmarks',
    PATHS.benchmarks,
    'csv'
  ),

  loadFirst(
    'Validated ACS + HUD affordability',
    PATHS.affordability,
    'csv'
  ),

  loadFirst(
    'Validated aggregated NHPD inventory',
    PATHS.nhpdSummary,
    'csv'
  ),

  loadFirst(
    'Validated aggregated NHPD preservation risk',
    PATHS.nhpdRisk,
    'csv'
  ),
]);

state.geojson = geojson;
state.countyGeojson = countyGeojson;

/*
  Zoning is not currently used in the public dashboard.
  Keep these null unless zoning is added as a future feature.
*/
state.zoningBaseGeojson = null;
state.zoningUnincorporatedGeojson = null;
  state.dataMaps.labels = new Map();

  if (geojson?.features) {
    geojson.features.forEach(f => {
      const name = featureName(f);
      const key = cleanKey(name);
      if (key) {
        state.allKeys.add(key);
        state.dataMaps.labels.set(key, String(name));
        f.properties.__housing_key = key;
      }
    });
  }

  const ws1 = buildWs1Maps(ws1Rows);
  state.dataMaps.supply = ws1.supply;
  state.dataMaps.rhna = ws1.rhna;
  state.dataMaps.productionType = buildProductionTypeMap(productionTypeRows);
  state.dataMaps.dof = cityMapFromRows(dofRows, reduceDof);
  state.dataMaps.benchmarks = buildBenchmarkMap(benchmarkRows);
  state.dataMaps.acs = cityMapFromRows(affordabilityRows, reduceAcs);
  state.dataMaps.nhpd = cityMapFromRows(nhpdSummaryRows, reduceNhpd);
  state.dataMaps.nhpdRisk = buildNhpdRiskMap(nhpdRiskRows);

  [
    state.dataMaps.supply,
    state.dataMaps.rhna,
    state.dataMaps.productionType,
    state.dataMaps.dof,
    state.dataMaps.benchmarks,
    state.dataMaps.acs,
    state.dataMaps.nhpd,
    state.dataMaps.nhpdRisk,
  ].forEach(mapObj => {
    mapObj?.forEach((v, k) => {
      state.allKeys.add(k);
      if (!state.dataMaps.labels.has(k)) {
        const label = v?.label || (k === 'unincorporated' ? 'Unincorporated San Diego County' : titleCase(k));
        state.dataMaps.labels.set(k, label);
      }
    });
  });

  state.dataMaps.labels.set('county san diego', 'San Diego Region');
  if (state.allKeys.has('unincorporated')) {
    state.dataMaps.labels.set('unincorporated', 'Unincorporated San Diego County');
  }

  state.selectedYear = detectDefaultYear();
  state.selectedKey = pickDefaultKey();

  populateMetricSelect();
  populateYearSelect();
  populateSearch();
  renderMap();
  setTimeout(() => {
    map.invalidateSize();
    fitToData();
  }, 250);
  renderAll();
  renderFileStatus();
  setStatus(`Loaded ${state.loadedFiles.length} validated data source${state.loadedFiles.length === 1 ? '' : 's'}.`);
}

function mergeSupplyMaps(a, b) {
  const out = new Map(a || []);
  (b || new Map()).forEach((arr, key) => {
    if (!out.has(key)) out.set(key, []);
    out.set(key, combineSeries(out.get(key), arr));
  });
  return out;
}

function combineSeries(a = [], b = []) {
  const byYear = new Map();

  [...a, ...b].forEach(row => {
    const y = Number(row.year);
    if (!isNum(y)) return;

    if (!byYear.has(y)) {
      byYear.set(y, blankSupplyYear(row.key, row.label, y));
    }

    const target = byYear.get(y);

    [
  'permitted',
  'completed',
  'approved',
  'proposed',
  'affordable',
  'aboveModerate',
].forEach(f => addIfNum(target, f, row[f]));

    if (row.points?.length) {
      target.points.push(...row.points);
    }
  });

  return [...byYear.values()].sort((x, y) => x.year - y.year);
}

function detectDefaultYear() {
  const years = collectYears();
  if (years.length) return years[years.length - 1];
  return new Date().getFullYear();
}

function collectYears() {
  const years = new Set();
  state.dataMaps.supply?.forEach(arr => arr.forEach(d => isNum(d.year) && years.add(Number(d.year))));
  state.dataMaps.dof?.forEach(entry => entry.series?.forEach(d => isNum(d.year) && years.add(Number(d.year))));
  return [...years].sort((a, b) => a - b);
}

function pickDefaultKey() {
  if (state.allKeys.has('san diego')) return 'san diego';
  return [...state.allKeys].sort()[0] || 'county san diego';
}

function setupPolicySidebar() {
  if (document.getElementById('policySidebar')) return;

  const nav = document.querySelector('.site-nav');
  const filters =
    document.querySelector('.overview-filter-panel') ||
    document.querySelector('.filter-card.filters-card');
  const headerLogo = document.querySelector('.header-logo-right');

  if (!nav) return;

  const sidebar = document.createElement('aside');
  sidebar.id = 'policySidebar';
  sidebar.className = 'policy-sidebar';
  sidebar.setAttribute('aria-label', 'Dashboard navigation and filters');

  sidebar.innerHTML = `
    <div class="sidebar-head">
      <div class="sidebar-head-copy">
        <div class="sidebar-eyebrow">San Diego Region</div>
        <div class="sidebar-title">Explore dashboard</div>
      </div>

      <button
        id="policySidebarToggle"
        class="sidebar-toggle"
        type="button"
        aria-label="Collapse dashboard sidebar"
        aria-expanded="true"
      >
        <i class="bi bi-chevron-left"></i>
      </button>
    </div>

    <div class="sidebar-scroll">
      <div class="sidebar-section-label">Dashboard views</div>
      <div id="sidebarNavHost"></div>

      <div class="sidebar-section-label">Customize view</div>
      <div id="sidebarFilterHost"></div>
    </div>

    <div id="sidebarLogoHost" class="sidebar-logo-host"></div>
  `;

  document.body.appendChild(sidebar);

  if (headerLogo) {
    headerLogo.classList.add('sidebar-logo-footer');
    sidebar.querySelector('#sidebarLogoHost')?.appendChild(headerLogo);
  }

  const navHost = sidebar.querySelector('#sidebarNavHost');
  navHost.appendChild(nav);

  const icons = {
    overview: 'bi-grid-1x2-fill',
    rhna: 'bi-bullseye',
    production: 'bi-buildings',
    need: 'bi-people-fill',
    rental: 'bi-key-fill',
    ownership: 'bi-house-check-fill',
    methods: 'bi-journal-text',
  };

  nav.querySelectorAll('.rail-btn').forEach(btn => {
    const label = btn.textContent.trim();
    const icon = icons[btn.dataset.panel] || 'bi-circle-fill';

    btn.innerHTML = `
      <i class="bi ${icon}" aria-hidden="true"></i>
      <span>${label}</span>
    `;
  });

  if (filters) {
    filters.classList.add('sidebar-filters');

    const filterHeader = filters.querySelector('.visual-header');
    if (filterHeader) filterHeader.remove();

    sidebar
      .querySelector('#sidebarFilterHost')
      .appendChild(filters);
  }

  const toggle = sidebar.querySelector('#policySidebarToggle');

  function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);

    toggle.setAttribute(
      'aria-expanded',
      String(!collapsed)
    );

    toggle.setAttribute(
      'aria-label',
      collapsed
        ? 'Open dashboard sidebar'
        : 'Collapse dashboard sidebar'
    );

    setTimeout(() => {
      if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
      }
    }, 260);
  }

  toggle.addEventListener('click', () => {
    setSidebarCollapsed(
      !sidebar.classList.contains('collapsed')
    );
  });

  nav.querySelectorAll('.rail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 980) {
        setSidebarCollapsed(true);
      }
    });
  });

  if (window.innerWidth <= 980) {
    setSidebarCollapsed(true);
  }

  document.body.classList.add('sidebar-ready');
}

function setupUi() {
  setupPolicySidebar();
  document.body.dataset.activePanel =
  document.querySelector('.rail-btn.active')?.dataset.panel ||
  'overview';
  document.querySelectorAll('.rail-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  const closeDrawerBtn = $('closeDrawerBtn');
  if (closeDrawerBtn && $('drawerPanel')) {
    closeDrawerBtn.addEventListener('click', () => $('drawerPanel').classList.toggle('collapsed'));
  }

  $('metricSelect')?.addEventListener('change', e => {
    state.metric = e.target.value;
    renderAll();
    renderMap();
    setTimeout(() => map.invalidateSize(), 60);
  });
  $('yearSelect')?.addEventListener('change', e => {
    state.selectedYear = Number(e.target.value);
    renderAll();
    renderMap();
    setTimeout(() => map.invalidateSize(), 60);
  });
  $('searchBtn')?.addEventListener('click', runSearch);
  $('searchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  $('toggleChoro')?.addEventListener('change', e => { state.showChoro = e.target.checked; renderMap(); });
  $('toggleOutlines')?.addEventListener('change', e => { state.showOutlines = e.target.checked; renderMap(); });
  $('togglePermitPoints')?.addEventListener('change', e => { state.showPermitPoints = e.target.checked; renderPermitPoints(); });
  $('zoomHomeBtn')?.addEventListener('click', fitToData);
  $('collapseSnapshot')?.addEventListener('click', () => $('snapshotCard')?.classList.add('hidden'));
  document.querySelectorAll('.faq-btn').forEach(btn => btn.addEventListener('click', () => btn.closest('.faq-item').classList.toggle('open')));
  $('toggleZoningBase')?.addEventListener('change', e => {
  state.showZoningBase = e.target.checked;
  renderZoningLayers();
  });
  $('toggleZoningUnincorporated')?.addEventListener('change', e => {
    state.showZoningUnincorporated = e.target.checked;
    renderZoningLayers();
  });
}

function switchPanel(panel) {
  document.body.dataset.activePanel = panel;
  document.querySelectorAll('.rail-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });

  document.querySelectorAll('.dashboard-page').forEach(view => {
    view.classList.toggle('active', view.dataset.page === panel);
  });

  renderAll();

  if (panel === 'overview') {
    setTimeout(() => {
      map.invalidateSize();
      renderMap();
    }, 180);
  }
}

function populateMetricSelect() {
  $('metricSelect').innerHTML = Object.entries(METRICS).map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join('');
  $('metricSelect').value = state.metric;
}

function populateYearSelect() {
  const years = collectYears();
  if (!years.length) years.push(state.selectedYear);
  $('yearSelect').innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  $('yearSelect').value = String(state.selectedYear);
  $('yearNote').textContent = years.length > 1
    ? `Showing ${state.selectedYear}. Change the year to compare annual supply/context records.`
    : 'Only one reporting year was detected from the current processed files.';
}

function populateSearch() {
  const options = [...state.allKeys]
    .filter(k => k !== 'county san diego')
    .map(k => state.dataMaps.labels.get(k) || titleCase(k))
    .sort((a, b) => a.localeCompare(b));
  $('searchSuggestions').innerHTML = options.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
}

function runSearch() {
  const q = cleanKey($('searchInput').value);
  if (!q) return;
  const exact = [...state.allKeys].find(k => k === q || k.includes(q) || q.includes(k));
  if (!exact) {
    setStatus('No matching jurisdiction found. Try a city name such as San Diego or Chula Vista.');
    return;
  }
  selectKey(exact, true);
}

function selectKey(key, zoom = false) {
  state.selectedKey = key;
  if ($('searchInput')) $('searchInput').value = state.dataMaps.labels?.get(key) || titleCase(key);

  // Update values without changing the visible page or scrolling the browser.
  renderAll();
  renderMap();

  const activePanel = document.querySelector('.rail-btn.active')?.dataset.panel || 'overview';

  document.querySelectorAll('.dashboard-page').forEach(view => {
    view.classList.toggle('active', view.dataset.page === activePanel);
  });

  setTimeout(() => {
    map.invalidateSize();

    if (zoom) {
      zoomToKey(key);
    }
  }, 90);
}

function renderMap() {
  if (state.boundaryLayer) state.boundaryLayer.remove();
  if (state.countyLayer) state.countyLayer.remove();

  computeBins();

  if (state.countyGeojson?.features) {
    state.countyLayer = L.geoJSON(state.countyGeojson, {
      style: { color: '#36566A', weight: 1.4, fillOpacity: 0, dashArray: '4 4' },
      interactive: false,
    }).addTo(map);
  }

  if (state.geojson?.features) {
    state.boundaryLayer = L.geoJSON(state.geojson, {
      style: featureStyle,
      onEachFeature: (feature, layer) => {
  const key =
    feature.properties.__housing_key ||
    cleanKey(featureName(feature));

  layer.bindPopup(
    () => popupHtml(key),
    {
      maxWidth: 340,
      className: 'jurisdiction-popup',
      autoPan: true,
      closeButton: true,
    }
  );

  layer.on({
    mouseover: e => {
      highlightFeature(e.target);
    },

    mouseout: e => {
      resetHighlight(e.target);
    },

    click: e => {
      /*
        Update the selected jurisdiction without calling
        renderMap(), because rebuilding the map here would
        destroy the layer whose popup we are opening.
      */
      state.selectedKey = key;

      if ($('searchInput')) {
        $('searchInput').value =
          state.dataMaps.labels?.get(key) ||
          titleCase(key);
      }

      /*
        Update all dashboard numbers and panels.
        renderAll() does not recreate the GeoJSON layer.
      */
      renderAll();

      /*
        Refresh polygon styling so the clicked jurisdiction
        gets the selected outline.
      */
      if (state.boundaryLayer) {
        state.boundaryLayer.eachLayer(boundary => {
          if (boundary.feature) {
            boundary.setStyle(
              featureStyle(boundary.feature)
            );
          }
        });
      }

      /*
        Rebuild the popup after the selected state changes,
        then open it on the layer that was actually clicked.
      */
      e.target.setPopupContent(
        popupHtml(key)
      );

      e.target.openPopup();
    },
  });
},
    }).addTo(map);

    if (!state.hasFit) fitToData();
  }

  renderZoningLayers();
  renderPermitPoints();
  renderLegend();
}

function fitToData() {
  const layer = state.boundaryLayer || state.countyLayer;
  if (!layer) return;

  try {
    map.invalidateSize();

    // Fit to the actual jurisdiction layer with tighter padding.
    map.fitBounds(layer.getBounds(), {
      paddingTopLeft: [18, 18],
      paddingBottomRight: [18, 18],
      maxZoom: 10,
    });

    state.hasFit = true;
  } catch (_) {}
}

function zoomToKey(key) {
  if (!state.boundaryLayer) return;
  let target = null;
  state.boundaryLayer.eachLayer(layer => {
    const k = layer.feature?.properties?.__housing_key || cleanKey(featureName(layer.feature));
    if (k === key) target = layer;
  });
  if (target) {
    map.invalidateSize();
    map.fitBounds(target.getBounds(), { padding: [30, 30], maxZoom: 12 });
  }
}

function featureStyle(feature) {
  const key = feature.properties.__housing_key || cleanKey(featureName(feature));
  const value = state.valuesByKey.get(key);
  const selected = key === state.selectedKey;
  return {
    color: selected ? '#FFCD00' : (state.showOutlines ? 'rgba(24,43,73,0.52)' : 'rgba(24,43,73,0.10)'),
    weight: selected ? 3.2 : (state.showOutlines ? 1.0 : 0.3),
    fillColor: state.showChoro ? colorForValue(value) : '#FFFFFF',
    fillOpacity: state.showChoro ? (isNum(value) ? 0.84 : 0.30) : 0.04,
    opacity: 1,
  };
}

function highlightFeature(layer) {
  layer.setStyle({ weight: 2.5, color: '#182B49', fillOpacity: 0.88 });
  layer.bringToFront();
}
function resetHighlight(layer) {
  if (!state.boundaryLayer) return;

  if (layer.feature) {
    layer.setStyle(
      featureStyle(layer.feature)
    );
  }
}

function renderPermitPoints() {
  if (state.permitPointLayer) state.permitPointLayer.remove();
  if (!state.showPermitPoints) return;
  const points = [];
  state.dataMaps.supply?.forEach(series => {
    const row = rowForYear(series, state.selectedYear);
    if (row?.points?.length) points.push(...row.points.slice(0, 3000));
  });
  state.permitPointLayer = L.layerGroup(points.map(p => L.circleMarker([p.lat, p.lng], {
    radius: 4,
    color: '#17384A',
    weight: 1,
    fillColor: '#C69214',
    fillOpacity: 0.82,
  }).bindPopup(`<div class="popup-title">${escapeHtml(p.title)}</div><div>${formatMaybe(p.units)} units</div>`))).addTo(map);
}

function zoningLabel(feature) {
  const p = feature?.properties || {};

  return (
    firstValue(p, [
      'ZONE',
      'Zone',
      'zone',
      'ZONE_CODE',
      'zone_code',
      'ZONING',
      'zoning',
      'ZONING_CODE',
      'zoning_code',
      'BASEZONE',
      'basezone',
      'Name',
      'NAME',
    ]) || 'Zoning area'
  );
}

function zoningDescription(feature) {
  const p = feature?.properties || {};

  const jurisdiction = firstValue(p, [
    'JURISDICTION',
    'Jurisdiction',
    'jurisdiction',
    'CITY',
    'City',
    'city',
    'COMMUNITY',
    'Community',
    'community',
  ]);

  const landUse = firstValue(p, [
    'LANDUSE',
    'LandUse',
    'land_use',
    'LAND_USE',
    'DESCRIPTION',
    'Description',
    'desc',
  ]);

  const parts = [];

  if (jurisdiction) parts.push(`Jurisdiction: ${jurisdiction}`);
  if (landUse) parts.push(`Description: ${landUse}`);

  return parts.length ? parts.join('<br>') : 'SANDAG/SanGIS zoning context layer';
}

function zoningPopupHtml(feature, sourceLabel) {
  const label = zoningLabel(feature);
  const desc = zoningDescription(feature);

  return `
    <div class="popup-title">${escapeHtml(label)}</div>
    <div class="helper-text">${escapeHtml(sourceLabel)}</div>
    <div style="margin-top:6px;">${desc}</div>
    <div class="helper-text" style="margin-top:8px;">
      Zoning is shown as context only. It is not a housing production count.
    </div>
  `;
}

function renderZoningLayers() {
  if (state.zoningBaseLayer) {
    state.zoningBaseLayer.remove();
    state.zoningBaseLayer = null;
  }

  if (state.zoningUnincorporatedLayer) {
    state.zoningUnincorporatedLayer.remove();
    state.zoningUnincorporatedLayer = null;
  }

  if (state.showZoningBase && state.zoningBaseGeojson?.features) {
    state.zoningBaseLayer = L.geoJSON(state.zoningBaseGeojson, {
      pane: 'overlayPane',
      style: {
        color: '#5E704D',
        weight: 0.65,
        opacity: 0.58,
        fillColor: '#A8C88C',
        fillOpacity: 0.10,
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(() => zoningPopupHtml(feature, 'Zoning_Base_SD'));
      },
    }).addTo(map);
  }

  if (state.showZoningUnincorporated && state.zoningUnincorporatedGeojson?.features) {
    state.zoningUnincorporatedLayer = L.geoJSON(state.zoningUnincorporatedGeojson, {
      pane: 'overlayPane',
      style: {
        color: '#6A6F2E',
        weight: 0.75,
        opacity: 0.70,
        fillColor: '#D6D88A',
        fillOpacity: 0.14,
        dashArray: '3 3',
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(() => zoningPopupHtml(feature, 'Zoning_Unincorporated'));
      },
    }).addTo(map);
  }

  // Keep city boundaries visually above zoning.
  if (state.boundaryLayer) state.boundaryLayer.bringToFront();
  if (state.permitPointLayer) state.permitPointLayer.bringToFront();
}

function computeBins() {
  state.valuesByKey.clear();
  const vals = [];
  state.allKeys.forEach(key => {
    if (key === 'county san diego') return;
    const v = metricValueForKey(key);
    state.valuesByKey.set(key, v);
    if (isNum(v)) vals.push(Number(v));
  });
  if (!vals.length) {
    state.bins = [];
    return;
  }
  vals.sort((a, b) => a - b);
  state.bins = [0, 1, 2, 3, 4, 5, 6].map(i => d3.quantile(vals, i / 6));
}

function colorForValue(value) {
  if (!isNum(value) || !state.bins.length) return NO_DATA_FILL;
  const v = Number(value);
  let idx = 0;
  while (idx < state.bins.length - 1 && v > state.bins[idx + 1]) idx++;
  return PALETTE[Math.min(idx, PALETTE.length - 1)];
}

function renderLegend() {
  const meta = METRICS[state.metric];

  $('legendTitle').textContent = meta.label;
  $('legendSubtitle').textContent = meta.description;

  if (!state.bins.length) {
    $('legendScale').innerHTML = `
      <div class="legend-bin-row">
        <span class="legend-swatch" style="background:${NO_DATA_FILL}"></span>
        <span class="legend-bin-text">No data available</span>
      </div>
    `;
    $('legendLabels').innerHTML = '';
    $('legendFootnote').textContent = meta.caveat;
    return;
  }

  const rows = PALETTE.map((color, i) => {
    const low = state.bins[i];
    const high = state.bins[i + 1];

    let label;
    if (i === 0) {
      label = `Lowest: ≤ ${compactValue(high, state.metric)}`;
    } else if (i === PALETTE.length - 1) {
      label = `Highest: ≥ ${compactValue(low, state.metric)}`;
    } else {
      label = `${compactValue(low, state.metric)} – ${compactValue(high, state.metric)}`;
    }

    return `
      <div class="legend-bin-row">
        <span class="legend-swatch" style="background:${color}"></span>
        <span class="legend-bin-text">${label}</span>
      </div>
    `;
  }).join('');

  $('legendScale').innerHTML = rows;
  $('legendLabels').innerHTML = '';
  $('legendFootnote').textContent = meta.caveat;
}

function safeRender(label, fn) {
  try {
    fn();
  } catch (err) {
    console.warn(`${label} render skipped`, err);
  }
}

function renderAll() {
  safeRender('selection context', renderSelectionContext);
  safeRender('snapshot KPIs', renderSnapshot);
  safeRender('selected jurisdiction', renderLocationPanel);
  safeRender('overview ranking', () => renderRankChart('rankChart', state.metric));
  safeRender('drawer KPIs', renderDrawerKpis);
  safeRender('RHNA panel', renderRhnaPanel);
  safeRender('housing production panel', renderProductionPanel);
  safeRender('housing need panel', renderNeedPanel);
  safeRender('rental affordability panel', renderRentalPanel);
  safeRender('homeownership affordability panel', renderOwnershipPanel);

  requestAnimationFrame(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  });
}

function renderSelectionContext() {
  if ($('headerReportingYear')) {
  $('headerReportingYear').textContent =
    String(state.selectedYear);
}
  
  const s = statsForKey(
    state.selectedKey,
    state.selectedYear
  );

  const selectedLabel =
    s.label || 'Selected jurisdiction';

  document
    .querySelectorAll('.selected-jurisdiction-label')
    .forEach(el => {
      el.textContent = selectedLabel;
    });

  document
    .querySelectorAll('.selected-year-label')
    .forEach(el => {
      el.textContent = String(state.selectedYear);
    });

  if ($('selectedContext')) {
    $('selectedContext').textContent =
      `Selected: ${state.selectedYear} · ${selectedLabel}`;
  }

  if ($('regionalPeriodLabel')) {
    const rhnaYear = statsForKey(
      'county san diego',
      state.selectedYear
    ).rhnaYear;

    $('regionalPeriodLabel').textContent =
      `APR reporting year ${state.selectedYear}` +
      `${rhnaYear ? ` · RHNA snapshot ${rhnaYear}` : ''}`;
  }

  if ($('yearNote')) {
    const activePanel =
      document.querySelector('.rail-btn.active')
        ?.dataset.panel || 'overview';

    if (
      activePanel === 'need' ||
      activePanel === 'rental' ||
      activePanel === 'ownership'
    ) {
      $('yearNote').textContent =
        `APR / production year: ${state.selectedYear}. ` +
        `Affordability and cost-burden metrics use ` +
        `${s.acsPeriod || 'the current ACS 5-year period'} ` +
        `and do not change with this year filter.`;
    } else if (activePanel === 'rhna') {
      $('yearNote').textContent =
        `APR reporting year: ${state.selectedYear}. ` +
        `RHNA progress is cumulative for the 6th Cycle ` +
        `snapshot shown above.`;
    } else {
      $('yearNote').textContent =
        `Reporting year: ${state.selectedYear}. ` +
        `Change the year to compare annual APR / ` +
        `housing-stock records.`;
    }
  }
}

function renderSnapshot() {
  const county = statsForKey('county san diego', state.selectedYear);

  const cards = [
    {
      label: 'RHNA progress',
      note: '6th Cycle · qualifying permits',
      value: formatMetricValue(county.rhnaPct, 'rhna_progress'),
    },
    {
      label: 'Permitted units',
      note: `APR ${state.selectedYear}`,
      value: formatMetricValue(county.permitted, 'permitted_units'),
    },
    {
      label: 'Completed units',
      note: `APR ${state.selectedYear}`,
      value: formatMetricValue(county.completed, 'completed_units'),
    },
    {
      label: 'Total housing stock',
      note: `DOF estimate through ${state.selectedYear}`,
      value: formatMaybe(county.housingUnits),
    },
  ];

  $('snapshotKpis').innerHTML = cards.map(card => `
    <div class="snapshot-kpi">
      <div class="label">${escapeHtml(card.label)}</div>
      <div class="kpi-note">${escapeHtml(card.note)}</div>
      <div class="value">${escapeHtml(String(card.value))}</div>
    </div>
  `).join('');
}

function renderDrawerKpis() {
  const s = statsForKey(state.selectedKey, state.selectedYear);
  if (!$('drawerKpis')) return;
  $('drawerKpis').innerHTML = [
    kpiHtml(METRICS[state.metric].label, formatMetricValue(metricValueForKey(state.selectedKey), state.metric), `${s.label} · ${state.selectedYear}`),
    kpiHtml('RHNA progress', formatMetricValue(s.rhnaPct, 'rhna_progress'), `${formatMaybe(s.rhnaProgress)} of ${formatMaybe(s.rhnaAllocation)} allocated units`),
    kpiHtml('Permitted units', formatMetricValue(s.permitted, 'permitted_units'), `APR ${state.selectedYear}`),
    kpiHtml('Population', formatMaybe(s.population), s.acsPeriod || 'ACS context when available'),
  ].join('');
}

function renderRhnaPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('rhnaSummary').innerHTML = [
    kpiHtml('RHNA allocation', formatMaybe(s.rhnaAllocation), '6th Cycle allocation'),
    kpiHtml('Qualifying units', formatMaybe(s.rhnaProgress), 'Cumulative qualifying permits'),
    kpiHtml('Remaining need', formatMaybe(s.rhnaRemaining), 'Income-tier remaining need'),
    kpiHtml('RHNA % complete', formatMetricValue(s.rhnaPct, 'rhna_progress'), `HCD snapshot ${s.rhnaYear || 'current'}`),
  ].join('');

  const tierEntries = [
    ['Very low', s.rhnaTiers?.very_low],
    ['Low', s.rhnaTiers?.low],
    ['Moderate', s.rhnaTiers?.moderate],
    ['Above moderate', s.rhnaTiers?.above_moderate],
  ].map(([label, tier]) => ({
    label,
    allocation: tier?.allocation,
    progress: tier?.progress,
    remaining: tier?.remaining,
    pct: isNum(tier?.pct) ? Number(tier.pct) : pct(tier?.progress, tier?.allocation),
  }));

  const remainingRows = tierEntries.filter(d => isNum(d.remaining));
  const pctRows = tierEntries.filter(d => isNum(d.pct));
  const largestGap = remainingRows.length ? remainingRows.slice().sort((a, b) => Number(b.remaining) - Number(a.remaining))[0] : null;
  const strongest = pctRows.length ? pctRows.slice().sort((a, b) => Number(b.pct) - Number(a.pct))[0] : null;
  const permitCompletionGap = isNum(s.permitted) && isNum(s.completed) ? Number(s.permitted) - Number(s.completed) : null;

  $('rhnaInsights').innerHTML = [
    `<div class="policy-insight"><span>Largest remaining tier</span><strong>${largestGap ? `${escapeHtml(largestGap.label)} · ${formatMaybe(largestGap.remaining)} units` : 'No data'}</strong></div>`,
    `<div class="policy-insight"><span>Strongest tier progress</span><strong>${strongest ? `${escapeHtml(strongest.label)} · ${fmt1.format(strongest.pct)}%` : 'No data'}</strong></div>`,
    `<div class="policy-insight"><span>Permits vs. completions this year</span><strong>${isNum(permitCompletionGap) ? `${formatMaybe(s.permitted)} permits · ${formatMaybe(s.completed)} completed` : 'No data'}</strong></div>`,
  ].join('');

  renderRhnaOverallDonut('rhnaOverallDonut', s);
  renderRhnaTierChart('incomeTierChart', s);
  renderRhnaPipelineChart('rhnaPipelineChart', s);
}

function renderProductionPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('productionMiniStats').innerHTML = [
    miniStat('Applications', s.proposed),
    miniStat('Entitlements', s.approved),
    miniStat('Permitted', s.permitted),
    miniStat('Completed', s.completed),
  ].join('');

  $('stockStats').innerHTML = [
    miniStat('Total housing units', s.housingUnits),
    miniStat('Occupied units', s.occupiedUnits),
    miniStat('Vacant units', s.vacantUnits),
    miniStat('Single-family units', s.singleFamilyUnits),
    miniStat('Multifamily units', s.multifamilyUnits),
    miniStat('Mobile homes', s.mobileHomeUnits),
  ].join('');

  renderTrendChart('supplyTrend', state.selectedKey);
  renderProductionTypeChart('productionTypeChart', state.selectedKey, state.selectedYear);
  renderStockTrend('stockTrend', state.selectedKey);
}

function renderNeedPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('needStats').innerHTML = [
    miniStat('Population', s.population),
    miniStat('Renter households burdened', s.renterBurdenedCount),
    miniStat('Severely burdened renters', s.renterSevereCount),
    miniStat('Owner households burdened', s.ownerBurdenedCount),
    miniStat('Severely burdened owners', s.ownerSevereCount),
  ].join('');

  $('assistedStats').innerHTML = [
    miniStat('Assisted properties', s.assistedProperties),
    miniStat('Estimated assisted units', s.assistedUnits),
    miniStat('Properties at risk', s.atRiskProperties),
    miniStat('Estimated units at risk', s.atRiskAssistedUnits),
  ].join('');

  renderBurdenCompositionChart('needBurdenChart', [
    { label: 'Renters', burden: s.rentBurdenShare, severe: s.rentSevereShare },
    { label: 'Homeowners', burden: s.ownerBurdenShare, severe: s.ownerSevereShare },
  ]);

  renderAssistedRiskDonut('assistedRiskDonut', s);
  renderPreservationRiskChart('preservationRiskChart', state.selectedKey);
}

function renderRentalPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('rentalStats').innerHTML = [
    miniStat('1BR median gross rent', s.medianRent, 'money'),
    miniStat('1BR rent-to-income', s.rentToIncomePct, 'percent1'),
    miniStat('Renter cost-burdened', s.renterBurdenedCount),
    miniStat('Renter burden', s.rentBurdenShare, 'percent1'),
    miniStat('Severely burdened renters', s.renterSevereCount),
    miniStat('Severe renter burden', s.rentSevereShare, 'percent1'),
  ].join('');

  renderBurdenCompositionChart('rentalBurdenChart', [
    { label: s.label || 'Selected jurisdiction', burden: s.rentBurdenShare, severe: s.rentSevereShare },
  ], { compact: true });

  renderRentalRelationshipChart('rentalRelationshipChart');
}

function renderOwnershipPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('ownershipStats').innerHTML = [
    miniStat('Median home value', s.medianHomeValue, 'money'),
    miniStatText('Owner cost w/ mortgage', s.medianOwnerCostMortgageDisplay || formatMoneyMaybe(s.medianOwnerCostMortgage)),
    miniStatText('Owner cost w/o mortgage', s.medianOwnerCostNoMortgageDisplay || formatMoneyMaybe(s.medianOwnerCostNoMortgage)),
    miniStat('Homeowner burden', s.ownerBurdenShare, 'percent1'),
    miniStat('Mortgage owner burden', s.ownerWithMortgageBurdenShare, 'percent1'),
    miniStat('No-mortgage owner burden', s.ownerWithoutMortgageBurdenShare, 'percent1'),
  ].join('');

  $('amiStats').innerHTML = [
    miniStat('HUD 4-person median family income', s.hudMedianFamilyIncome, 'money'),
    miniStat('Extremely low income limit', s.hudExtremelyLow, 'money'),
    miniStat('Very low income limit', s.hudVeryLow, 'money'),
    miniStat('Low income limit', s.hudLow, 'money'),
  ].join('');

  $('incomeComparisonStats').innerHTML = [
    miniStat('Jurisdiction median household income', s.medianHouseholdIncome, 'money'),
    miniStat('County median household income', s.countyMedianHouseholdIncome, 'money'),
    miniStat('Jurisdiction / county income', s.incomeRatioPct, 'percent1'),
  ].join('');

  renderBurdenCompositionChart('ownershipBurdenChart', [
    { label: 'All owners', burden: s.ownerBurdenShare, severe: s.ownerSevereShare },
    { label: 'With mortgage', burden: s.ownerWithMortgageBurdenShare, severe: s.ownerWithMortgageSevereShare },
    { label: 'Without mortgage', burden: s.ownerWithoutMortgageBurdenShare, severe: s.ownerWithoutMortgageSevereShare },
  ]);

  renderOwnershipRelationshipChart('ownershipRelationshipChart');
}

function renderLocationPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);
  const zoomKey = String(state.selectedKey || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  $('locationPanel').innerHTML = `
    <div class="location-card-head">
      <div>
        <div class="section-heading">${escapeHtml(s.label)}</div>
        <p class="helper-text">Selected jurisdiction · APR ${state.selectedYear}</p>
      </div>
    </div>

    <div class="location-action-row">
      <button class="mini-btn location-zoom-btn" type="button" onclick="zoomToKey('${zoomKey}')">
        <i class="bi bi-house-door"></i> Zoom
      </button>

      <button class="mini-btn location-detail-btn" type="button" onclick="switchPanel('production')">
        <i class="bi bi-bar-chart"></i> Production details
      </button>
    </div>

    <div class="kpi-stack location-kpis">
      ${kpiHtml(METRICS[state.metric].label, formatMetricValue(metricValueForKey(state.selectedKey), state.metric), METRICS[state.metric].description)}
      ${kpiHtml('Permitted / completed', `${formatMaybe(s.permitted)} / ${formatMaybe(s.completed)}`, `APR ${state.selectedYear}`)}
      ${kpiHtml('RHNA allocation', formatMaybe(s.rhnaAllocation), `${formatMaybe(s.rhnaProgress)} qualifying units reported`)}
      ${kpiHtml('Population / median income', `${formatMaybe(s.population)} residents`, `${formatMoneyMaybe(s.medianHouseholdIncome)} median household income`)}
    </div>
  `;
}

function renderFileStatus() {
  const loaded = state.loadedFiles.map(f => `<div class="file-row"><i class="bi bi-check-circle-fill ok"></i><div><div class="name">${escapeHtml(f.kind)} loaded</div><div class="path">${escapeHtml(f.path)} · ${f.rows} record${f.rows === 1 ? '' : 's'}</div></div></div>`).join('');
  const missing = state.missingFiles.map(f => `<div class="file-row"><i class="bi bi-exclamation-triangle-fill warn"></i><div><div class="name">${escapeHtml(f.kind)} not found</div><div class="path">Tried: ${escapeHtml(f.paths.join(', '))}</div></div></div>`).join('');
  $('fileStatus').innerHTML = loaded + missing;
}

function kpiHtml(label, value, note = '') {
  return `<div class="kpi-card"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(String(value))}</div>${note ? `<div class="kpi-note">${escapeHtml(note)}</div>` : ''}</div>`;
}

function miniStat(label, value, kind = 'number') {
  let display = formatMaybe(value);
  if (kind === 'money') display = formatMoneyMaybe(value);
  if (kind === 'percent') display = isNum(value) ? `${fmtInt.format(value)}%` : 'No data';
  if (kind === 'percent1') display = isNum(value) ? `${fmt1.format(value)}%` : 'No data';
  if (kind === '1') display = isNum(value) ? fmt1.format(value) : 'No data';
  return `<div class="mini-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(display))}</div></div>`;
}

function miniStatText(label, display) {
  const value = display === null || display === undefined || display === '' ? 'No data' : String(display);
  return `<div class="mini-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function getDashboardChartTooltip() {
  let tooltip =
    document.getElementById(
      'dashboardChartTooltip'
    );

  if (!tooltip) {
    tooltip =
      document.createElement('div');

    tooltip.id =
      'dashboardChartTooltip';

    tooltip.className =
      'dashboard-chart-tooltip';

    document.body.appendChild(
      tooltip
    );
  }

  return tooltip;
}


function showDashboardChartTooltip(
  event,
  title,
  rows
) {
  const tooltip =
    getDashboardChartTooltip();

  tooltip.innerHTML = `
    <div class="chart-tooltip-title">
      ${escapeHtml(title)}
    </div>

    ${rows
      .map(
        ([label, value]) => `
          <div class="chart-tooltip-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
          </div>
        `
      )
      .join('')}
  `;

  tooltip.classList.add(
    'visible'
  );

  let left =
    event.clientX + 14;

  let top =
    event.clientY + 14;

  const rect =
    tooltip.getBoundingClientRect();

  if (
    left + rect.width >
    window.innerWidth - 12
  ) {
    left =
      event.clientX -
      rect.width -
      14;
  }

  if (
    top + rect.height >
    window.innerHeight - 12
  ) {
    top =
      event.clientY -
      rect.height -
      14;
  }

  tooltip.style.left =
    `${Math.max(12, left)}px`;

  tooltip.style.top =
    `${Math.max(12, top)}px`;
}


function hideDashboardChartTooltip() {
  const tooltip =
    document.getElementById(
      'dashboardChartTooltip'
    );

  if (tooltip) {
    tooltip.classList.remove(
      'visible'
    );
  }
}

function renderTrendChart(id, key) {
  const el = $(id);

  const series =
    state.dataMaps.supply?.get(key) ||
    [];


  if (!series.length) {
    el.innerHTML = `
      <div class="no-data">
        No annual production series was found
        for this jurisdiction.
      </div>
    `;
    return;
  }


  const data = series
    .map(d => ({
      year: Number(d.year),

      proposed:
        isNum(d.proposed)
          ? Number(d.proposed)
          : null,

      approved:
        isNum(d.approved)
          ? Number(d.approved)
          : null,

      permitted:
        isNum(d.permitted)
          ? Number(d.permitted)
          : null,

      completed:
        isNum(d.completed)
          ? Number(d.completed)
          : null,
    }))
    .filter(d =>
      isNum(d.year)
    )
    .sort(
      (a, b) =>
        a.year - b.year
    );


  const seriesMeta = [
    {
      key: 'proposed',
      label: 'Applications',
      color: '#6D7C8C',
      dash: '5 4',
    },
    {
      key: 'approved',
      label: 'Entitlements',
      color: '#C69214',
      dash: '3 3',
    },
    {
      key: 'permitted',
      label: 'Building permits',
      color: '#00629B',
      dash: null,
    },
    {
      key: 'completed',
      label: 'Completed units',
      color: '#00A6B6',
      dash: null,
    },
  ];


  const availableSeries =
    seriesMeta.filter(meta =>
      data.some(d =>
        isNum(d[meta.key])
      )
    );


  if (!availableSeries.length) {
    el.innerHTML = `
      <div class="no-data">
        No annual production values were
        found for this jurisdiction.
      </div>
    `;
    return;
  }


  el.innerHTML = '';


  const width =
    Math.max(
      650,
      el.clientWidth || 650
    );

  const height =
    Math.max(
      290,
      el.clientHeight || 310
    );


  const margin = {
    top: 48,
    right: 22,
    bottom: 52,
    left: 66,
  };


  const innerWidth =
    width -
    margin.left -
    margin.right;

  const innerHeight =
    height -
    margin.top -
    margin.bottom;


  const svg =
    d3
      .select(el)
      .append('svg')
      .attr(
        'width',
        '100%'
      )
      .attr(
        'height',
        '100%'
      )
      .attr(
        'viewBox',
        `0 0 ${width} ${height}`
      )
      .attr(
        'role',
        'img'
      )
      .attr(
        'aria-label',
        'Housing production pipeline over time'
      );


  const plot =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          ${margin.top}
        )`
      );


  const years =
    data.map(d => d.year);


  const x =
    d3
      .scalePoint()
      .domain(years)
      .range([
        0,
        innerWidth,
      ])
      .padding(0.25);


  const allValues = [];

  data.forEach(d => {
    availableSeries.forEach(
      meta => {
        if (
          isNum(d[meta.key])
        ) {
          allValues.push(
            Number(d[meta.key])
          );
        }
      }
    );
  });


  const y =
    d3
      .scaleLinear()
      .domain([
        0,
        d3.max(allValues) ||
          1,
      ])
      .nice()
      .range([
        innerHeight,
        0,
      ]);


  /* Horizontal grid */
  plot
    .append('g')
    .attr(
      'class',
      'chart-grid'
    )
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(
          -innerWidth
        )
        .tickFormat('')
    );


  /* Y axis */
  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat(
          d =>
            compactNumber(d)
        )
    );


  /* X axis */
  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .attr(
      'transform',
      `translate(
        0,
        ${innerHeight}
      )`
    )
    .call(
      d3
        .axisBottom(x)
        .tickSizeOuter(0)
    );


  /* Axis titles */
  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'text-anchor',
      'middle'
    )
    .attr(
      'x',
      margin.left +
        innerWidth / 2
    )
    .attr(
      'y',
      height - 7
    )
    .text(
      'APR reporting year'
    );


  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'text-anchor',
      'middle'
    )
    .attr(
      'transform',
      `translate(
        15,
        ${
          margin.top +
          innerHeight / 2
        }
      )
      rotate(-90)`
    )
    .text(
      'Housing units'
    );


  /*
    Highlight the reporting year selected
    in the dashboard.
  */
  if (
    x(state.selectedYear) !==
    undefined
  ) {
    plot
      .append('line')
      .attr(
        'x1',
        x(state.selectedYear)
      )
      .attr(
        'x2',
        x(state.selectedYear)
      )
      .attr(
        'y1',
        0
      )
      .attr(
        'y2',
        innerHeight
      )
      .attr(
        'stroke',
        '#B8C5CF'
      )
      .attr(
        'stroke-dasharray',
        '3 4'
      );
  }


  const active =
    new Set(
      availableSeries.map(
        d => d.key
      )
    );


  const line =
    keyName =>
      d3
        .line()
        .defined(d =>
          isNum(
            d[keyName]
          )
        )
        .x(d =>
          x(d.year)
        )
        .y(d =>
          y(d[keyName])
        );


  availableSeries.forEach(
    meta => {

      plot
        .append('path')
        .datum(data)
        .attr(
          'class',
          `trend-series trend-${meta.key}`
        )
        .attr(
          'data-series',
          meta.key
        )
        .attr(
          'fill',
          'none'
        )
        .attr(
          'stroke',
          meta.color
        )
        .attr(
          'stroke-width',
          2.5
        )
        .attr(
          'stroke-linejoin',
          'round'
        )
        .attr(
          'stroke-linecap',
          'round'
        )
        .attr(
          'stroke-dasharray',
          meta.dash
        )
        .attr(
          'd',
          line(meta.key)
        );


      const pointData =
        data.filter(d =>
          isNum(
            d[meta.key]
          )
        );


      plot
        .selectAll(
          `.point-${meta.key}`
        )
        .data(pointData)
        .enter()
        .append('circle')
        .attr(
          'class',
          `chart-hover-point point-${meta.key}`
        )
        .attr(
          'data-series',
          meta.key
        )
        .attr(
          'cx',
          d => x(d.year)
        )
        .attr(
          'cy',
          d =>
            y(d[meta.key])
        )
        .attr(
          'r',
          4
        )
        .attr(
          'fill',
          '#FFFFFF'
        )
        .attr(
          'stroke',
          meta.color
        )
        .attr(
          'stroke-width',
          2
        )
        .on(
          'mouseenter',
          function(
            event,
            d
          ) {
            d3
              .select(this)
              .attr(
                'r',
                6
              );

            showDashboardChartTooltip(
              event,
              String(d.year),
              [
                [
                  meta.label,
                  fmtInt.format(
                    d[meta.key]
                  ),
                ],
              ]
            );
          }
        )
        .on(
          'mousemove',
          function(
            event,
            d
          ) {
            showDashboardChartTooltip(
              event,
              String(d.year),
              [
                [
                  meta.label,
                  fmtInt.format(
                    d[meta.key]
                  ),
                ],
              ]
            );
          }
        )
        .on(
          'mouseleave',
          function() {
            d3
              .select(this)
              .attr(
                'r',
                4
              );

            hideDashboardChartTooltip();
          }
        );
    }
  );


  /*
    Interactive legend.
    Clicking a legend item turns a series
    on or off without changing the data.
  */
  const legend =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          18
        )`
      );


  availableSeries.forEach(
    (meta, i) => {

      const item =
        legend
          .append('g')
          .attr(
            'class',
            'chart-legend-item'
          )
          .attr(
            'transform',
            `translate(
              ${i * 145},
              0
            )`
          )
          .on(
            'click',
            function() {
              if (
                active.has(
                  meta.key
                )
              ) {
                active.delete(
                  meta.key
                );
              } else {
                active.add(
                  meta.key
                );
              }

              svg
                .selectAll(
                  `[data-series="${meta.key}"]`
                )
                .style(
                  'display',
                  active.has(
                    meta.key
                  )
                    ? null
                    : 'none'
                );

              d3
                .select(this)
                .classed(
                  'disabled',
                  !active.has(
                    meta.key
                  )
                );
            }
          );


      item
        .append('line')
        .attr(
          'x1',
          0
        )
        .attr(
          'x2',
          20
        )
        .attr(
          'y1',
          0
        )
        .attr(
          'y2',
          0
        )
        .attr(
          'stroke',
          meta.color
        )
        .attr(
          'stroke-width',
          3
        )
        .attr(
          'stroke-dasharray',
          meta.dash
        );


      item
        .append('text')
        .attr(
          'x',
          27
        )
        .attr(
          'y',
          4
        )
        .text(
          meta.label
        );
    }
  );
}

function renderProductionTypeChart(
  id,
  key,
  year
) {
  const el = $(id);

  const byYear =
    state.dataMaps
      .productionType
      ?.get(key);

  const byType =
    byYear?.get(
      Number(year)
    );


  if (
    !byType ||
    !byType.size
  ) {
    el.innerHTML = `
      <div class="no-data">
        No housing-type production values
        were reported for this jurisdiction
        and year.
      </div>
    `;
    return;
  }


  const rows =
    [...byType.values()]
      .filter(
        d =>
          isNum(d.permitted) ||
          isNum(d.completed)
      )
      .map(d => ({
        label:
          String(
            d.housingType
          ).replace(
            /\s*\(combined\)\s*/i,
            ''
          ),

        fullLabel:
          d.housingType,

        permitted:
          Number(
            d.permitted ||
            0
          ),

        completed:
          Number(
            d.completed ||
            0
          ),
      }))
      .sort(
        (a, b) =>
          Math.max(
            b.permitted,
            b.completed
          ) -
          Math.max(
            a.permitted,
            a.completed
          )
      );


  if (!rows.length) {
    el.innerHTML = `
      <div class="no-data">
        No housing-type production
        values were reported.
      </div>
    `;
    return;
  }


  el.innerHTML = '';


  const width =
    Math.max(
      500,
      el.clientWidth || 500
    );

  const height =
    Math.max(
      280,
      el.clientHeight || 310
    );


  const margin = {
    top: 42,
    right: 55,
    bottom: 48,
    left: 175,
  };


  const innerWidth =
    width -
    margin.left -
    margin.right;

  const innerHeight =
    height -
    margin.top -
    margin.bottom;


  const svg =
    d3
      .select(el)
      .append('svg')
      .attr(
        'width',
        '100%'
      )
      .attr(
        'height',
        '100%'
      )
      .attr(
        'viewBox',
        `0 0 ${width} ${height}`
      );


  const plot =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          ${margin.top}
        )`
      );


  const maxValue =
    d3.max(
      rows,
      d =>
        Math.max(
          d.permitted,
          d.completed
        )
    ) || 1;


  const x =
    d3
      .scaleLinear()
      .domain([
        0,
        maxValue,
      ])
      .nice()
      .range([
        0,
        innerWidth,
      ]);


  const y =
    d3
      .scaleBand()
      .domain(
        rows.map(
          d => d.label
        )
      )
      .range([
        0,
        innerHeight,
      ])
      .paddingInner(0.25);


  const ySub =
    d3
      .scaleBand()
      .domain([
        'Permitted',
        'Completed',
      ])
      .range([
        0,
        y.bandwidth(),
      ])
      .padding(0.10);


  /* Vertical grid */
  plot
    .append('g')
    .attr(
      'class',
      'chart-grid'
    )
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickSize(
          innerHeight
        )
        .tickFormat('')
    );


  /* Category axis */
  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .call(
      d3
        .axisLeft(y)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d =>
          d.length > 25
            ? `${d.slice(
                0,
                24
              )}…`
            : d
        )
    )
    .select('.domain')
    .remove();


  /* Value axis */
  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .attr(
      'transform',
      `translate(
        0,
        ${innerHeight}
      )`
    )
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(
          d =>
            compactNumber(d)
        )
        .tickSizeOuter(0)
    );


  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'x',
      margin.left +
        innerWidth / 2
    )
    .attr(
      'y',
      height - 6
    )
    .attr(
      'text-anchor',
      'middle'
    )
    .text(
      'Housing units'
    );


  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'x',
      8
    )
    .attr(
      'y',
      margin.top - 14
    )
    .text(
      'Housing type'
    );


  const stages = [
    {
      key: 'permitted',
      label: 'Permitted',
      color: '#00629B',
    },
    {
      key: 'completed',
      label: 'Completed',
      color: '#00A6B6',
    },
  ];


  stages.forEach(stage => {

    const bars =
      plot
        .selectAll(
          `.type-${stage.key}`
        )
        .data(rows)
        .enter()
        .append('rect')
        .attr(
          'class',
          `type-${stage.key}`
        )
        .attr(
          'x',
          0
        )
        .attr(
          'y',
          d =>
            y(d.label) +
            ySub(
              stage.label
            )
        )
        .attr(
          'height',
          ySub.bandwidth()
        )
        .attr(
          'width',
          d =>
            x(
              d[stage.key]
            )
        )
        .attr(
          'rx',
          1
        )
        .attr(
          'fill',
          stage.color
        )
        .attr(
          'opacity',
          0.88
        )
        .on(
          'mouseenter',
          function(
            event,
            d
          ) {
            d3
              .select(this)
              .attr(
                'opacity',
                1
              );

            showDashboardChartTooltip(
              event,
              d.fullLabel,
              [
                [
                  stage.label,
                  fmtInt.format(
                    d[stage.key]
                  ),
                ],
                [
                  'Reporting year',
                  year,
                ],
              ]
            );
          }
        )
        .on(
          'mousemove',
          function(
            event,
            d
          ) {
            showDashboardChartTooltip(
              event,
              d.fullLabel,
              [
                [
                  stage.label,
                  fmtInt.format(
                    d[stage.key]
                  ),
                ],
                [
                  'Reporting year',
                  year,
                ],
              ]
            );
          }
        )
        .on(
          'mouseleave',
          function() {
            d3
              .select(this)
              .attr(
                'opacity',
                0.88
              );

            hideDashboardChartTooltip();
          }
        );


    /*
      Exact number at end of each non-zero bar.
    */
    plot
      .selectAll(
        `.value-${stage.key}`
      )
      .data(
        rows.filter(
          d =>
            d[stage.key] > 0
        )
      )
      .enter()
      .append('text')
      .attr(
        'class',
        'bar-label'
      )
      .attr(
        'x',
        d =>
          x(
            d[stage.key]
          ) + 5
      )
      .attr(
        'y',
        d =>
          y(d.label) +
          ySub(
            stage.label
          ) +
          ySub.bandwidth() /
            2 +
          3
      )
      .text(
        d =>
          fmtInt.format(
            d[stage.key]
          )
      );
  });


  /* Legend */
  const legend =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          18
        )`
      );


  stages.forEach(
    (stage, i) => {

      const item =
        legend
          .append('g')
          .attr(
            'transform',
            `translate(
              ${i * 105},
              0
            )`
          );


      item
        .append('rect')
        .attr(
          'width',
          12
        )
        .attr(
          'height',
          12
        )
        .attr(
          'rx',
          1
        )
        .attr(
          'fill',
          stage.color
        );


      item
        .append('text')
        .attr(
          'x',
          18
        )
        .attr(
          'y',
          10
        )
        .attr(
          'class',
          'axis-label'
        )
        .style(
          'font-weight',
          700
        )
        .text(
          stage.label
        );
    }
  );
}

function renderStockTrend(
  id,
  key
) {
  const el = $(id);

  const benchmarks =
    state.dataMaps
      .benchmarks
      ?.get(key) ||
    [];

  const dofSeries =
    state.dataMaps
      .dof
      ?.get(key)
      ?.series ||
    [];


  const benchmarkPoints =
    benchmarks
      .map(d => ({
        year:
          Number(d.year),

        value:
          Number(d.value),

        kind:
          'benchmark',

        source:
          d.label ||
          'Census / ACS benchmark',
      }))
      .filter(
        d =>
          isNum(d.year) &&
          isNum(d.value)
      );


  const dofPoints =
    dofSeries
      .filter(d =>
        isNum(
          d.housingUnits
        )
      )
      .map(d => ({
        year:
          Number(d.year),

        value:
          Number(
            d.housingUnits
          ),

        kind:
          'dof',

        source:
          'California DOF E-5',
      }));


  const allPoints = [
    ...benchmarkPoints,
    ...dofPoints,
  ].sort(
    (a, b) =>
      a.year - b.year
  );


  if (!allPoints.length) {
    el.innerHTML = `
      <div class="no-data">
        No housing-stock series was found
        for this jurisdiction.
      </div>
    `;
    return;
  }


  el.innerHTML = '';


  const width =
    Math.max(
      650,
      el.clientWidth || 650
    );

  const height =
    Math.max(
      280,
      el.clientHeight || 300
    );


  const margin = {
    top: 45,
    right: 24,
    bottom: 50,
    left: 72,
  };


  const innerWidth =
    width -
    margin.left -
    margin.right;

  const innerHeight =
    height -
    margin.top -
    margin.bottom;


  const svg =
    d3
      .select(el)
      .append('svg')
      .attr(
        'width',
        '100%'
      )
      .attr(
        'height',
        '100%'
      )
      .attr(
        'viewBox',
        `0 0 ${width} ${height}`
      );


  const plot =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          ${margin.top}
        )`
      );


  const minYear =
    d3.min(
      allPoints,
      d => d.year
    );

  const maxYear =
    d3.max(
      allPoints,
      d => d.year
    );


  const x =
    d3
      .scaleLinear()
      .domain([
        minYear,
        maxYear,
      ])
      .range([
        0,
        innerWidth,
      ]);


  const maxValue =
    d3.max(
      allPoints,
      d => d.value
    ) || 1;


  const y =
    d3
      .scaleLinear()
      .domain([
        0,
        maxValue,
      ])
      .nice()
      .range([
        innerHeight,
        0,
      ]);


  /* Grid */
  plot
    .append('g')
    .attr(
      'class',
      'chart-grid'
    )
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(
          -innerWidth
        )
        .tickFormat('')
    );


  /* Y axis */
  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat(
          d =>
            compactNumber(d)
        )
    );


  /*
    Only use meaningful year ticks,
    rather than labeling every pixel.
  */
  const yearTicks =
    [...new Set(
      allPoints.map(
        d => d.year
      )
    )];


  plot
    .append('g')
    .attr(
      'class',
      'chart-axis'
    )
    .attr(
      'transform',
      `translate(
        0,
        ${innerHeight}
      )`
    )
    .call(
      d3
        .axisBottom(x)
        .tickValues(
          yearTicks
        )
        .tickFormat(
          d3.format('d')
        )
        .tickSizeOuter(0)
    );


  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'text-anchor',
      'middle'
    )
    .attr(
      'x',
      margin.left +
        innerWidth / 2
    )
    .attr(
      'y',
      height - 6
    )
    .text(
      'Year'
    );


  svg
    .append('text')
    .attr(
      'class',
      'chart-axis-title'
    )
    .attr(
      'text-anchor',
      'middle'
    )
    .attr(
      'transform',
      `translate(
        15,
        ${
          margin.top +
          innerHeight / 2
        }
      )
      rotate(-90)`
    )
    .text(
      'Total housing units'
    );


  const dofLine =
    d3
      .line()
      .x(d =>
        x(d.year)
      )
      .y(d =>
        y(d.value)
      );


  if (
    dofPoints.length > 1
  ) {
    plot
      .append('path')
      .datum(dofPoints)
      .attr(
        'fill',
        'none'
      )
      .attr(
        'stroke',
        '#00629B'
      )
      .attr(
        'stroke-width',
        2.75
      )
      .attr(
        'stroke-linejoin',
        'round'
      )
      .attr(
        'stroke-linecap',
        'round'
      )
      .attr(
        'd',
        dofLine
      );
  }


  /* DOF points */
  plot
    .selectAll(
      '.dof-stock-point'
    )
    .data(dofPoints)
    .enter()
    .append('circle')
    .attr(
      'class',
      'chart-hover-point dof-stock-point'
    )
    .attr(
      'cx',
      d => x(d.year)
    )
    .attr(
      'cy',
      d => y(d.value)
    )
    .attr(
      'r',
      4
    )
    .attr(
      'fill',
      '#FFFFFF'
    )
    .attr(
      'stroke',
      '#00629B'
    )
    .attr(
      'stroke-width',
      2.25
    )
    .on(
      'mouseenter mousemove',
      function(
        event,
        d
      ) {
        showDashboardChartTooltip(
          event,
          String(d.year),
          [
            [
              'Housing units',
              fmtInt.format(
                d.value
              ),
            ],
            [
              'Source',
              d.source,
            ],
          ]
        );
      }
    )
    .on(
      'mouseleave',
      hideDashboardChartTooltip
    );


  /*
    Benchmark values use diamonds so users
    can immediately distinguish them from
    annual DOF estimates.
  */
  plot
    .selectAll(
      '.benchmark-stock-point'
    )
    .data(
      benchmarkPoints
    )
    .enter()
    .append('path')
    .attr(
      'class',
      'chart-hover-point benchmark-stock-point'
    )
    .attr(
      'd',
      d3
        .symbol()
        .type(
          d3.symbolDiamond
        )
        .size(85)
    )
    .attr(
      'transform',
      d =>
        `translate(
          ${x(d.year)},
          ${y(d.value)}
        )`
    )
    .attr(
      'fill',
      '#C69214'
    )
    .attr(
      'stroke',
      '#FFFFFF'
    )
    .attr(
      'stroke-width',
      1.5
    )
    .on(
      'mouseenter mousemove',
      function(
        event,
        d
      ) {
        showDashboardChartTooltip(
          event,
          String(d.year),
          [
            [
              'Housing units',
              fmtInt.format(
                d.value
              ),
            ],
            [
              'Benchmark',
              d.source,
            ],
          ]
        );
      }
    )
    .on(
      'mouseleave',
      hideDashboardChartTooltip
    );


  /* Legend */
  const legend =
    svg
      .append('g')
      .attr(
        'transform',
        `translate(
          ${margin.left},
          18
        )`
      );


  const dofLegend =
    legend.append('g');

  dofLegend
    .append('line')
    .attr(
      'x1',
      0
    )
    .attr(
      'x2',
      20
    )
    .attr(
      'y1',
      0
    )
    .attr(
      'y2',
      0
    )
    .attr(
      'stroke',
      '#00629B'
    )
    .attr(
      'stroke-width',
      3
    );

  dofLegend
    .append('text')
    .attr(
      'x',
      27
    )
    .attr(
      'y',
      4
    )
    .attr(
      'class',
      'axis-label'
    )
    .style(
      'font-weight',
      700
    )
    .text(
      'DOF annual estimate'
    );


  const benchmarkLegend =
    legend
      .append('g')
      .attr(
        'transform',
        'translate(155,0)'
      );

  benchmarkLegend
    .append('path')
    .attr(
      'd',
      d3
        .symbol()
        .type(
          d3.symbolDiamond
        )
        .size(60)
    )
    .attr(
      'fill',
      '#C69214'
    );

  benchmarkLegend
    .append('text')
    .attr(
      'x',
      12
    )
    .attr(
      'y',
      4
    )
    .attr(
      'class',
      'axis-label'
    )
    .style(
      'font-weight',
      700
    )
    .text(
      'Census / ACS benchmark'
    );
}


function renderRhnaOverallDonut(id, stats) {
  const el = $(id);
  if (!el) return;

  const allocation = Number(stats.rhnaAllocation);
  const progress = Number(stats.rhnaProgress);
  if (!isNum(allocation) || allocation <= 0 || !isNum(progress)) {
    el.innerHTML = '<div class="no-data">No RHNA allocation/progress data available.</div>';
    return;
  }

  const credited = Math.max(0, Math.min(progress, allocation));
  const remaining = Math.max(0, allocation - credited);
  const pctValue = isNum(stats.rhnaPct) ? Number(stats.rhnaPct) : pct(progress, allocation);
  const data = [
    { label: 'Qualifying progress', value: credited, color: '#00629B' },
    { label: 'Allocation not yet met', value: remaining, color: '#DCE5EB' },
  ];

  const w = Math.max(230, el.clientWidth || 250);
  const h = Math.max(210, el.clientHeight || 220);
  const size = Math.min(w, h) - 34;
  const outer = size / 2;
  const inner = outer * 0.67;

  el.innerHTML = '';
  const svg = d3.select(el).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('role', 'img')
    .attr('aria-label', 'RHNA qualifying progress toward allocation');

  const g = svg.append('g').attr('transform', `translate(${w / 2},${h / 2 - 5})`);
  const arc = d3.arc().innerRadius(inner).outerRadius(outer);
  const pie = d3.pie().sort(null).value(d => d.value);

  g.selectAll('path').data(pie(data)).enter().append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', '#F2F5F7')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter mousemove', (event, d) => {
      showDashboardChartTooltip(event, d.data.label, [
        ['Units', fmtInt.format(d.data.value)],
        ['Share of allocation', `${fmt1.format((d.data.value / allocation) * 100)}%`],
      ]);
    })
    .on('mouseleave', hideDashboardChartTooltip);

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', -4)
    .attr('class', 'donut-value')
    .text(isNum(pctValue) ? `${fmtInt.format(pctValue)}%` : '—');

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 18)
    .attr('class', 'donut-label')
    .text('complete');

  svg.append('text')
    .attr('x', w / 2)
    .attr('y', h - 4)
    .attr('text-anchor', 'middle')
    .attr('class', 'donut-caption')
    .text(`${fmtInt.format(progress)} qualifying units reported`);
}

function renderRhnaTierChart(id, stats) {
  const el = $(id);
  if (!el) return;

  const colors = ['#182B49', '#00629B', '#00A6B6', '#C69214'];
  const tiers = [
    ['Very low', stats.rhnaTiers?.very_low],
    ['Low', stats.rhnaTiers?.low],
    ['Moderate', stats.rhnaTiers?.moderate],
    ['Above moderate', stats.rhnaTiers?.above_moderate],
  ].map(([label, tier], i) => ({
    label,
    color: colors[i],
    allocation: tier?.allocation,
    progress: tier?.progress,
    remaining: tier?.remaining,
    pct: isNum(tier?.pct) ? Number(tier.pct) : pct(tier?.progress, tier?.allocation),
  }));

  if (!tiers.some(d => isNum(d.allocation) || isNum(d.progress))) {
    el.innerHTML = '<div class="no-data">No income-tier RHNA fields were found for this jurisdiction.</div>';
    return;
  }

  const w = Math.max(520, el.clientWidth || 620);
  const h = Math.max(300, el.clientHeight || 320);
  const m = { top: 26, right: 104, bottom: 34, left: 132 };
  const innerW = Math.max(200, w - m.left - m.right);
  const rowStep = (h - m.top - m.bottom) / tiers.length;
  const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);

  const ticks = [0, 25, 50, 75, 100];
  svg.selectAll('.tier-grid').data(ticks).enter().append('line')
    .attr('x1', d => m.left + x(d)).attr('x2', d => m.left + x(d))
    .attr('y1', m.top - 4).attr('y2', h - m.bottom + 2)
    .attr('stroke', '#DCE3E8').attr('stroke-width', 1);

  svg.selectAll('.tier-tick').data(ticks).enter().append('text')
    .attr('x', d => m.left + x(d)).attr('y', h - 8)
    .attr('text-anchor', 'middle').attr('class', 'chart-axis-label')
    .text(d => `${d}%`);

  tiers.forEach((d, i) => {
    const y = m.top + i * rowStep + rowStep * 0.22;
    const barH = Math.min(24, rowStep * 0.34);
    const share = isNum(d.pct) ? Math.max(0, Number(d.pct)) : 0;
    const clamped = Math.min(100, share);

    svg.append('text').attr('x', m.left - 12).attr('y', y + 3)
      .attr('text-anchor', 'end').attr('class', 'tier-label').text(d.label);
    svg.append('text').attr('x', m.left - 12).attr('y', y + 19)
      .attr('text-anchor', 'end').attr('class', 'tier-subtext')
      .text(isNum(d.allocation) ? `${formatMaybe(d.progress)} / ${formatMaybe(d.allocation)} units` : 'No allocation data');

    svg.append('rect').attr('x', m.left).attr('y', y - barH / 2)
      .attr('width', innerW).attr('height', barH).attr('fill', '#E2E8EC');

    const filled = svg.append('rect').attr('x', m.left).attr('y', y - barH / 2)
      .attr('width', x(clamped)).attr('height', barH).attr('fill', d.color).style('cursor', 'pointer');

    filled.on('mouseenter mousemove', event => {
      showDashboardChartTooltip(event, d.label, [
        ['Allocation', formatMaybe(d.allocation)],
        ['Qualifying units', formatMaybe(d.progress)],
        ['Remaining need', formatMaybe(d.remaining)],
        ['Percent complete', isNum(d.pct) ? `${fmt1.format(d.pct)}%` : 'No data'],
      ]);
    }).on('mouseleave', hideDashboardChartTooltip);

    if (share > 100) {
      svg.append('path')
        .attr('d', d3.symbol().type(d3.symbolTriangle).size(70)())
        .attr('transform', `translate(${m.left + innerW},${y}) rotate(90)`)
        .attr('fill', '#FFCD00').attr('stroke', '#182B49').attr('stroke-width', 0.8);
    }

    svg.append('text').attr('x', m.left + innerW + 12).attr('y', y + 5)
      .attr('class', 'tier-value').text(isNum(d.pct) ? `${fmt1.format(d.pct)}%` : '—');
  });
}

function renderRhnaPipelineChart(id, stats) {
  const el = $(id);
  if (!el) return;

  const rows = [
    { label: 'Applications', value: stats.proposed, color: '#6D7C8C' },
    { label: 'Entitlements', value: stats.approved, color: '#C69214' },
    { label: 'Permits', value: stats.permitted, color: '#00629B' },
    { label: 'Completed', value: stats.completed, color: '#00A6B6' },
  ];

  if (!rows.some(d => isNum(d.value))) {
    el.innerHTML = '<div class="no-data">No annual development-stage values were found for this jurisdiction.</div>';
    return;
  }

  const w = Math.max(520, el.clientWidth || 620);
  const h = Math.max(300, el.clientHeight || 320);
  const m = { top: 26, right: 18, bottom: 62, left: 64 };
  const innerW = w - m.left - m.right;
  const innerH = h - m.top - m.bottom;
  const x = d3.scaleBand().domain(rows.map(d => d.label)).range([0, innerW]).padding(0.38);
  const maxV = d3.max(rows, d => Number(d.value || 0)) || 1;
  const y = d3.scaleLinear().domain([0, maxV]).nice().range([innerH, 0]);

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  g.append('g').attr('class', 'chart-grid').call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat(''));
  g.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).ticks(4).tickFormat(compactNumber));
  g.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(10)).select('.domain').remove();

  g.selectAll('.pipeline-bar').data(rows).enter().append('rect')
    .attr('class', 'pipeline-bar')
    .attr('x', d => x(d.label)).attr('width', x.bandwidth())
    .attr('y', d => isNum(d.value) ? y(Number(d.value)) : innerH)
    .attr('height', d => isNum(d.value) ? innerH - y(Number(d.value)) : 0)
    .attr('fill', d => d.color).attr('opacity', 0.9)
    .style('cursor', 'pointer')
    .on('mouseenter mousemove', (event, d) => {
      showDashboardChartTooltip(event, d.label, [
        ['Units', formatMaybe(d.value)],
        ['APR reporting year', state.selectedYear],
      ]);
    }).on('mouseleave', hideDashboardChartTooltip);

  g.selectAll('.pipeline-value').data(rows.filter(d => isNum(d.value))).enter().append('text')
    .attr('x', d => x(d.label) + x.bandwidth() / 2)
    .attr('y', d => y(Number(d.value)) - 8)
    .attr('text-anchor', 'middle').attr('class', 'bar-label')
    .text(d => fmtInt.format(Number(d.value)));

  svg.append('text').attr('x', 14).attr('y', m.top + innerH / 2)
    .attr('transform', `rotate(-90,14,${m.top + innerH / 2})`)
    .attr('text-anchor', 'middle').attr('class', 'chart-axis-title').text('Housing units');
}

function burdenSegments(row) {
  if (!isNum(row?.burden)) return null;
  const burden = Math.max(0, Math.min(100, Number(row.burden)));
  const severe = isNum(row.severe) ? Math.max(0, Math.min(burden, Number(row.severe))) : 0;
  return {
    severe,
    moderate: Math.max(0, burden - severe),
    notBurdened: Math.max(0, 100 - burden),
  };
}

function renderBurdenCompositionChart(id, rows, options = {}) {
  const el = $(id);
  if (!el) return;
  const valid = rows.map(row => ({ ...row, segments: burdenSegments(row) })).filter(d => d.segments);
  if (!valid.length) {
    el.innerHTML = '<div class="no-data">No cost-burden percentages were found for this jurisdiction.</div>';
    return;
  }

  const w = Math.max(520, el.clientWidth || 620);
  const h = options.compact ? 170 : Math.max(220, 86 + valid.length * 62);
  const m = { top: 54, right: 54, bottom: 34, left: options.compact ? 150 : 122 };
  const innerW = w - m.left - m.right;
  const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
  const colors = { severe: '#182B49', moderate: '#C69214', notBurdened: '#DCE5EB' };
  const labels = { severe: 'Severe burden (>50%)', moderate: 'Burdened 30–50%', notBurdened: 'Not burdened' };

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);

  const legend = svg.append('g').attr('transform', `translate(${m.left},18)`);
  [['severe', 'Severe burden'], ['moderate', 'Burdened 30–50%'], ['notBurdened', 'Not burdened']].forEach(([key, label], i) => {
    const item = legend.append('g').attr('transform', `translate(${i * 150},0)`);
    item.append('rect').attr('width', 12).attr('height', 12).attr('fill', colors[key]);
    item.append('text').attr('x', 18).attr('y', 10).attr('class', 'chart-legend-label').text(label);
  });

  const rowStep = (h - m.top - m.bottom) / valid.length;
  valid.forEach((row, i) => {
    const y = m.top + i * rowStep + rowStep * 0.16;
    const barH = Math.min(30, rowStep * 0.45);
    svg.append('text').attr('x', m.left - 12).attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'end').attr('class', 'burden-row-label').text(row.label);

    let cursor = m.left;
    ['severe', 'moderate', 'notBurdened'].forEach(key => {
      const value = row.segments[key];
      const width = x(value);
      const rect = svg.append('rect').attr('x', cursor).attr('y', y).attr('width', width)
        .attr('height', barH).attr('fill', colors[key]).style('cursor', 'pointer');
      rect.on('mouseenter mousemove', event => {
        showDashboardChartTooltip(event, row.label, [
          [labels[key], `${fmt1.format(value)}%`],
          ['Total cost burden', `${fmt1.format(Number(row.burden))}%`],
        ]);
      }).on('mouseleave', hideDashboardChartTooltip);
      cursor += width;
    });

    svg.append('text').attr('x', m.left + innerW + 10).attr('y', y + barH / 2 + 4)
      .attr('class', 'burden-total-label').text(`${fmt1.format(Number(row.burden))}%`);
  });

  [0, 25, 50, 75, 100].forEach(t => {
    svg.append('text').attr('x', m.left + x(t)).attr('y', h - 8).attr('text-anchor', 'middle')
      .attr('class', 'chart-axis-label').text(`${t}%`);
  });
}

function renderAssistedRiskDonut(id, stats) {
  const el = $(id);
  if (!el) return;
  const total = Number(stats.assistedUnits);
  const atRisk = Number(stats.atRiskAssistedUnits);
  if (!isNum(total) || total <= 0 || !isNum(atRisk)) {
    el.innerHTML = '<div class="no-data">No assisted-unit preservation-risk total is available.</div>';
    return;
  }

  const risk = Math.max(0, Math.min(total, atRisk));
  const other = Math.max(0, total - risk);
  const riskPct = (risk / total) * 100;
  const w = Math.max(210, el.clientWidth || 230);
  const h = Math.max(200, el.clientHeight || 220);
  const radius = Math.min(w, h) / 2 - 28;
  const data = [
    { label: 'Units at risk', value: risk, color: '#C69214' },
    { label: 'Other assisted units', value: other, color: '#DCE5EB' },
  ];

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);
  const g = svg.append('g').attr('transform', `translate(${w / 2},${h / 2 - 5})`);
  const arc = d3.arc().innerRadius(radius * 0.66).outerRadius(radius);
  const pie = d3.pie().sort(null).value(d => d.value);

  g.selectAll('path').data(pie(data)).enter().append('path').attr('d', arc)
    .attr('fill', d => d.data.color).attr('stroke', '#F2F5F7').attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter mousemove', (event, d) => showDashboardChartTooltip(event, d.data.label, [['Units', fmtInt.format(d.data.value)]]))
    .on('mouseleave', hideDashboardChartTooltip);

  g.append('text').attr('text-anchor', 'middle').attr('y', -3).attr('class', 'donut-value').text(`${fmt1.format(riskPct)}%`);
  g.append('text').attr('text-anchor', 'middle').attr('y', 19).attr('class', 'donut-label').text('at risk');
  svg.append('text').attr('x', w / 2).attr('y', h - 4).attr('text-anchor', 'middle').attr('class', 'donut-caption')
    .text(`${fmtInt.format(risk)} of ${fmtInt.format(total)} assisted units`);
}

function relationshipData(kind) {
  return [...state.allKeys]
    .filter(key => key !== 'county san diego')
    .map(key => {
      const s = statsForKey(key, state.selectedYear);
      return {
        key,
        label: s.label || state.dataMaps.labels?.get(key) || titleCase(key),
        income: s.medianHouseholdIncome,
        rent: s.medianRent,
        rentToIncome: s.rentToIncomePct,
        renterBurden: s.rentBurdenShare,
        homeValue: s.medianHomeValue,
        ownerBurden: s.ownerBurdenShare,
      };
    })
    .filter(d => kind === 'rental'
      ? isNum(d.income) && isNum(d.rent)
      : isNum(d.income) && isNum(d.homeValue));
}

function renderRelationshipScatter(id, kind) {
  const el = $(id);
  if (!el) return;
  const rows = relationshipData(kind);
  if (!rows.length) {
    el.innerHTML = '<div class="no-data">No jurisdiction relationship data were found.</div>';
    return;
  }

  const isRental = kind === 'rental';
  const w = Math.max(760, el.clientWidth || 900);
  const h = Math.max(390, el.clientHeight || 420);
  const m = { top: 24, right: 36, bottom: 66, left: 92 };
  const innerW = w - m.left - m.right;
  const innerH = h - m.top - m.bottom;
  const xExtent = d3.extent(rows, d => Number(d.income));
  const yExtent = d3.extent(rows, d => Number(isRental ? d.rent : d.homeValue));
  const padX = Math.max(5000, (xExtent[1] - xExtent[0]) * 0.08);
  const padY = Math.max(isRental ? 100 : 50000, (yExtent[1] - yExtent[0]) * 0.08);
  const x = d3.scaleLinear().domain([Math.max(0, xExtent[0] - padX), xExtent[1] + padX]).nice().range([0, innerW]);
  const y = d3.scaleLinear().domain([Math.max(0, yExtent[0] - padY), yExtent[1] + padY]).nice().range([innerH, 0]);

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  g.append('g').attr('class', 'chart-grid').call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(''));
  g.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${compactNumber(d)}`));
  g.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => `$${compactNumber(d)}`));

  svg.append('text').attr('x', m.left + innerW / 2).attr('y', h - 10).attr('text-anchor', 'middle')
    .attr('class', 'chart-axis-title').text('Median household income');
  svg.append('text').attr('x', 18).attr('y', m.top + innerH / 2)
    .attr('transform', `rotate(-90,18,${m.top + innerH / 2})`).attr('text-anchor', 'middle')
    .attr('class', 'chart-axis-title').text(isRental ? '1BR median gross rent' : 'Median home value');

  const dots = g.selectAll('.relationship-dot').data(rows).enter().append('circle')
    .attr('class', 'relationship-dot')
    .attr('cx', d => x(Number(d.income)))
    .attr('cy', d => y(Number(isRental ? d.rent : d.homeValue)))
    .attr('r', d => d.key === state.selectedKey ? 8 : 5.5)
    .attr('fill', d => d.key === state.selectedKey ? '#FFCD00' : '#00629B')
    .attr('stroke', d => d.key === state.selectedKey ? '#182B49' : '#FFFFFF')
    .attr('stroke-width', d => d.key === state.selectedKey ? 2.5 : 1.5)
    .attr('opacity', d => d.key === state.selectedKey ? 1 : 0.72)
    .style('cursor', 'pointer');

  dots.on('mouseenter mousemove', (event, d) => {
    const details = isRental
      ? [['Median income', fmtMoney.format(d.income)], ['1BR median rent', fmtMoney.format(d.rent)], ['Rent-to-income', isNum(d.rentToIncome) ? `${fmt1.format(d.rentToIncome)}%` : 'No data'], ['Renter burden', isNum(d.renterBurden) ? `${fmt1.format(d.renterBurden)}%` : 'No data']]
      : [['Median income', fmtMoney.format(d.income)], ['Median home value', fmtMoney.format(d.homeValue)], ['Owner burden', isNum(d.ownerBurden) ? `${fmt1.format(d.ownerBurden)}%` : 'No data']];
    showDashboardChartTooltip(event, d.label, details);
  }).on('mouseleave', hideDashboardChartTooltip)
    .on('click', (_, d) => selectKey(d.key, false));

  const selected = rows.find(d => d.key === state.selectedKey);
  if (selected) {
    g.append('text')
      .attr('x', x(Number(selected.income)) + 11)
      .attr('y', y(Number(isRental ? selected.rent : selected.homeValue)) - 9)
      .attr('class', 'selected-point-label')
      .text(shortName(selected.label));
  }
}

function renderRentalRelationshipChart(id) {
  renderRelationshipScatter(id, 'rental');
}

function renderOwnershipRelationshipChart(id) {
  renderRelationshipScatter(id, 'ownership');
}

function riskRowsForKey(key) {
  if (key !== 'county san diego') return state.dataMaps.nhpdRisk?.get(key) || [];

  const byProgram = new Map();
  state.dataMaps.nhpdRisk?.forEach((rows, rowKey) => {
    if (rowKey === 'county san diego') return;
    rows.forEach(row => {
      const program = row.program || 'Program not reported';
      if (!byProgram.has(program)) byProgram.set(program, { program, expiringSubsidies: 0, assistedUnits: 0 });
      const target = byProgram.get(program);
      target.expiringSubsidies += Number(row.expiringSubsidies || 0);
      target.assistedUnits += Number(row.assistedUnits || 0);
    });
  });
  return [...byProgram.values()];
}

function renderPreservationRiskChart(id, key) {
  const el = $(id);
  if (!el) return;
  const rows = riskRowsForKey(key)
    .filter(d => isNum(d.assistedUnits) || isNum(d.expiringSubsidies))
    .sort((a, b) => Number(b.assistedUnits || 0) - Number(a.assistedUnits || 0))
    .slice(0, 7);

  if (!rows.length) {
    el.innerHTML = '<div class="no-data">No active subsidy expiration records were found within the five-year risk window for this jurisdiction.</div>';
    return;
  }

  const w = Math.max(460, el.clientWidth || 560);
  const h = Math.max(245, rows.length * 42 + 28);
  const m = { top: 16, right: 64, bottom: 26, left: 150 };
  const innerW = Math.max(140, w - m.left - m.right);
  const maxV = d3.max(rows, d => Number(d.assistedUnits || 0)) || 1;
  const x = d3.scaleLinear().domain([0, maxV]).nice().range([0, innerW]);
  const y = d3.scaleBand().domain(rows.map(d => d.program)).range([m.top, h - m.bottom]).padding(0.36);

  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${w} ${h}`);

  rows.forEach(d => {
    const cy = y(d.program) + y.bandwidth() / 2;
    const value = Number(d.assistedUnits || 0);
    svg.append('text').attr('x', m.left - 12).attr('y', cy + 4).attr('text-anchor', 'end')
      .attr('class', 'axis-label').text(shortName(d.program));
    svg.append('line').attr('x1', m.left).attr('x2', m.left + x(value)).attr('y1', cy).attr('y2', cy)
      .attr('stroke', '#C8D2D9').attr('stroke-width', 3);
    const dot = svg.append('circle').attr('cx', m.left + x(value)).attr('cy', cy).attr('r', 7)
      .attr('fill', '#C69214').attr('stroke', '#FFFFFF').attr('stroke-width', 2).style('cursor', 'pointer');
    dot.on('mouseenter mousemove', event => showDashboardChartTooltip(event, d.program, [
      ['Assisted units with expiring subsidy', fmtInt.format(value)],
      ['Expiring subsidy records', formatMaybe(d.expiringSubsidies)],
    ])).on('mouseleave', hideDashboardChartTooltip);
    svg.append('text').attr('x', m.left + x(value) + 13).attr('y', cy + 4).attr('class', 'bar-label')
      .text(fmtInt.format(value));
  });
}

function renderRankChart(id, metricKey) {
  const el = $(id);

  const rows = [...state.allKeys]
    .filter(k => k !== 'county san diego')
    .map(k => ({
      key: k,
      label:
        state.dataMaps.labels.get(k) ||
        titleCase(k),
      value: metricValueForKey(
        k,
        state.selectedYear,
        metricKey
      ),
    }))
    .filter(d => isNum(d.value))
    .sort((a, b) => b.value - a.value);


  if (!rows.length) {
    el.innerHTML = `
      <div class="no-data">
        No ranking data was found for the selected metric.
      </div>
    `;
    return;
  }


  const w =
    el.clientWidth ||
    330;

  const h = Math.max(
    360,
    el.clientHeight || 560
  );


  const m = {
    top: 8,
    right: 48,
    bottom: 8,
    left: 118,
  };


  const innerWidth =
    Math.max(
      80,
      w - m.left - m.right
    );


  const usableHeight =
    Math.max(
      200,
      h - m.top - m.bottom
    );


  const rowStep =
    usableHeight / rows.length;


  const barHeight =
    Math.max(
      10,
      Math.min(
        17,
        rowStep * 0.56
      )
    );


  const x = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(
        rows,
        d => d.value
      ) || 1,
    ])
    .range([
      0,
      innerWidth,
    ]);


  el.innerHTML = `
    <svg
      class="chart-svg"
      width="100%"
      height="100%"
      viewBox="0 0 ${w} ${h}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Jurisdiction ranking"
    >

      ${rows.map((d, i) => {

        const rowY =
          m.top +
          i * rowStep;

        const barY =
          rowY +
          (
            rowStep -
            barHeight
          ) / 2;

        const textY =
          rowY +
          rowStep / 2 +
          3;

        const isSelected =
          d.key === state.selectedKey;

        const barWidth =
          Math.max(
            3,
            x(d.value)
          );


        return `
          <g
            class="
              rank-row
              ${isSelected
                ? 'rank-selected'
                : ''}
            "
            data-rank-key="${escapeHtml(d.key)}"
            tabindex="0"
            role="button"
            aria-label="
              Select ${escapeHtml(d.label)}
            "
          >

            <rect
              x="0"
              y="${rowY}"
              width="${w}"
              height="${rowStep}"
              fill="transparent"
            ></rect>


            <text
              class="axis-label"
              x="${m.left - 9}"
              y="${textY}"
              text-anchor="end"
            >
              ${escapeSvg(
                shortName(d.label)
              )}
            </text>


            <rect
              class="rank-bar"
              x="${m.left}"
              y="${barY}"
              width="${barWidth}"
              height="${barHeight}"
              rx="1"
              fill="#3E86B3"
              opacity="${
                isSelected
                  ? 1
                  : 0.82
              }"
            ></rect>


            <text
              class="bar-label"
              x="${
                m.left +
                barWidth +
                6
              }"
              y="${textY}"
            >
              ${formatMetricValue(
                d.value,
                metricKey
              )}
            </text>

          </g>
        `;

      }).join('')}

    </svg>
  `;


  el
    .querySelectorAll(
      '.rank-row'
    )
    .forEach(row => {

      row.addEventListener(
        'click',
        () => {

          const key =
            row.dataset.rankKey;

          if (key) {
            selectRankedJurisdiction(
              key
            );
          }

        }
      );


      row.addEventListener(
        'keydown',
        e => {

          if (
            e.key === 'Enter' ||
            e.key === ' '
          ) {

            e.preventDefault();

            const key =
              row.dataset.rankKey;

            if (key) {
              selectRankedJurisdiction(
                key
              );
            }

          }

        }
      );

    });
}

function selectRankedJurisdiction(key) {
  /*
    Use the normal selection path first.
    This updates every dashboard tab and rebuilds
    the map with the selected jurisdiction.
  */
  selectKey(
    key,
    true
  );


  /*
    selectKey() rebuilds the GeoJSON layer, so wait
    until the new layer exists before opening its popup.
  */
  setTimeout(() => {

    if (
      !state.boundaryLayer
    ) {
      return;
    }


    state.boundaryLayer
      .eachLayer(layer => {

        if (
          !layer.feature
        ) {
          return;
        }


        const layerKey =
          layer.feature
            .properties
            .__housing_key ||
          cleanKey(
            featureName(
              layer.feature
            )
          );


        if (
          layerKey === key
        ) {

          layer.setPopupContent(
            popupHtml(key)
          );

          layer.openPopup();

        }

      });

  }, 220);
}

function renderIncomeBars(id, stats) {
  const el = $(id);
  const tiers = [
    ['Very low', stats.rhnaTiers?.very_low],
    ['Low', stats.rhnaTiers?.low],
    ['Moderate', stats.rhnaTiers?.moderate],
    ['Above moderate', stats.rhnaTiers?.above_moderate],
  ].map(([label, tier]) => ({
    label,
    allocation: tier?.allocation,
    progress: tier?.progress,
    remaining: tier?.remaining,
    pct: tier?.pct,
  }));

  if (!tiers.some(d => isNum(d.allocation) || isNum(d.progress))) {
    el.innerHTML = '<div class="no-data">No income-tier RHNA fields were found for this jurisdiction.</div>';
    return;
  }

  const w = el.clientWidth || 300;
  const h = 176;
  const m = { top: 10, right: 54, bottom: 20, left: 98 };
  const x = d3.scaleLinear().domain([0, 100]).range([0, Math.max(40, w - m.left - m.right)]);

  el.innerHTML = `<svg class="chart-svg" width="100%" height="${h}" viewBox="0 0 ${w} ${h}">
    ${tiers.map((d, i) => {
      const y = m.top + i * 36;
      const share = isNum(d.pct) ? Math.max(0, Number(d.pct)) : pct(d.progress, d.allocation);
      const barShare = isNum(share) ? Math.min(100, share) : 0;
      return `<text class="axis-label" x="${m.left - 8}" y="${y + 18}" text-anchor="end">${escapeSvg(d.label)}</text>
      <rect x="${m.left}" y="${y}" width="${x(100)}" height="20" rx="1" fill="rgba(23,56,74,.10)"></rect>
      <rect x="${m.left}" y="${y}" width="${x(barShare)}" height="20" rx="1" fill="${i < 2 ? '#00629B' : i === 2 ? '#C69214' : '#00A6B6'}"></rect>
      <text class="bar-label" x="${m.left + x(100) + 7}" y="${y + 16}">${isNum(share) ? `${fmt1.format(share)}%` : '—'}</text>`;
    }).join('')}
  </svg>`;
}

function renderContextChart(id) {
  renderRankChart(id, 'permits_per_1k');
}
function popupHtml(key) {
  const s = statsForKey(key, state.selectedYear);

  return `
    <div class="popup-title">${escapeHtml(s.label)}</div>
    <div class="popup-subtitle">APR ${state.selectedYear} · Clicked jurisdiction</div>

    <div class="popup-grid">
      <div class="popup-metric">
        <div class="label">${escapeHtml(METRICS[state.metric].label)}</div>
        <div class="value">${formatMetricValue(metricValueForKey(key), state.metric)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">RHNA % complete</div>
        <div class="value">${formatMetricValue(s.rhnaPct, 'rhna_progress')}</div>
      </div>

      <div class="popup-metric">
        <div class="label">Permitted</div>
        <div class="value">${formatMaybe(s.permitted)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">Completed</div>
        <div class="value">${formatMaybe(s.completed)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">RHNA allocation</div>
        <div class="value">${formatMaybe(s.rhnaAllocation)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">Qualifying units</div>
        <div class="value">${formatMaybe(s.rhnaProgress)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">Population</div>
        <div class="value">${formatMaybe(s.population)}</div>
      </div>

      <div class="popup-metric">
        <div class="label">Median income</div>
        <div class="value">${formatMoneyMaybe(s.medianHouseholdIncome)}</div>
      </div>
    </div>

    <div class="popup-footer">
      Use “Production details” in the side panel for the full jurisdiction breakdown.
    </div>
  `;
}

function compactNumber(n) {
  if (!isNum(n)) return '—';
  n = Number(n);
  if (Math.abs(n) >= 1_000_000) return `${fmt1.format(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `${fmt1.format(n / 1_000)}k`;
  return fmtInt.format(n);
}
function compactValue(v, metricKey) {
  if (!isNum(v)) return '—';
  if (METRICS[metricKey].unit === '$') return `$${compactNumber(v).replace('.0', '')}`;
  if (METRICS[metricKey].unit === '%') return `${fmtInt.format(v)}%`;
  return compactNumber(v);
}
function formatMaybe(v) { return isNum(v) ? fmtInt.format(v) : 'No data'; }
function formatMoneyMaybe(v) { return isNum(v) ? fmtMoney.format(v) : 'No data'; }
function shortName(s) {
  const text = String(s)
    .replace(
      /^City of\s+/i,
      ''
    )
    .trim();


  if (
    /^Unincorporated San Diego County$/i
      .test(text)
  ) {
    return 'Unincorp. SD County';
  }


  if (
    text.length > 21
  ) {
    return (
      text.slice(
        0,
        20
      ) +
      '…'
    );
  }


  return text;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function escapeSvg(s) { return escapeHtml(s); }
function setStatus(msg) { $('mapStatus').textContent = msg; }

window.zoomToKey = zoomToKey;
init().catch(err => {
  console.error(err);
  setStatus('Dashboard failed to load. Check console and data paths.');
});
