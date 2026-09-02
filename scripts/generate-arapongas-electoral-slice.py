#!/usr/bin/env python3
import csv
import io
import json
import os
import re
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone

CITY_CODE = "74276"
ZONE = "61"
UF = "PR"
SOURCES = {
    2024: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_PR.zip",
    2022: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2022_PR.zip",
}
OFFICES = {
    2024: {"PREFEITO", "VEREADOR"},
    2022: {"PRESIDENTE", "GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"},
}
OUT_DIR = os.path.join("app", "electoral-panel", "data")


def norm(value):
    value = unicodedata.normalize("NFD", str(value or ""))
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value).strip().upper()


def download(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
            "Accept": "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
            "Referer": "https://dadosabertos.tse.jus.br/",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as response:
        return response.read()


def first_csv(zf):
    names = [name for name in zf.namelist() if name.lower().endswith(".csv")]
    if not names:
        raise RuntimeError("CSV não encontrado dentro do ZIP do TSE")
    return names[0]


def build_year(year):
    print(f"Downloading TSE {year}...")
    payload = download(SOURCES[year])
    print(f"Downloaded {len(payload):,} bytes")
    zf = zipfile.ZipFile(io.BytesIO(payload))
    csv_name = first_csv(zf)

    by_office_section = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"number": "", "name": "", "party": "", "votes": 0})))
    sections_seen = set()
    matched = 0

    with zf.open(csv_name, "r") as raw:
        text = io.TextIOWrapper(raw, encoding="latin-1", newline="")
        reader = csv.DictReader(text, delimiter=";")
        fields = set(reader.fieldnames or [])
        required = {"CD_MUNICIPIO", "NR_ZONA", "NR_SECAO", "DS_CARGO", "NR_VOTAVEL", "NM_VOTAVEL", "QT_VOTOS"}
        missing = sorted(required - fields)
        if missing:
            raise RuntimeError(f"Campos ausentes no TSE {year}: {missing}")

        for row in reader:
            if str(row.get("CD_MUNICIPIO", "")).strip() != CITY_CODE:
                continue
            if str(row.get("NR_ZONA", "")).strip().lstrip("0") != ZONE:
                continue
            if str(row.get("NR_TURNO", "1")).strip() not in ("", "1"):
                continue

            office = norm(row.get("DS_CARGO"))
            if office not in OFFICES[year]:
                continue

            vote_type = norm(row.get("DS_TIPO_VOTAVEL"))
            number = str(row.get("NR_VOTAVEL", "")).strip()
            name = str(row.get("NM_VOTAVEL", "")).strip()
            party = str(row.get("SG_PARTIDO", "")).strip()
            section_raw = str(row.get("NR_SECAO", "")).strip()
            try:
                section = str(int(section_raw))
                votes = int(float(str(row.get("QT_VOTOS", "0")).replace(",", ".")))
            except ValueError:
                continue

            special_name = norm(name)
            if votes <= 0 or not name:
                continue
            if number in {"95", "96"}:
                continue
            if any(token in vote_type for token in ("BRANCO", "NULO", "LEGENDA")):
                continue
            if special_name in {"VOTO BRANCO", "VOTOS BRANCOS", "NULO", "VOTO NULO", "VOTOS NULOS"}:
                continue

            key = f"{number}|{name}|{party}"
            current = by_office_section[office][section][key]
            current["number"] = number
            current["name"] = name
            current["party"] = party
            current["votes"] += votes
            sections_seen.add(int(section))
            matched += 1

    compact_offices = {}
    for office, sections in sorted(by_office_section.items()):
        compact_sections = {}
        for section, candidates in sorted(sections.items(), key=lambda item: int(item[0])):
            ranked = sorted(candidates.values(), key=lambda item: (-item["votes"], item["name"]))
            compact_sections[section] = ranked
        compact_offices[office] = compact_sections

    return {
        "meta": {
            "source": SOURCES[year],
            "sourceName": "TSE - Votação por seção eleitoral",
            "year": year,
            "uf": UF,
            "municipality": "Arapongas",
            "municipalityCode": CITY_CODE,
            "zone": int(ZONE),
            "turn": 1,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sections": sorted(sections_seen),
            "matchedRows": matched,
        },
        "offices": compact_offices,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for year in (2024, 2022):
        data = build_year(year)
        path = os.path.join(OUT_DIR, f"arapongas-{year}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        print(f"Wrote {path}: {os.path.getsize(path):,} bytes, {len(data['meta']['sections'])} sections")


if __name__ == "__main__":
    main()
