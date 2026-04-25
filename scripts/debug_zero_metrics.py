from pathlib import Path
import argparse
import re
import pandas as pd


SOURCE_FILES = {
    "apr_a2_supply": [
        "data/processed/sd_apr_a2_city_year_supply.csv",
        "data/processed/apr_a2_city_year_bp_co_totals.csv",
        "data/processed/sd_apr_a2_city_year_bp_co_totals.csv",
    ],
    "apr_a_table": [
        "data/processed/sd_apr_a_city_year_supply.csv",
        "data/processed/apr_a_city_year_supply.csv",
    ],
    "dof_population": [
        "data/processed/sd_dof_e5_city_year.csv",
    ],
    "acs_context": [
        "data/processed/sd_acs_place_2023_summary_fixed.csv",
    ],
    "rhna6": [
        "data/processed/sd_rhna6_city_totals.csv",
        "data/processed/sd_rhna6_filtered.csv",
        "data/processed/rhna6_city_summary.csv",
    ],
    "city_sd_permits": [
        "data/processed/sd_city_permits_units_by_year.csv",
        "data/processed/sd_permits_housing_like_units_by_year.csv",
        "data/processed/sd_permits_units_by_year.csv",
    ],
    "dashboard_kpis": [
        "data/processed/sd_kpi_city_scorecard.csv",
        "data/processed/sd_city_dashboard_kpis_latest_year.csv",
    ],
}


METRIC_ALIASES = {
    "proposed": [
        "proposed_units",
        "units_proposed",
        "submitted_units",
        "tot_proposed_units",
        "TOT_PROPOSED_UNITS",
        "proposed_total",
    ],
    "approved": [
        "approved_units",
        "units_approved",
        "tot_approved_units",
        "TOT_APPROVED_UNITS",
        "approved_total",
        "entitled_units",
        "pipeline_units",
    ],
    "permitted": [
        "permitted_units",
        "units_permitted",
        "bp_units_total",
        "bp_units",
        "BP_TOTAL_UNITS",
        "building_permit_units",
        "permits_units",
        "total_permitted_units",
    ],
    "completed": [
        "completed_units",
        "units_completed",
        "co_units_total",
        "co_units",
        "CO_TOTAL_UNITS",
        "certificate_of_occupancy_units",
    ],
    "adu": [
        "adu_units",
        "adu_total",
        "APPROVAL_ADU_TOTAL",
        "approval_adu_total",
        "bp_adu_units",
        "co_adu_units",
    ],
    "jadu": [
        "jadu_units",
        "jadu_total",
        "APPROVAL_JADU_TOTAL",
        "approval_jadu_total",
        "bp_jadu_units",
        "co_jadu_units",
    ],
    "population": [
        "population_total",
        "total_population",
        "population",
        "POPULATION",
    ],
    "housing_units": [
        "housing_units_total",
        "housing_units",
        "total_housing_units",
        "B25001_001E",
    ],
    "median_rent": [
        "median_gross_rent",
        "median_rent",
        "B25064_001E",
    ],
    "median_home_value": [
        "median_home_value",
        "home_value",
        "B25077_001E",
    ],
    "rent_burden": [
        "rent_burden",
        "rent_burden_pct",
        "cost_burdened_renters_pct",
    ],
}


CITY_COL_CANDIDATES = [
    "jur_clean",
    "_jur_key",
    "jurisdiction",
    "Jurisdiction",
    "JURISDICTION",
    "JURIS_NAME",
    "JURISDICTION_NAME",
    "city",
    "City",
    "NAME",
    "Name",
    "place_name",
    "Place Name",
    "Geography",
    "geography",
]


YEAR_COL_CANDIDATES = [
    "year",
    "YEAR",
    "Year",
    "reporting_year",
    "Reporting Year",
]


def find_repo_root(start: Path) -> Path:
    for p in [start] + list(start.parents):
        if (p / "data").exists():
            return p
    return start


def normalize_city(value) -> str:
    if pd.isna(value):
        return ""

    s = str(value).strip().lower()

    s = s.replace("city of ", "")
    s = s.replace(", california", "")
    s = s.replace(" california", "")
    s = s.replace(" town", "")
    s = s.replace(" city", "")

    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    replacements = {
        "san diego city": "san diego",
        "sd": "san diego",
        "national": "national city",
        "county san diego": "county san diego",
        "san diego county": "county san diego",
    }

    return replacements.get(s, s)


def pick_first_existing(columns, candidates):
    lower_to_real = {str(c).lower(): c for c in columns}
    for cand in candidates:
        if cand in columns:
            return cand
        if cand.lower() in lower_to_real:
            return lower_to_real[cand.lower()]
    return None


def find_source_file(repo: Path, candidates):
    for rel in candidates:
        p = repo / rel
        if p.exists():
            return p
    return None


def numeric_series(df, col):
    if col is None or col not in df.columns:
        return pd.Series(dtype="float64")
    return pd.to_numeric(df[col], errors="coerce")


def summarize_possible_columns(df, keywords):
    out = []
    for c in df.columns:
        cl = str(c).lower()
        if any(k in cl for k in keywords):
            vals = pd.to_numeric(df[c], errors="coerce")
            out.append({
                "column": c,
                "non_null_count": int(df[c].notna().sum()),
                "numeric_non_null_count": int(vals.notna().sum()),
                "sum_numeric": float(vals.sum(skipna=True)) if vals.notna().any() else None,
                "min_numeric": float(vals.min(skipna=True)) if vals.notna().any() else None,
                "max_numeric": float(vals.max(skipna=True)) if vals.notna().any() else None,
                "sample_values": "; ".join(map(str, df[c].dropna().head(5).tolist())),
            })
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--city", type=str, default="San Diego")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    out_dir = repo / "outputs" / "debug"
    out_dir.mkdir(parents=True, exist_ok=True)

    target_key = normalize_city(args.city)

    print(f"Repo root: {repo}")
    print(f"Selected city: {args.city} -> {target_key}")
    print(f"Selected year: {args.year}")
    print()

    audit_rows = []
    column_scan_rows = []
    selected_raw_rows_written = []

    for source_name, paths in SOURCE_FILES.items():
        path = find_source_file(repo, paths)

        if path is None:
            audit_rows.append({
                "source": source_name,
                "status": "missing_file",
                "path": "",
                "rows_total": 0,
                "rows_city": 0,
                "rows_city_year": 0,
                "city_col": "",
                "year_col": "",
                "metric": "",
                "matched_col": "",
                "value": "",
                "interpretation": "source file not found",
            })
            continue

        try:
            df = pd.read_csv(path)
        except Exception as e:
            audit_rows.append({
                "source": source_name,
                "status": "read_error",
                "path": str(path),
                "rows_total": 0,
                "rows_city": 0,
                "rows_city_year": 0,
                "city_col": "",
                "year_col": "",
                "metric": "",
                "matched_col": "",
                "value": "",
                "interpretation": f"could not read CSV: {e}",
            })
            continue

        city_col = pick_first_existing(df.columns, CITY_COL_CANDIDATES)
        year_col = pick_first_existing(df.columns, YEAR_COL_CANDIDATES)

        working = df.copy()

        if city_col:
            working["_debug_city_key"] = working[city_col].apply(normalize_city)
            city_rows = working[working["_debug_city_key"] == target_key].copy()
        else:
            city_rows = working.iloc[0:0].copy()

        if year_col and len(city_rows) > 0:
            city_rows["_debug_year_num"] = pd.to_numeric(city_rows[year_col], errors="coerce")
            city_year_rows = city_rows[city_rows["_debug_year_num"] == args.year].copy()
        else:
            city_year_rows = city_rows.copy()

        # Save exact selected rows so you can inspect them in Numbers/Excel.
        if len(city_year_rows) > 0:
            selected_out = out_dir / f"zero_debug_rows_{source_name}_{target_key.replace(' ', '_')}_{args.year}.csv"
            city_year_rows.to_csv(selected_out, index=False)
            selected_raw_rows_written.append(str(selected_out.relative_to(repo)))

        # Scan possible useful columns in the selected row set.
        scan_base = city_year_rows if len(city_year_rows) > 0 else city_rows
        if len(scan_base) > 0:
            keyword_groups = {
                "supply_keywords": ["proposed", "approved", "permit", "bp_", "completed", "co_", "adu", "jadu", "unit"],
                "context_keywords": ["pop", "housing", "rent", "value", "burden"],
                "rhna_keywords": ["rhna", "vli", "low", "mod", "above"],
            }

            for group, keywords in keyword_groups.items():
                for row in summarize_possible_columns(scan_base, keywords):
                    row.update({
                        "source": source_name,
                        "path": str(path),
                        "keyword_group": group,
                        "city_col": city_col or "",
                        "year_col": year_col or "",
                        "rows_scanned": len(scan_base),
                    })
                    column_scan_rows.append(row)

        for metric, aliases in METRIC_ALIASES.items():
            matched_col = pick_first_existing(df.columns, aliases)

            if len(city_year_rows) == 0:
                interpretation = "no row for selected city/year"
                value = ""
            elif matched_col is None:
                interpretation = "metric column not found in this source"
                value = ""
            else:
                vals = numeric_series(city_year_rows, matched_col)
                if vals.notna().sum() == 0:
                    interpretation = "column exists but value is blank or nonnumeric"
                    value = ""
                else:
                    value_num = vals.sum(skipna=True)
                    value = value_num
                    if value_num == 0:
                        interpretation = "TRUE ZERO if this is the intended source column; verify source definition"
                    else:
                        interpretation = "has nonzero value"

            audit_rows.append({
                "source": source_name,
                "status": "ok",
                "path": str(path),
                "rows_total": len(df),
                "rows_city": len(city_rows),
                "rows_city_year": len(city_year_rows),
                "city_col": city_col or "",
                "year_col": year_col or "",
                "metric": metric,
                "matched_col": matched_col or "",
                "value": value,
                "interpretation": interpretation,
            })

    audit = pd.DataFrame(audit_rows)
    scan = pd.DataFrame(column_scan_rows)

    audit_path = out_dir / f"zero_metric_audit_{target_key.replace(' ', '_')}_{args.year}.csv"
    scan_path = out_dir / f"zero_column_scan_{target_key.replace(' ', '_')}_{args.year}.csv"

    audit.to_csv(audit_path, index=False)
    scan.to_csv(scan_path, index=False)

    print("Wrote:")
    print(f"  - {audit_path.relative_to(repo)}")
    print(f"  - {scan_path.relative_to(repo)}")

    if selected_raw_rows_written:
        print()
        print("Also wrote exact selected source rows:")
        for p in selected_raw_rows_written:
            print(f"  - {p}")

    print()
    print("Quick view: metrics that are zero or missing")
    interesting = audit[
        audit["interpretation"].astype(str).str.contains(
            "ZERO|not found|blank|no row",
            case=False,
            na=False,
        )
    ].copy()

    cols = [
        "source",
        "metric",
        "rows_city_year",
        "matched_col",
        "value",
        "interpretation",
    ]

    if len(interesting) == 0:
        print("No zero/missing issues found.")
    else:
        print(interesting[cols].to_string(index=False))

    print()
    print("How to interpret:")
    print("  - 'no row for selected city/year' means the join/year filter has no record.")
    print("  - 'metric column not found' means app.js should not display 0; it should show No data.")
    print("  - 'column exists but blank' means the source has the field but not the value.")
    print("  - 'TRUE ZERO' means the raw source column summed to 0 for that city/year.")
    print("  - Open zero_column_scan_*.csv to see similarly named columns you may want to use instead.")


if __name__ == "__main__":
    main()