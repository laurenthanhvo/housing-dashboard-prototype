from pathlib import Path

APP = Path("app.js")

if not APP.exists():
    APP = Path("housing_powerbi_style_dashboard/app.js")

if not APP.exists():
    raise FileNotFoundError("Could not find app.js. Run this from your dashboard folder or repo root.")

text = APP.read_text()

replacements = [
    (
        """  boundaries: [
    './data/processed/sd_tiger_places.geojson',
    './data/processed/sd_municipal_boundaries.geojson',""",
        """  boundaries: [
    './data/processed/municipal_boundaries_with_rhna6.geojson',
    './data/processed/sd_municipal_boundaries_with_rhna6.geojson',
    './data/processed/sd_tiger_places.geojson',
    './data/processed/sd_municipal_boundaries.geojson',"""
    ),
    (
        """const CITY_FIELDS = [
  'jurisdiction', 'Jurisdiction', 'JURISDICTION', 'JURIS_NAME', 'JURISDICTION_NAME',
  'city', 'City', 'NAME', 'Name', 'place', 'Place', 'place_name', 'Geography', 'geography'
];""",
        """const CITY_FIELDS = [
  'jur_clean', 'jur_norm', '_jur_raw', 'jurisdiction_clean', 'jurisdiction_name',
  'jurisdiction', 'Jurisdiction', 'JURISDICTION', 'JURIS_NAME', 'JURISDICTION_NAME',
  'city', 'City', 'NAME', 'Name', 'place_name', 'Place Name', 'NAME10', 'Geography', 'geography'
];"""
    ),
    (
        """  if (s === 'san diego county' || s === 'county san diego') return 'county san diego';""",
        """  if (s === 's d county' || s === 'sd county' || s === 'san diego county' || s === 'county san diego') return 'county san diego';"""
    ),
    (
        """    population: numFrom(latest, ['total_population', 'population', 'POPULATION', 'B01003_001E']),""",
        """    population: numFrom(latest, ['population_total', 'total_population', 'population', 'POPULATION', 'B01003_001E']),"""
    ),
    (
        """    housingUnits: numFrom(latest, ['housing_units', 'total_housing_units', 'B25001_001E']),""",
        """    housingUnits: numFrom(latest, ['housing_units_total', 'housing_units', 'total_housing_units', 'B25001_001E']),"""
    ),
    (
        """    permitted: numFrom(latest, ['permitted_units', 'units_permitted', 'bp_units', 'building_permit_units', 'permits_units', 'total_permitted_units']),""",
        """    permitted: numFrom(latest, ['permitted_units', 'units_permitted', 'bp_units_total', 'bp_units', 'building_permit_units', 'permits_units', 'total_permitted_units']),"""
    ),
    (
        """    completed: numFrom(latest, ['completed_units', 'co_units', 'certificate_of_occupancy_units', 'units_completed']),""",
        """    completed: numFrom(latest, ['completed_units', 'co_units_total', 'co_units', 'certificate_of_occupancy_units', 'units_completed']),"""
    ),
    (
        """    approved: numFrom(latest, ['approved_units', 'pipeline_units', 'entitled_units', 'units_approved']),""",
        """    approved: numFrom(latest, ['approved_units', 'pipeline_units', 'entitled_units', 'units_approved', 'approved_total']),"""
    ),
    (
        """    proposed: numFrom(latest, ['proposed_units', 'submitted_units', 'units_proposed']),""",
        """    proposed: numFrom(latest, ['proposed_units', 'submitted_units', 'units_proposed', 'proposed_total']),"""
    ),
    (
        """    affordable: numFrom(latest, ['affordable_units', 'lower_income_units', 'vli_li_mod_units']),""",
        """    affordable: numFrom(latest, ['affordable_units', 'lower_income_units', 'vli_li_mod_units', 'bp_affordable_total', 'co_affordable_total']),"""
    ),
    (
        """    population: numFrom(row, ['population', 'total_population', 'POPULATION', 'Pop', 'pop']),""",
        """    population: numFrom(row, ['population_total', 'population', 'total_population', 'POPULATION', 'Pop', 'pop']),"""
    ),
    (
        """    housingUnits: numFrom(row, ['housing_units', 'total_housing_units', 'housing_unit_estimate', 'HU', 'hu']),""",
        """    housingUnits: numFrom(row, ['housing_units_total', 'housing_units', 'total_housing_units', 'housing_unit_estimate', 'HU', 'hu']),"""
    ),
    (
        """      numFrom(row, ['permitted_units', 'units_permitted', 'bp_units', 'building_permit_units', 'BP_TOTAL_UNITS']) ??""",
        """      numFrom(row, ['permitted_units', 'units_permitted', 'bp_units_total', 'bp_units', 'building_permit_units', 'BP_TOTAL_UNITS']) ??"""
    ),
    (
        """      numFrom(row, ['completed_units', 'co_units', 'certificate_of_occupancy_units', 'CO_TOTAL_UNITS']) ??""",
        """      numFrom(row, ['completed_units', 'co_units_total', 'co_units', 'certificate_of_occupancy_units', 'CO_TOTAL_UNITS']) ??"""
    ),
    (
        """      numFrom(row, ['affordable_units', 'lower_income_units', 'vli_li_mod_units']) ??""",
        """      numFrom(row, ['affordable_units', 'lower_income_units', 'vli_li_mod_units', 'bp_affordable_total', 'co_affordable_total']) ??"""
    ),
]

missing = []

for old, new in replacements:
    if old not in text:
        missing.append(old.splitlines()[0])
    else:
        text = text.replace(old, new)

backup = APP.with_suffix(".js.backup")
backup.write_text(APP.read_text())
APP.write_text(text)

print(f"Patched: {APP}")
print(f"Backup saved to: {backup}")

if missing:
    print("\nSome patterns were not found. That may be okay if you already edited the file.")
    print("Missing patterns:")
    for item in missing:
        print(" -", item)