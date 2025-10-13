"""Utility script that refreshes the CMS locality mapping assets used by the Compare Your Price to Medicare workflow.

Prerequisites: pip install --user beautifulsoup4
"""

import csv
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
html_path = ROOT / "locality.html"
if not html_path.exists():
    raise SystemExit("Expected locality.html (downloaded from CMS) in repository root")

with html_path.open(encoding="utf-8") as fh:
    soup = BeautifulSoup(fh.read(), "html.parser")

accordion = soup.select_one('.ckeditor-accordion')
if accordion is None:
    raise SystemExit("Could not find accordion content in locality.html")

STATE_ABBRS = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Puerto Rico": "PR",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virgin Islands": "VI",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
    "Guam": "GU",
}

MULTI_STATE_OVERRIDES = {
    "Hawaii/Guam": [("Hawaii", "HI"), ("Guam", "GU")],
}

STATE_NAMES = {abbr: name for name, abbr in STATE_ABBRS.items()}

county_file = ROOT / "national_county.txt"
if not county_file.exists():
    raise SystemExit("Missing national_county.txt (Census county reference)")

state_abbr_by_fips = {}
county_name_by_fips = {}
with county_file.open() as fh:
    reader = csv.reader(fh)
    for row in reader:
        state_abbr, state_fips, county_fips, name, _ = row
        state_abbr_by_fips[state_fips] = state_abbr
        county_name_by_fips[(state_fips, county_fips)] = name

zcta_file = ROOT / "zcta_county_rel_10.txt"
if not zcta_file.exists():
    raise SystemExit("Missing zcta_county_rel_10.txt (ZCTA to county crosswalk)")

zip_best = {}
with zcta_file.open() as fh:
    reader = csv.DictReader(fh)
    for row in reader:
        zcta = row["ZCTA5"].zfill(5)
        state_fips = row["STATE"].zfill(2)
        county_fips = row["COUNTY"].zfill(3)
        pop_share = float(row["POPPT"])
        if zcta not in zip_best or pop_share > zip_best[zcta]["pop_share"]:
            zip_best[zcta] = {
                "state_fips": state_fips,
                "county_fips": county_fips,
                "pop_share": pop_share,
            }

SUFFIX_PATTERN = re.compile(
    r"(?:(?: COUNTY)|(?: CNTY)|(?: PARISH)|(?: BOROUGH)|(?: BORO)|(?: CENSUS AREA)|(?: MUNICIPALITY)|(?: CITY AND BOROUGH)|(?: CITY & BOROUGH)|(?: \(CITY\))|(?: \(BOROUGH\))|(?: \(PARISH\)))$",
    flags=re.IGNORECASE,
)

MULTI_SPLIT = re.compile(r"[\/,;:&]+")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ").strip())


def normalize_term(text: str) -> str:
    text = clean_text(text)
    text = text.upper()
    text = re.sub(r"[^A-Z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_county_name(name: str) -> str:
    name = clean_text(name)
    name = SUFFIX_PATTERN.sub("", name).strip()
    name = re.sub(r"\s+", " ", name)
    return name


def extract_counties(*parts: str) -> list[str]:
    buckets = []
    for source in parts:
        if not source:
            continue
        for part in MULTI_SPLIT.split(source):
            part = clean_county_name(part)
            if part and part.upper() not in {
                "ALL OTHER",
                "ALL OTHER COUNTIES",
                "ALL COUNTIES",
                "STATEWIDE",
                "REST OF STATE",
                "REST OF STATE*",
                "REST OF STATE *",
                "ALL",
            }:
                buckets.append(part)
    return buckets


def yield_state_variants(state_label: str):
    if state_label in MULTI_STATE_OVERRIDES:
        for name, abbr in MULTI_STATE_OVERRIDES[state_label]:
            yield name, abbr
    else:
        abbr = STATE_ABBRS.get(state_label)
        if not abbr:
            raise SystemExit(f"State abbreviation not found for {state_label}")
        yield state_label, abbr


localities = []
for dt, dd in zip(accordion.find_all("dt"), accordion.find_all("dd")):
    state_label = clean_text(dt.get_text())
    table = dd.find("table")
    if table is None:
        continue
    rows = table.find_all("tr")
    for state_name, state_abbr in yield_state_variants(state_label):
        for row in rows[1:]:
            cells = [clean_text(td.get_text(" ", strip=True)) for td in row.find_all("td")]
            if len(cells) != 4:
                continue
            counties_raw, fee_area_raw, mac, locality_number = cells
            if not counties_raw:
                continue
            locality_number = locality_number.zfill(2)
            counties_clean = clean_text(counties_raw)
            main_label = counties_clean
            bracket_part = ""
            if "(" in counties_clean and ")" in counties_clean:
                main_label, bracket_part = counties_clean.split("(", 1)
                main_label = clean_text(main_label)
                bracket_part = clean_text(bracket_part.rstrip(")"))
            fee_area_clean = clean_text(fee_area_raw)

            cleaned_upper = counties_clean.upper()
            potential_sources = []
            if any(token in cleaned_upper for token in [',', ' AND ', ' COUNTY', ' CNTY']):
                potential_sources.append(main_label)
            potential_sources.extend([bracket_part, fee_area_clean])
            county_list = extract_counties(*potential_sources)
            is_rest = bool('REST OF STATE' in cleaned_upper or 'REST OF STATE' in fee_area_clean.upper() or 'ALL OTHER COUNTIES' in cleaned_upper)
            is_statewide = 'STATEWIDE' in cleaned_upper or 'ALL COUNTIES' in cleaned_upper

            if not main_label or main_label.upper() in {
                "ALL COUNTIES",
                "REST OF STATE",
                "REST OF STATE*",
                "STATEWIDE",
            }:
                locality_label = fee_area_clean if fee_area_clean else state_name
            else:
                locality_label = main_label

            alias_terms = set()
            for text in filter(None, [main_label, bracket_part, fee_area_clean]):
                alias_terms.add(normalize_term(text))
            for county in county_list:
                alias_terms.add(normalize_term(county))
                alias_terms.add(normalize_term(f"{county} COUNTY"))
                alias_terms.add(normalize_term(f"{county} {state_abbr}"))
                alias_terms.add(normalize_term(f"{county} COUNTY {state_abbr}"))
            alias_terms.add(normalize_term(f"{state_name} {locality_label}"))
            alias_terms.add(normalize_term(f"{state_abbr} {locality_label}"))

            localities.append(
                {
                    "state": state_name,
                    "stateAbbr": state_abbr,
                    "localityNumber": locality_number,
                    "mac": mac,
                    "localityLabel": locality_label.title(),
                    "counties": sorted({c.title() for c in county_list}),
                    "rawCounties": counties_clean,
                    "feeScheduleArea": fee_area_clean.title(),
                    "isRestOfState": is_rest,
                    "isStatewide": is_statewide,
                    "searchTerms": sorted(alias_terms),
                }
            )

zip_to_county = {}
for zcta, info in zip_best.items():
    state_abbr = state_abbr_by_fips.get(info["state_fips"])
    if not state_abbr:
        continue
    county_full = county_name_by_fips.get((info["state_fips"], info["county_fips"]))
    if not county_full:
        continue
    county_clean = clean_county_name(county_full)
    zip_to_county[zcta] = {
        "stateAbbr": state_abbr,
        "county": county_clean.title(),
        "stateName": STATE_NAMES.get(state_abbr, state_abbr),
    }


data = {
    "localities": localities,
    "zipToCounty": zip_to_county,"stateNames": STATE_NAMES,
}

output_path = ROOT / "assets" / "data" / "locality-mapping.json"
output_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(f"Wrote {output_path}")
