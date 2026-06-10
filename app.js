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
    './data/processed/municipal_boundaries_wide.geojson',
    './data/processed/sd_municipal_boundaries_wide.geojson',
    './data/raw/Municipal_Boundaries.geojson',
    './data/raw/Municipal_Boundaries.geojson',
  ],
  countyBoundary: [
    './data/processed/sd_county_boundary.geojson',
    './data/raw/San_Diego_County_Boundary.geojson',
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
  kpi: [
    './data/processed/sd_kpi_latest_city.csv',
    './data/processed/sd_city_kpis_latest.csv',
    './data/processed/sd_kpi_city_scorecard.csv',
  ],
  rhna: [
    './data/processed/sd_rhna6_city_totals.csv',
    './data/processed/sd_rhna6_filtered.csv',
    './data/processed/rhna6_city_summary.csv',
    './data/processed/rhna6_city_totals.csv',
  ],
  aprSupply: [
    './data/processed/sd_apr_a2_city_year_supply.csv',
    './data/processed/sd_apr_a2_city_year_bp_co_totals.csv',
    './data/processed/apr_a2_city_year_supply.csv',
  ],
  permits: [
    './data/processed/sd_permits_housing_like_units_by_year.csv',
    './data/processed/sd_city_permits_units_by_year.csv',
    './data/processed/sd_permits_units_by_year.csv',
    './data/processed/sd_permits_count_by_year.csv',
  ],
  acs: [
    './data/processed/sd_acs_place_2023_summary_fixed.csv',
    './data/processed/sd_acs_place_2023_summary.csv',
    './data/processed/sd_acs_place_summary.csv',
  ],
  dof: [
    './data/processed/sd_dof_e5_city_year.csv',
    './data/processed/sd_dof_city_year.csv',
  ],
};

const CITY_FIELDS = [
  'jur_clean', 'jur_norm', '_jur_raw', 'jurisdiction_clean', 'jurisdiction_name',
  'jurisdiction', 'Jurisdiction', 'JURISDICTION', 'JURIS_NAME', 'JURISDICTION_NAME',
  'city', 'City', 'NAME', 'Name', 'place_name', 'Place Name', 'NAME10', 'Geography', 'geography'
];

const YEAR_FIELDS = ['year', 'YEAR', 'Year', 'report_year', 'REPORT_YEAR', 'calendar_year'];

const PALETTE = ['#F5F0E6', '#FFCD00', '#C69214', '#00C6D7', '#00629B', '#182B49'];
const NO_DATA_FILL = '#F5F0E6';

const METRICS = {
  rhna_progress: {
    label: 'RHNA progress',
    unit: '%',
    decimals: 0,
    description: 'Permitted units as a share of the 6th Cycle RHNA target.',
    caveat: 'RHNA/APR values are self-reported by jurisdictions and can lag the current year.',
    getter: stats => pct(stats.rhnaUnits, stats.rhnaTarget),
  },
  permitted_units: {
    label: 'Permitted units',
    unit: 'units',
    decimals: 0,
    description: 'Housing units with building permits or permit-like records in the selected year.',
    caveat: 'Permit definitions vary by source; use this as a supply signal rather than a final construction count.',
    getter: stats => stats.permitted,
  },
  completed_units: {
    label: 'Completed units',
    unit: 'units',
    decimals: 0,
    description: 'Units reported as completed or certificate-of-occupancy units in the selected year.',
    caveat: 'Completion records may be incomplete for the most recent year.',
    getter: stats => stats.completed,
  },
  approved_units: {
    label: 'Approved / pipeline units',
    unit: 'units',
    decimals: 0,
    description: 'Units approved, entitled, or otherwise in the near-term development pipeline.',
    caveat: 'Pipeline data can change as applications are revised, withdrawn, or reclassified.',
    getter: stats => stats.approved,
  },
  affordable_share: {
    label: 'Lower/moderate income share',
    unit: '%',
    decimals: 0,
    description: 'Share of tracked units assigned to very-low, low, or moderate income categories.',
    caveat: 'Income-category reporting depends on source fields and may not capture all affordability programs.',
    getter: stats => pct(stats.affordable, stats.affordable + stats.aboveModerate),
  },
  permits_per_1k: {
    label: 'Permits per 1,000 residents',
    unit: 'per 1k',
    decimals: 1,
    description: 'Permitted units normalized by population to support cross-city comparison.',
    caveat: 'Population denominators may come from ACS or DOF depending on which file is available.',
    getter: stats => ratio(stats.permitted, stats.population) * 1000,
  },
  housing_per_1k: {
    label: 'Housing units per 1,000 residents',
    unit: 'per 1k',
    decimals: 1,
    description: 'Existing housing stock normalized by population.',
    caveat: 'This is a broad stock measure and does not indicate affordability or unit size.',
    getter: stats => ratio(stats.housingUnits, stats.population) * 1000,
  },
  median_rent: {
    label: 'Median gross rent',
    unit: '$',
    decimals: 0,
    description: 'Median gross rent from ACS context data when available.',
    caveat: 'ACS estimates may have margins of error; avoid over-interpreting small differences.',
    getter: stats => stats.medianRent,
  },
  rent_burden: {
    label: 'Rent-burdened renter households',
    unit: '%',
    decimals: 0,
    description: 'Share of renter households spending at least 30% of income on rent when available.',
    caveat: 'ACS burden measures are estimates and should be interpreted with margins of error when published.',
    getter: stats => stats.rentBurdenShare,
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
    key, label,
    population: numFrom(latest, ['population_total', 'total_population', 'population', 'POPULATION', 'B01003_001E']),
    households: numFrom(latest, ['households', 'total_households', 'B11001_001E']),
    housingUnits: numFrom(latest, ['housing_units_total', 'housing_units', 'total_housing_units', 'B25001_001E']),
    renterHouseholds: numFrom(latest, ['renter_occupied', 'renter_households', 'B25003_003E']),
    ownerHouseholds: numFrom(latest, ['owner_occupied', 'owner_households', 'B25003_002E']),
    medianRent: numFrom(latest, ['median_gross_rent', 'gross_rent_median', 'B25064_001E', 'median_rent']),
    medianHomeValue: numFrom(latest, ['median_home_value', 'B25077_001E']),
    rentBurdenShare: numFrom(latest, ['rent_burden_share', 'rent_burdened_share', 'gross_rent_30_pct_share', 'rent_burden_pct']),
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
  const series = rows.map(row => ({
    year: detectYear(row),
    population: numFrom(row, ['population_total', 'population', 'total_population', 'POPULATION', 'Pop', 'pop']),
    housingUnits: numFrom(row, ['housing_units_total', 'housing_units', 'total_housing_units', 'housing_unit_estimate', 'HU', 'hu']),
  })).filter(d => isNum(d.year));
  return { key, label, series };
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
  return before || series[series.length - 1];
}

function aggregateCountyStats(year) {
  const stats = blankStats('county san diego', 'San Diego County');
  state.allKeys.forEach(key => {
    if (key === 'county san diego') return;
    const s = statsForKey(key, year, false);
    ['permitted', 'completed', 'approved', 'proposed', 'affordable', 'aboveModerate', 'rhnaUnits', 'rhnaTarget', 'population', 'housingUnits'].forEach(f => {
      if (isNum(s[f])) stats[f] = (stats[f] || 0) + Number(s[f]);
    });
  });
  const acsVals = [...state.allKeys].map(k => statsForKey(k, year, false)).filter(s => isNum(s.medianRent));
  if (acsVals.length) stats.medianRent = d3.median(acsVals, d => d.medianRent);
  const burdenVals = [...state.allKeys].map(k => statsForKey(k, year, false)).filter(s => isNum(s.rentBurdenShare));
  if (burdenVals.length) stats.rentBurdenShare = d3.mean(burdenVals, d => d.rentBurdenShare);
  return stats;
}

function blankStats(key, label) {
  return {
    key, label,
    permitted: null, completed: null, approved: null, proposed: null,
    affordable: null, aboveModerate: null,
    rhnaUnits: null, rhnaTarget: null, rhnaTiers: {},
    population: null, housingUnits: null, households: null, renterHouseholds: null,
    medianRent: null, medianHomeValue: null, rentBurdenShare: null,
  };
}

function statsForKey(key, year = state.selectedYear, allowCountyAggregate = true) {
  if (key === 'county san diego' && allowCountyAggregate) return aggregateCountyStats(year);
  const label = state.dataMaps.labels?.get(key) || titleCase(key);
  const stats = blankStats(key, label);

  const kpi = state.dataMaps.kpi?.get(key);
  if (kpi) Object.assign(stats, {
    permitted: kpi.permitted, completed: kpi.completed, approved: kpi.approved, proposed: kpi.proposed,
    affordable: kpi.affordable, aboveModerate: kpi.aboveModerate,
  });

  const supply = rowForYear(state.dataMaps.supply?.get(key), year);
  if (supply) {
    ['permitted', 'completed', 'approved', 'proposed', 'affordable', 'aboveModerate'].forEach(f => {
  if (isNum(supply[f])) stats[f] = supply[f];
});
  }

  const rhna = state.dataMaps.rhna?.get(key);
  if (rhna) {
    stats.rhnaUnits = rhna.units;
    stats.rhnaTarget = rhna.target;
    stats.rhnaTiers = rhna.tiers || {};
  }

  const acs = state.dataMaps.acs?.get(key);
  if (acs) {
    ['population', 'housingUnits', 'households', 'renterHouseholds', 'medianRent', 'medianHomeValue', 'rentBurdenShare'].forEach(f => {
      if (isNum(acs[f])) stats[f] = acs[f];
    });
  }

  const dof = rowForYear(state.dataMaps.dof?.get(key)?.series, year);
  if (dof) {
    if (isNum(dof.population)) stats.population = dof.population;
    if (isNum(dof.housingUnits)) stats.housingUnits = dof.housingUnits;
  }

  return stats;
}

function formatMetricValue(value, metricKey = state.metric) {
  if (!isNum(value)) return 'No data';
  const meta = METRICS[metricKey];
  const n = Number(value);
  if (meta.unit === '$') return fmtMoney.format(n);
  if (meta.unit === '%') return `${fmtInt.format(n)}%`;
  if (meta.unit === 'per 1k') return fmt1.format(n);
  return fmtInt.format(n);
}

function metricValueForKey(key, year = state.selectedYear, metricKey = state.metric) {
  return METRICS[metricKey].getter(statsForKey(key, year));
}

const map = L.map('map', { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([32.84, -116.98], 10);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19,
}).addTo(map);
map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { pane: 'labels', maxZoom: 19 }).addTo(map);

async function init() {
  setupUi();
  setStatus('Loading source files…');

  const [
  geojson,
  countyGeojson,
  zoningBaseGeojson,
  zoningUnincorporatedGeojson,
  kpiRows,
  rhnaRows,
  aprRows,
  permitRows,
  acsRows,
  dofRows,
] = await Promise.all([
  loadFirst('Municipal/place boundaries', PATHS.boundaries, 'json'),
  loadFirst('County boundary', PATHS.countyBoundary, 'json'),
  loadFirst('SANDAG zoning base', PATHS.zoningBase, 'json'),
  loadFirst('SANDAG zoning unincorporated', PATHS.zoningUnincorporated, 'json'),
  loadFirst('KPI scorecard', PATHS.kpi, 'csv'),
  loadFirst('RHNA 6th Cycle', PATHS.rhna, 'csv'),
  loadFirst('APR supply by city/year', PATHS.aprSupply, 'csv'),
  loadFirst('City permit units by year', PATHS.permits, 'csv'),
  loadFirst('ACS place summary', PATHS.acs, 'csv'),
  loadFirst('DOF city/year estimates', PATHS.dof, 'csv'),
]);

  state.geojson = geojson;
  state.countyGeojson = countyGeojson;
  state.zoningBaseGeojson = zoningBaseGeojson;
  state.zoningUnincorporatedGeojson = zoningUnincorporatedGeojson;
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

  state.dataMaps.kpi = cityMapFromRows(kpiRows, reduceKpi);
  state.dataMaps.rhna = cityMapFromRows(rhnaRows, reduceRhna);
  state.dataMaps.acs = cityMapFromRows(acsRows, reduceAcs);
  state.dataMaps.dof = cityMapFromRows(dofRows, reduceDof);
  state.dataMaps.supply = mergeSupplyMaps(buildSupplySeries(aprRows), buildSupplySeries(permitRows));

  [state.dataMaps.kpi, state.dataMaps.rhna, state.dataMaps.acs, state.dataMaps.dof, state.dataMaps.supply].forEach(mapObj => {
    mapObj?.forEach((v, k) => {
      state.allKeys.add(k);
      if (!state.dataMaps.labels.has(k) && v?.label) state.dataMaps.labels.set(k, v.label);
    });
  });

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
  setStatus(`Loaded ${state.loadedFiles.length} data source${state.loadedFiles.length === 1 ? '' : 's'}.`);
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

function setupUi() {
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
      style: { color: '#17384A', weight: 2, fillOpacity: 0, dashArray: '5 4' },
      interactive: false,
    }).addTo(map);
  }

  if (state.geojson?.features) {
    state.boundaryLayer = L.geoJSON(state.geojson, {
      style: featureStyle,
      onEachFeature: (feature, layer) => {
        const key = feature.properties.__housing_key || cleanKey(featureName(feature));
        layer.on({
          mouseover: e => highlightFeature(e.target),
          mouseout: e => resetHighlight(e.target),
          click: () => selectKey(key),
        });
        layer.bindPopup(() => popupHtml(key));
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
    color: selected ? '#17212B' : (state.showOutlines ? 'rgba(23,56,74,0.58)' : 'rgba(23,56,74,0.08)'),
    weight: selected ? 3 : (state.showOutlines ? 1.25 : 0.35),
    fillColor: state.showChoro ? colorForValue(value) : '#FFFFFF',
    fillOpacity: state.showChoro ? (isNum(value) ? 0.74 : 0.22) : 0.04,
    opacity: 1,
  };
}

function highlightFeature(layer) {
  layer.setStyle({ weight: 3, color: '#17212B', fillOpacity: 0.86 });
  layer.bringToFront();
}
function resetHighlight(layer) {
  if (state.boundaryLayer) state.boundaryLayer.resetStyle(layer);
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
  // Render the visible overview pieces first so one off-page chart error
  // never leaves the main dashboard blank.
  safeRender('snapshot KPIs', renderSnapshot);
  safeRender('selected jurisdiction', renderLocationPanel);
  safeRender('overview ranking', () => renderRankChart('rankChart', state.metric));

  // Render secondary pages independently. These are allowed to fail silently
  // during early data loading without breaking the overview page.
  safeRender('drawer KPIs', renderDrawerKpis);
  safeRender('supply panel', renderSupplyPanel);
  safeRender('RHNA panel', renderRhnaPanel);
  safeRender('need panel', renderNeedPanel);

  requestAnimationFrame(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  });
}

function renderSnapshot() {
  const county = statsForKey('county san diego', state.selectedYear);

  const cards = [
    {
      label: 'RHNA progress',
      note: 'Share of 6th Cycle target',
      value: formatMetricValue(pct(county.rhnaUnits, county.rhnaTarget), 'rhna_progress'),
    },
    {
      label: 'Permitted units',
      note: 'New units permitted',
      value: formatMetricValue(county.permitted, 'permitted_units'),
    },
    {
      label: 'Completed units',
      note: 'Units completed',
      value: formatMetricValue(county.completed, 'completed_units'),
    },
    {
      label: 'Permits/1k residents',
      note: 'Per-capita supply signal',
      value: formatMetricValue(ratio(county.permitted, county.population) * 1000, 'permits_per_1k'),
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
  $('drawerKpis').innerHTML = [
    kpiHtml(METRICS[state.metric].label, formatMetricValue(metricValueForKey(state.selectedKey), state.metric), `${s.label} · ${state.selectedYear}`),
    kpiHtml('RHNA progress', formatMetricValue(pct(s.rhnaUnits, s.rhnaTarget), 'rhna_progress'), `${formatMaybe(s.rhnaUnits)} of ${formatMaybe(s.rhnaTarget)} target units`),
    kpiHtml('Permitted units', formatMetricValue(s.permitted, 'permitted_units'), 'Selected reporting year'),
    kpiHtml('Population', formatMaybe(s.population), 'ACS/DOF context when available'),
  ].join('');
}

function renderSupplyPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);

  $('supplyMiniStats').innerHTML = [
    miniStat('Proposed / submitted', s.proposed),
    miniStat('Approved / entitled', s.approved),
    miniStat('Permitted', s.permitted),
    miniStat('Completed', s.completed),
  ].join('');

  renderTrendChart('supplyTrend', state.selectedKey);
  renderRankChart('rankChart', state.metric);
}

function renderRhnaPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);
  $('rhnaSummary').innerHTML = [
    kpiHtml('Overall RHNA progress', formatMetricValue(pct(s.rhnaUnits, s.rhnaTarget), 'rhna_progress'), `${formatMaybe(s.rhnaUnits)} permitted units / ${formatMaybe(s.rhnaTarget)} target units`),
    kpiHtml('Lower/moderate income share', formatMetricValue(pct(s.affordable, safeAdd(s.affordable, s.aboveModerate)), 'affordable_share'), 'Based on income fields available in loaded data'),
  ].join('');
  renderIncomeBars('incomeBars', s);
}

function renderNeedPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);
  $('needStats').innerHTML = [
    miniStat('Population', s.population),
    miniStat('Housing units', s.housingUnits),
    miniStat('Housing / 1k residents', ratio(s.housingUnits, s.population) * 1000, '1'),
    miniStat('Median gross rent', s.medianRent, 'money'),
    miniStat('Rent burden', s.rentBurdenShare, 'percent'),
    miniStat('Median home value', s.medianHomeValue, 'money'),
  ].join('');
  renderContextChart('contextChart');
}

function renderLocationPanel() {
  const s = statsForKey(state.selectedKey, state.selectedYear);
  const zoomKey = String(state.selectedKey || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  $('locationPanel').innerHTML = `
    <div class="location-card-head">
      <div>
        <div class="section-heading">${escapeHtml(s.label)}</div>
        <p class="helper-text">Selected jurisdiction · ${state.selectedYear}</p>
      </div>
    </div>

    <div class="location-action-row">
      <button class="mini-btn location-zoom-btn" type="button" onclick="zoomToKey('${zoomKey}')">
        <i class="bi bi-house-door"></i> Zoom
      </button>

      <button class="mini-btn location-detail-btn" type="button" onclick="switchPanel('supply')">
        <i class="bi bi-bar-chart"></i> Supply details
      </button>
    </div>

    <div class="kpi-stack location-kpis">
      ${kpiHtml(METRICS[state.metric].label, formatMetricValue(metricValueForKey(state.selectedKey), state.metric), METRICS[state.metric].description)}
      ${kpiHtml('Permitted / completed', `${formatMaybe(s.permitted)} / ${formatMaybe(s.completed)}`, 'Permitted units compared with completed units')}
      ${kpiHtml('RHNA target', formatMaybe(s.rhnaTarget), `${formatMaybe(s.rhnaUnits)} units counted toward progress`)}
      ${kpiHtml('Market / need context', `${formatMaybe(s.population)} residents`, `${formatMoneyMaybe(s.medianRent)} median gross rent`)}
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
  if (kind === '1') display = isNum(value) ? fmt1.format(value) : 'No data';
  return `<div class="mini-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${display}</div></div>`;
}

function renderTrendChart(id, key) {
  const el = $(id);
  const series = state.dataMaps.supply?.get(key) || [];

  if (!series.length) {
    el.innerHTML = '<div class="no-data">No annual supply series was found for this jurisdiction. Check that the APR/permit city-year file has a recognizable city and year column.</div>';
    return;
  }

  const data = series
    .map(d => ({
      year: d.year,
      permitted: isNum(d.permitted) ? Number(d.permitted) : null,
      completed: isNum(d.completed) ? Number(d.completed) : null,
      approved: isNum(d.approved) ? Number(d.approved) : null,
    }))
    .filter(d => isNum(d.year));

  const hasPermitted = data.some(d => isNum(d.permitted));
  const hasCompleted = data.some(d => isNum(d.completed));
  const hasApproved = data.some(d => isNum(d.approved));

  if (!hasPermitted && !hasCompleted && !hasApproved) {
    el.innerHTML = '<div class="no-data">No permitted, completed, or approved annual values were found for this jurisdiction.</div>';
    return;
  }

  const w = el.clientWidth || 300;
  const h = 190;
  const m = { top: 18, right: 12, bottom: 28, left: 38 };

  const values = [];
  data.forEach(d => {
    ['permitted', 'completed', 'approved'].forEach(f => {
      if (isNum(d[f])) values.push(Number(d[f]));
    });
  });

  const maxY = d3.max(values) || 1;

  const x = d3.scalePoint()
    .domain(data.map(d => d.year))
    .range([m.left, w - m.right])
    .padding(0.4);

  const y = d3.scaleLinear()
    .domain([0, maxY])
    .nice()
    .range([h - m.bottom, m.top]);

  const makeLine = field => d3.line()
    .defined(d => isNum(d[field]))
    .x(d => x(d.year))
    .y(d => y(d[field]))(data);

  const legendItems = [];
  if (hasPermitted) legendItems.push(`<text x="${m.left}" y="14" fill="#00629B" font-size="11" font-weight="700">Permitted</text>`);
  if (hasCompleted) legendItems.push(`<text x="${m.left + 82}" y="14" fill="#00C6D7" font-size="11" font-weight="700">Completed</text>`);
  if (hasApproved) legendItems.push(`<text x="${m.left + 176}" y="14" fill="#C69214" font-size="11" font-weight="700">Approved</text>`);

  el.innerHTML = `
    <svg class="chart-svg" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
      <g>
        ${y.ticks(4).map(t => `
          <line x1="${m.left}" x2="${w - m.right}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(23,56,74,.10)"/>
          <text class="axis-label" x="${m.left - 7}" y="${y(t) + 4}" text-anchor="end">${compactNumber(t)}</text>
        `).join('')}
      </g>

      ${hasApproved ? `<path d="${makeLine('approved') || ''}" fill="none" stroke="#C69214" stroke-width="3" opacity=".85"/>` : ''}
      ${hasPermitted ? `<path d="${makeLine('permitted') || ''}" fill="none" stroke="#00629B" stroke-width="3"/>` : ''}
      ${hasCompleted ? `<path d="${makeLine('completed') || ''}" fill="none" stroke="#00C6D7" stroke-width="3"/>` : ''}

      ${data.map(d => `
        <text class="axis-label" x="${x(d.year)}" y="${h - 8}" text-anchor="middle">${String(d.year).slice(-2)}</text>
      `).join('')}

      ${legendItems.join('')}
    </svg>
  `;
}

function renderRankChart(id, metricKey) {
  const el = $(id);

  const rows = [...state.allKeys]
    .filter(k => k !== 'county san diego')
    .map(k => ({
      key: k,
      label: state.dataMaps.labels.get(k) || titleCase(k),
      value: metricValueForKey(k, state.selectedYear, metricKey),
    }))
    .filter(d => isNum(d.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (!rows.length) {
    el.innerHTML = '<div class="no-data">No ranking data was found for the selected metric.</div>';
    return;
  }

  const w = el.clientWidth || 300;
  const h = Math.max(210, rows.length * 28 + 28);
  const m = { top: 8, right: 42, bottom: 10, left: 106 };

  const x = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.value) || 1])
    .range([0, w - m.left - m.right]);

  el.innerHTML = `
    <svg class="chart-svg" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Top jurisdictions ranking">
      ${rows.map((d, i) => {
        const y = m.top + i * 28;
        const isSelected = d.key === state.selectedKey;
        const barWidth = Math.max(3, x(d.value));

        return `
          <g class="rank-row ${isSelected ? 'rank-selected' : ''}" data-rank-key="${escapeHtml(d.key)}" tabindex="0" role="button" aria-label="Select ${escapeHtml(d.label)}">
            <rect x="0" y="${y - 4}" width="${w}" height="26" fill="transparent"></rect>
            <text class="axis-label" x="${m.left - 9}" y="${y + 15}" text-anchor="end">${escapeSvg(shortName(d.label))}</text>
            <rect class="rank-bar" x="${m.left}" y="${y}" width="${barWidth}" height="18" rx="3" fill="#00629B" opacity="${isSelected ? 1 : 0.72}"></rect>
            <text class="bar-label" x="${m.left + barWidth + 7}" y="${y + 14}">${formatMetricValue(d.value, metricKey)}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;

  el.querySelectorAll('.rank-row').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.rankKey;
      if (key) selectKey(key, true);
    });

    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const key = row.dataset.rankKey;
        if (key) selectKey(key, true);
      }
    });
  });
}

function renderIncomeBars(id, stats) {
  const el = $(id);
  const tiers = [
    ['Very low', stats.rhnaTiers.vliUnits, stats.rhnaTiers.vliTarget],
    ['Low', stats.rhnaTiers.liUnits, stats.rhnaTiers.liTarget],
    ['Moderate', stats.rhnaTiers.modUnits, stats.rhnaTiers.modTarget],
    ['Above mod', stats.rhnaTiers.aboveUnits, stats.rhnaTiers.aboveTarget],
  ].map(([label, units, target]) => ({ label, units, target, pct: pct(units, target) }));
  if (!tiers.some(d => isNum(d.units) || isNum(d.target))) {
    el.innerHTML = '<div class="no-data">No income-tier RHNA fields were found for this area.</div>';
    return;
  }
  const w = el.clientWidth || 300, h = 170, m = { top: 10, right: 40, bottom: 26, left: 82 };
  const x = d3.scaleLinear().domain([0, Math.max(100, d3.max(tiers, d => d.pct) || 0)]).range([0, w - m.left - m.right]);
  el.innerHTML = `<svg class="chart-svg" width="100%" height="${h}" viewBox="0 0 ${w} ${h}">
    ${tiers.map((d, i) => {
      const y = m.top + i * 32;
      return `<text class="axis-label" x="${m.left - 8}" y="${y + 17}" text-anchor="end">${d.label}</text>
      <rect x="${m.left}" y="${y}" width="${x(100)}" height="20" rx="6" fill="rgba(23,56,74,.10)"></rect>
      <rect x="${m.left}" y="${y}" width="${isNum(d.pct) ? Math.min(x(d.pct), x(Math.max(100, d.pct))) : 0}" height="20" rx="6" fill="${i < 2 ? '#00629B' : i === 2 ? '#C69214' : '#00C6D7'}"></rect>
      <text class="bar-label" x="${m.left + x(100) + 7}" y="${y + 15}">${formatMetricValue(d.pct, 'rhna_progress')}</text>`;
    }).join('')}
  </svg>`;
}

function renderContextChart(id) {
  renderRankChart(id, 'permits_per_1k');
}

function popupHtml(key) {
  const s = statsForKey(key, state.selectedYear);
  return `<div class="popup-title">${escapeHtml(s.label)}</div>
    <div class="popup-grid">
      <div class="popup-metric"><div class="label">${escapeHtml(METRICS[state.metric].label)}</div><div class="value">${formatMetricValue(metricValueForKey(key), state.metric)}</div></div>
      <div class="popup-metric"><div class="label">Permitted</div><div class="value">${formatMaybe(s.permitted)}</div></div>
      <div class="popup-metric"><div class="label">RHNA</div><div class="value">${formatMetricValue(pct(s.rhnaUnits, s.rhnaTarget), 'rhna_progress')}</div></div>
      <div class="popup-metric"><div class="label">Population</div><div class="value">${formatMaybe(s.population)}</div></div>
    </div>`;
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
function shortName(s) { return String(s).replace(/^City of\s+/i, '').replace(/\s+City$/i, '').slice(0, 20); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function escapeSvg(s) { return escapeHtml(s); }
function setStatus(msg) { $('mapStatus').textContent = msg; }

window.zoomToKey = zoomToKey;
init().catch(err => {
  console.error(err);
  setStatus('Dashboard failed to load. Check console and data paths.');
});
