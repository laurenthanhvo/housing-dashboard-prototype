#!/usr/bin/env python3
"""
Debug join coverage for the San Diego housing dashboard.

Run from your repo root:

    python scripts/debug_housing_dashboard_joins.py --year 2024 --city "Solana Beach"

Outputs are written to:

    outputs/debug/

This script does NOT modify your dashboard data. It only audits whether each processed
source can be joined to the canonical jurisdiction list used by the map/dashboard.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd


JURISDICTION_COLS = [
    "jurisdiction",
    "jurisdiction_name",
    "juris_name",
    "jur_name",
    "jur_clean",
    "city",
    "city_name",
    "place",
    "place_name",
    "name",
    "Name",
    "JURIS_NAME",
    "JURISDICTION",
    "JURISDICTION_NAME",
    "Jurisdiction",
    "GEO_NAME",
    "geoname",
]

YEAR_COLS = [
    "year",
    "YEAR",
    "reporting_year",
    "Reporting Year",
    "apr_year",
    "APR_YEAR",
]

# These are intentionally broad because your processed filenames may shift over time.
DATASET_PATTERNS = {
    "boundaries": [
        "data/processed/*municipal*boundar*.geojson",
        "data/processed/*city*boundar*.geojson",
        "data/processed/*tiger*places*.geojson",
        "data/raw/*Municipal_Boundaries*.geojson",
        "data/raw/*San_Diego*Count*y*Boun*.geojson",
    ],
    "rhna6": [
        "data/processed/*rhna6*city*total*.csv",
        "data/processed/*rhna6*filtered*.csv",
        "data/processed/rhna6_city_summary.csv",
    ],
    "rhna5": [
        "data/processed/*rhna5*city*summary*.csv",
        "data/processed/*rhna5*filtered*.csv",
    ],
    "apr_a2_supply": [
        "data/processed/*apr*a2*city*year*supply*.csv",
        "data/processed/*apr_a2*city*year*.csv",
        "data/processed/*a2*city*year*bp*.csv",
    ],
    "dof_population": [
        "data/processed/*dof*e5*city*year*.csv",
        "data/processed/*city*population*.csv",
    ],
    "acs_context": [
        "data/processed/*acs*place*summary*.csv",
        "data/processed/*acs*city*.csv",
    ],
    "city_sd_permits": [
        "data/processed/*permits*units*by_year*.csv",
        "data/processed/*city*permits*count*.csv",
        "data/processed/*city*permits*units*.csv",
    ],
    "dashboard_kpis": [
        "data/processed/*kpi*city*scorecard*.csv",
        "data/processed/*dashboard*kpis*.csv",
    ],
}

ALIASES = {
    "city of san diego": "san diego",
    "san diego city": "san diego",
    "san diego, city of": "san diego",
    "county of san diego": "county of san diego",
    "unincorporated san diego county": "county of san diego",
    "san diego county": "county of san diego",
}


def find_repo_root(start: Path) -> Path:
    for p in [start] + list(start.parents):
        if (p / "data").exists():
            return p
    raise FileNotFoundError("Could not find repo root. Run from a folder containing /data.")


def norm_col_name(c: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(c).strip().lower()).strip("_")


def canonical_jurisdiction(value) -> str:
    """Normalize jurisdiction names so joins can be audited consistently."""
    if pd.isna(value):
        return ""

    s = str(value).strip()
    if not s:
        return ""

    s = s.replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.lower()

    # Common Census/ACS suffixes.
    s = s.replace(", california", "")
    s = re.sub(r"\bcalifornia\b", " ", s)
    s = re.sub(r"\bca\b", " ", s)
    s = re.sub(r"\bcity\b$", " ", s)
    s = re.sub(r"\bcdp\b$", " ", s)
    s = re.sub(r"\bincorporated\b", " ", s)

    # Remove punctuation after preserving words.
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Handle aliases both before and after removing punctuation.
    if s in ALIASES:
        s = ALIASES[s]

    # Remove leading city of after punctuation normalization.
    s = re.sub(r"^city of ", "", s).strip()

    if s in ALIASES:
        s = ALIASES[s]

    return s


def first_existing_column(df: pd.DataFrame, candidates: Iterable[str]) -> Optional[str]:
    by_norm = {norm_col_name(c): c for c in df.columns}
    for cand in candidates:
        if cand in df.columns:
            return cand
        n = norm_col_name(cand)
        if n in by_norm:
            return by_norm[n]
    return None


def read_csv_safely(path: Path) -> pd.DataFrame:
    # dtype=str prevents leading-zero keys from being silently mangled.
    return pd.read_csv(path, dtype=str, low_memory=False)


def read_geojson_properties(path: Path) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    rows = []
    for feat in obj.get("features", []):
        rows.append(feat.get("properties", {}) or {})
    return pd.DataFrame(rows)


def load_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".geojson", ".json"}:
        return read_geojson_properties(path)
    return read_csv_safely(path)


def find_files(repo: Path, patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    for pat in patterns:
        files.extend(sorted(repo.glob(pat)))
    # de-dupe while preserving order
    seen = set()
    out = []
    for p in files:
        rp = p.resolve()
        if rp not in seen and p.is_file():
            seen.add(rp)
            out.append(p)
    return out


@dataclass
class SourceAudit:
    source: str
    path: str
    rows: int
    jurisdiction_col: str
    year_col: str
    unique_jurisdictions: int
    unmatched_jurisdictions: int
    duplicate_key_year_rows: int
    min_year: str
    max_year: str
    notes: str


def add_keys(df: pd.DataFrame, source: str) -> tuple[pd.DataFrame, str, str]:
    df = df.copy()
    jur_col = first_existing_column(df, JURISDICTION_COLS)

    # City of San Diego permit aggregate files are often year-only; assign city manually.
    if jur_col is None and "permit" in source.lower():
        df["_jur_raw"] = "San Diego"
        jur_col = "_jur_raw"
    elif jur_col is not None:
        df["_jur_raw"] = df[jur_col]
    else:
        df["_jur_raw"] = ""

    df["_jur_key"] = df["_jur_raw"].apply(canonical_jurisdiction)

    year_col = first_existing_column(df, YEAR_COLS)
    if year_col is not None:
        df["_year"] = pd.to_numeric(df[year_col], errors="coerce").astype("Int64")
    else:
        df["_year"] = pd.Series([pd.NA] * len(df), dtype="Int64")

    return df, jur_col or "", year_col or ""


def numeric_missingness(df: pd.DataFrame, source: str) -> pd.DataFrame:
    ignore = {"_jur_raw", "_jur_key", "_year"}
    rows = []
    for c in df.columns:
        if c in ignore:
            continue
        as_num = pd.to_numeric(df[c], errors="coerce")
        numeric_count = int(as_num.notna().sum())
        if numeric_count == 0:
            continue
        rows.append({
            "source": source,
            "column": c,
            "rows": len(df),
            "numeric_non_null": numeric_count,
            "numeric_null_or_non_numeric": int(len(df) - numeric_count),
            "numeric_non_null_pct": round(100 * numeric_count / max(len(df), 1), 2),
        })
    return pd.DataFrame(rows)


def year_range(df: pd.DataFrame) -> tuple[str, str]:
    years = pd.to_numeric(df.get("_year"), errors="coerce").dropna()
    if years.empty:
        return "", ""
    return str(int(years.min())), str(int(years.max()))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=None, help="Optional reporting year to audit coverage for, e.g. 2024")
    parser.add_argument("--city", type=str, default=None, help="Optional city to print/debug, e.g. 'Solana Beach'")
    parser.add_argument("--repo", type=str, default=None, help="Repo root. Defaults to current directory search.")
    args = parser.parse_args()

    repo = Path(args.repo).resolve() if args.repo else find_repo_root(Path.cwd())
    out_dir = repo / "outputs" / "debug"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Repo root: {repo}")
    print(f"Debug outputs: {out_dir}")

    # Load all discovered sources.
    loaded: dict[str, dict] = {}
    for source, patterns in DATASET_PATTERNS.items():
        files = find_files(repo, patterns)
        if not files:
            print(f"[WARN] No files found for {source}")
            continue

        # Prefer the first match for each source group. If you have multiple versions,
        # this makes duplicates obvious in the output so you can tighten the pattern.
        path = files[0]
        try:
            raw = load_table(path)
            keyed, jur_col, year_col = add_keys(raw, source)
            loaded[source] = {
                "path": path,
                "df": keyed,
                "jur_col": jur_col,
                "year_col": year_col,
                "all_matches": files,
            }
            print(f"[OK] {source}: {path} ({len(keyed):,} rows)")
            if len(files) > 1:
                print("     Other matches:")
                for extra in files[1:5]:
                    print(f"       - {extra}")
        except Exception as e:
            print(f"[ERROR] Could not load {source}: {path}\n  {e}")

    if not loaded:
        raise SystemExit("No dashboard sources found.")

    # Canonical jurisdiction list: prefer boundaries, then RHNA6, then all sources combined.
    canonical_source = None
    if "boundaries" in loaded and loaded["boundaries"]["df"]["_jur_key"].replace("", pd.NA).notna().any():
        canonical_source = "boundaries"
    elif "rhna6" in loaded:
        canonical_source = "rhna6"

    if canonical_source:
        canonical = loaded[canonical_source]["df"][["_jur_key", "_jur_raw"]].copy()
        canonical = canonical[canonical["_jur_key"] != ""]
        canonical = canonical.drop_duplicates("_jur_key")
        canonical = canonical.rename(columns={"_jur_raw": "canonical_name"})
    else:
        frames = []
        for v in loaded.values():
            frames.append(v["df"][["_jur_key", "_jur_raw"]])
        canonical = pd.concat(frames, ignore_index=True)
        canonical = canonical[canonical["_jur_key"] != ""].drop_duplicates("_jur_key")
        canonical = canonical.rename(columns={"_jur_raw": "canonical_name"})
        canonical_source = "all_sources"

    canonical_keys = set(canonical["_jur_key"].dropna().astype(str))
    canonical.to_csv(out_dir / "canonical_jurisdictions.csv", index=False)

    audits: list[SourceAudit] = []
    unmatched_rows = []
    coverage = canonical.copy()
    metric_missingness_frames = []

    for source, info in loaded.items():
        df = info["df"].copy()
        if args.year is not None and df["_year"].notna().any():
            year_df = df[df["_year"] == args.year].copy()
        else:
            year_df = df.copy()

        unique_keys = sorted(k for k in df["_jur_key"].dropna().unique() if k)
        unmatched = sorted(k for k in unique_keys if k not in canonical_keys)

        for key in unmatched:
            examples = df.loc[df["_jur_key"] == key, "_jur_raw"].dropna().astype(str).unique()[:5]
            unmatched_rows.append({
                "source": source,
                "path": str(info["path"]),
                "jur_key": key,
                "raw_examples": " | ".join(examples),
            })

        if df["_year"].notna().any():
            dupes = int(df.duplicated(["_jur_key", "_year"], keep=False).sum())
        else:
            dupes = int(df.duplicated(["_jur_key"], keep=False).sum())

        min_y, max_y = year_range(df)
        audits.append(SourceAudit(
            source=source,
            path=str(info["path"]),
            rows=len(df),
            jurisdiction_col=info["jur_col"],
            year_col=info["year_col"],
            unique_jurisdictions=len(unique_keys),
            unmatched_jurisdictions=len(unmatched),
            duplicate_key_year_rows=dupes,
            min_year=min_y,
            max_year=max_y,
            notes="filtered to selected year for coverage" if args.year is not None else "all years coverage",
        ))

        # Coverage columns.
        counts = year_df.groupby("_jur_key", dropna=False).size().rename(f"{source}_rows")
        coverage = coverage.merge(counts, left_on="_jur_key", right_index=True, how="left")
        coverage[f"{source}_has_data"] = coverage[f"{source}_rows"].fillna(0).astype(int) > 0
        coverage[f"{source}_rows"] = coverage[f"{source}_rows"].fillna(0).astype(int)

        miss = numeric_missingness(year_df if len(year_df) else df, source)
        if not miss.empty:
            metric_missingness_frames.append(miss)

    audit_df = pd.DataFrame([a.__dict__ for a in audits])
    audit_df.to_csv(out_dir / "source_join_audit.csv", index=False)

    unmatched_df = pd.DataFrame(unmatched_rows)
    unmatched_df.to_csv(out_dir / "unmatched_jurisdictions.csv", index=False)

    coverage.to_csv(out_dir / "coverage_by_jurisdiction.csv", index=False)

    if metric_missingness_frames:
        pd.concat(metric_missingness_frames, ignore_index=True).to_csv(out_dir / "metric_missingness_by_source.csv", index=False)

    # Selected city audit.
    if args.city:
        city_key = canonical_jurisdiction(args.city)
        city_rows = []
        for source, info in loaded.items():
            df = info["df"]
            sub = df[df["_jur_key"] == city_key].copy()
            if args.year is not None and sub["_year"].notna().any():
                sub_for_count = sub[sub["_year"] == args.year].copy()
            else:
                sub_for_count = sub

            numeric_cols = []
            for c in sub_for_count.columns:
                if c.startswith("_"):
                    continue
                as_num = pd.to_numeric(sub_for_count[c], errors="coerce")
                if as_num.notna().any():
                    numeric_cols.append(c)

            city_rows.append({
                "source": source,
                "path": str(info["path"]),
                "city_requested": args.city,
                "city_key": city_key,
                "all_year_rows": len(sub),
                "selected_year_rows": len(sub_for_count),
                "year_filter": args.year if args.year is not None else "all",
                "raw_name_examples": " | ".join(sub["_jur_raw"].dropna().astype(str).unique()[:5]),
                "year_values_found": " | ".join(map(str, sorted(pd.to_numeric(sub["_year"], errors="coerce").dropna().astype(int).unique())[:20])),
                "numeric_columns_found": " | ".join(numeric_cols[:40]),
            })

            # Save raw rows for selected city/source if not huge.
            if len(sub_for_count):
                safe_source = re.sub(r"[^a-zA-Z0-9_]+", "_", source)
                sub_for_count.head(500).to_csv(out_dir / f"selected_city_rows_{safe_source}.csv", index=False)

        pd.DataFrame(city_rows).to_csv(out_dir / "selected_city_source_audit.csv", index=False)

    # Human-readable summary.
    with open(out_dir / "join_audit_summary.txt", "w", encoding="utf-8") as f:
        f.write("Housing Dashboard Join Audit\n")
        f.write("============================\n\n")
        f.write(f"Repo root: {repo}\n")
        f.write(f"Canonical jurisdiction source: {canonical_source}\n")
        f.write(f"Canonical jurisdictions: {len(canonical)}\n")
        if args.year is not None:
            f.write(f"Coverage year: {args.year}\n")
        if args.city:
            f.write(f"Selected city: {args.city} -> {canonical_jurisdiction(args.city)}\n")
        f.write("\nSource audit:\n")
        f.write(audit_df.to_string(index=False))
        f.write("\n\nFiles written:\n")
        for name in [
            "canonical_jurisdictions.csv",
            "source_join_audit.csv",
            "unmatched_jurisdictions.csv",
            "coverage_by_jurisdiction.csv",
            "metric_missingness_by_source.csv",
            "selected_city_source_audit.csv" if args.city else None,
        ]:
            if name and (out_dir / name).exists():
                f.write(f"\n- {out_dir / name}")
        f.write("\n")

    print("\nWrote join debug outputs:")
    for p in sorted(out_dir.glob("*.csv")):
        print(f"  - {p.relative_to(repo)}")
    print(f"  - {(out_dir / 'join_audit_summary.txt').relative_to(repo)}")

    print("\nQuick interpretation:")
    print("  1. Open outputs/debug/source_join_audit.csv first.")
    print("  2. Any source with many unmatched_jurisdictions has a name-normalization/join issue.")
    print("  3. Open outputs/debug/coverage_by_jurisdiction.csv to see which cities are missing each source.")
    print("  4. Open outputs/debug/selected_city_source_audit.csv for your spot-check city.")
    print("  5. If duplicate_key_year_rows is high, aggregate that source before joining it to dashboard cards.")


if __name__ == "__main__":
    main()
