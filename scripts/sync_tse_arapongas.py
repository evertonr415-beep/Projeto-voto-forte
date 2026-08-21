#!/usr/bin/env python3
"""Generate a compact Arapongas/PR electoral dataset from official TSE open-data files.

Sources:
- TSE voter profile by section -> section -> polling-place mapping
- TSE electorate by polling place -> official polling-place metadata
- TSE votes by section -> exact votes aggregated to each polling place

Only Arapongas/PR is kept in the generated JSON. No proportional estimates are used.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import tempfile
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Mapping, MutableMapping, Optional, Tuple

UF = "PR"
MUNICIPALITY = "ARAPONGAS"
OUTPUT = Path("app/data/arapongas-tse-official.json")

SOURCES = {
    2024: {
        "votes": "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_PR.zip",
        "profile": "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao/perfil_eleitor_secao_2024_PR.zip",
        "places": "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip",
    },
    2022: {
        "votes": "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2022_PR.zip",
        "profile": "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao/perfil_eleitor_secao_2022_PR.zip",
        "places": "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2022.zip",
    },
}

OFFICES = {
    2024: {
        "PREFEITO": ("prefeito", "Prefeito"),
        "VEREADOR": ("vereador", "Vereador"),
    },
    2022: {
        "GOVERNADOR": ("governador", "Governador"),
        "SENADOR": ("senador", "Senador"),
        "DEPUTADO FEDERAL": ("deputado_federal", "Deputado Federal"),
        "DEPUTADO ESTADUAL": ("deputado_estadual", "Deputado Estadual"),
    },
}


def norm(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip().upper()


def num_key(value: object) -> str:
    raw = str(value or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    return str(int(digits))


def to_int(value: object) -> int:
    raw = str(value or "").strip().replace(".", "").replace(",", ".")
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return 0


def first(row: Mapping[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def detect_encoding(sample: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            sample.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            pass
    return "latin-1"


def iter_csv_from_zip(path: Path) -> Iterator[Dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        members = [m for m in archive.namelist() if m.lower().endswith((".csv", ".txt")) and not m.endswith("/")]
        if not members:
            raise RuntimeError(f"Nenhum CSV encontrado em {path.name}")
        # TSE resources normally contain one data file. If there are several, read all.
        for member in members:
            with archive.open(member) as raw:
                head = raw.read(8192)
                encoding = detect_encoding(head)
                raw.close()
            with archive.open(member) as raw:
                text = io.TextIOWrapper(raw, encoding=encoding, errors="replace", newline="")
                reader = csv.DictReader(text, delimiter=";")
                if not reader.fieldnames:
                    continue
                # Strip BOM/whitespace from headers without changing the values.
                reader.fieldnames = [str(name or "").lstrip("\ufeff").strip() for name in reader.fieldnames]
                for row in reader:
                    yield {str(k or "").lstrip("\ufeff").strip(): str(v or "").strip() for k, v in row.items()}


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    print(f"Baixando {url}", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "VotoForte-TSE-Sync/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as out:
        shutil.copyfileobj(response, out, length=1024 * 1024)
    if destination.stat().st_size == 0:
        raise RuntimeError(f"Download vazio: {url}")


def row_is_arapongas(row: Mapping[str, str]) -> bool:
    uf = norm(first(row, "SG_UF", "UF"))
    city = norm(first(row, "NM_MUNICIPIO", "DS_MUNICIPIO", "MUNICIPIO"))
    return uf == UF and city == MUNICIPALITY


def load_section_to_place(profile_zip: Path) -> Tuple[Dict[Tuple[str, str], str], Dict[str, set[int]]]:
    section_to_place: Dict[Tuple[str, str], str] = {}
    sections_by_place: Dict[str, set[int]] = defaultdict(set)
    matched = 0
    for row in iter_csv_from_zip(profile_zip):
        if not row_is_arapongas(row):
            continue
        zone = num_key(first(row, "NR_ZONA", "ZONA"))
        section = num_key(first(row, "NR_SECAO", "SECAO"))
        place = num_key(first(row, "NR_LOCAL_VOTACAO", "CD_LOCAL_VOTACAO", "LOCAL_VOTACAO"))
        if not zone or not section or not place:
            continue
        section_to_place[(zone, section)] = place
        sections_by_place[place].add(int(section))
        matched += 1
    if not section_to_place:
        raise RuntimeError(f"Nenhuma seção de {MUNICIPALITY}/{UF} encontrada em {profile_zip.name}")
    print(f"{profile_zip.name}: {len(section_to_place)} seções, {len(sections_by_place)} locais ({matched} linhas úteis)")
    return section_to_place, sections_by_place


def load_places(place_zip: Path, sections_by_place: Mapping[str, set[int]]) -> Dict[str, dict]:
    places: Dict[str, dict] = {}
    for row in iter_csv_from_zip(place_zip):
        if not row_is_arapongas(row):
            continue
        code = num_key(first(row, "NR_LOCAL_VOTACAO", "CD_LOCAL_VOTACAO", "LOCAL_VOTACAO"))
        if not code:
            continue
        zone = num_key(first(row, "NR_ZONA", "ZONA"))
        current = places.get(code, {})
        name = first(row, "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO", "NOME_LOCAL_VOTACAO")
        address = first(row, "DS_ENDERECO", "DS_LOCAL", "ENDERECO")
        district = first(row, "NM_BAIRRO", "DS_BAIRRO", "BAIRRO")
        cep = first(row, "NR_CEP", "CEP")
        voters = to_int(first(row, "QT_ELEITOR", "QT_ELEITORES", "QT_ELEITORADO"))
        places[code] = {
            "code": code,
            "name": name or current.get("name") or f"Local de votação {code}",
            "address": address or current.get("address") or "",
            "district": district or current.get("district") or "",
            "cep": cep or current.get("cep") or "",
            "zone": int(zone) if zone else current.get("zone"),
            "sections": sorted(sections_by_place.get(code, set())),
            "totalVoters": voters or current.get("totalVoters") or 0,
        }
    # Preserve mapped places even if the global places file misses metadata.
    for code, sections in sections_by_place.items():
        places.setdefault(
            code,
            {
                "code": code,
                "name": f"Local de votação {code}",
                "address": "",
                "district": "",
                "cep": "",
                "zone": None,
                "sections": sorted(sections),
                "totalVoters": 0,
            },
        )
    return places


def office_for(year: int, raw: str) -> Optional[Tuple[str, str]]:
    cargo = norm(raw)
    for label, mapping in OFFICES[year].items():
        if cargo == label or cargo.endswith(label):
            return mapping
    return None


def is_nominal(row: Mapping[str, str]) -> bool:
    vote_type = norm(first(row, "DS_TIPO_VOTAVEL", "DS_TIPO_VOTO", "TIPO_VOTAVEL"))
    if vote_type:
        if "NOMINAL" in vote_type:
            return True
        if "BRANCO" in vote_type or "NULO" in vote_type or "LEGENDA" in vote_type:
            return False
    name = norm(first(row, "NM_VOTAVEL", "NM_CANDIDATO", "DS_VOTAVEL"))
    if name in {"BRANCO", "NULO", "VOTO BRANCO", "VOTO NULO", "LEGENDA"}:
        return False
    number = num_key(first(row, "NR_VOTAVEL", "NR_CANDIDATO", "NUMERO_VOTAVEL"))
    return bool(number and name)


def load_votes(year: int, vote_zip: Path, section_to_place: Mapping[Tuple[str, str], str]) -> Dict[str, dict]:
    # place -> office -> candidateKey -> aggregate
    candidate_votes: Dict[str, Dict[str, Dict[str, dict]]] = defaultdict(lambda: defaultdict(dict))
    totals: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    matched_rows = 0

    for row in iter_csv_from_zip(vote_zip):
        if not row_is_arapongas(row):
            continue
        turn = to_int(first(row, "NR_TURNO", "TURNO"))
        if turn and turn != 1:
            continue
        office = office_for(year, first(row, "DS_CARGO", "DS_CARGO_PERGUNTA", "NM_CARGO", "CARGO"))
        if not office:
            continue
        office_key, office_label = office
        zone = num_key(first(row, "NR_ZONA", "ZONA"))
        section = num_key(first(row, "NR_SECAO", "SECAO"))
        place = section_to_place.get((zone, section))
        if not place:
            continue
        votes = to_int(first(row, "QT_VOTOS", "QT_VOTO", "VOTOS"))
        if votes < 0:
            continue
        totals[place][office_key] += votes
        if not is_nominal(row):
            matched_rows += 1
            continue

        name = first(row, "NM_VOTAVEL", "NM_CANDIDATO", "DS_VOTAVEL") or "Candidato"
        number = num_key(first(row, "NR_VOTAVEL", "NR_CANDIDATO", "NUMERO_VOTAVEL"))
        party = first(row, "SG_PARTIDO", "NM_PARTIDO", "PARTIDO")
        candidate_key = f"{number}|{norm(name)}|{norm(party)}"
        current = candidate_votes[place][office_key].get(candidate_key)
        if current is None:
            current = {
                "name": name,
                "number": number,
                "party": party,
                "votes": 0,
            }
            candidate_votes[place][office_key][candidate_key] = current
        current["votes"] += votes
        matched_rows += 1

    result: Dict[str, dict] = {}
    for place, offices in candidate_votes.items():
        result[place] = {}
        for office_key, candidates_map in offices.items():
            office_label = next(label for _, (key, label) in OFFICES[year].items() if key == office_key)
            candidates = sorted(candidates_map.values(), key=lambda item: (-item["votes"], item["name"]))
            nominal_total = sum(item["votes"] for item in candidates)
            for item in candidates:
                item["percentage"] = round((item["votes"] / nominal_total * 100) if nominal_total else 0.0, 4)
            result[place][office_key] = {
                "key": office_key,
                "label": office_label,
                "totalVotes": totals[place].get(office_key, nominal_total),
                "nominalVotes": nominal_total,
                "candidates": candidates,
            }

    if matched_rows == 0:
        raise RuntimeError(f"Nenhuma votação útil de {MUNICIPALITY}/{UF} encontrada em {vote_zip.name}")
    print(f"{vote_zip.name}: {matched_rows} linhas agregadas em {len(result)} locais")
    return result


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="voto-forte-tse-"))
    try:
        year_payloads: Dict[int, dict] = {}
        canonical_places: Dict[str, dict] = {}

        for year, urls in SOURCES.items():
            downloaded: Dict[str, Path] = {}
            for kind, url in urls.items():
                destination = work / f"{year}-{kind}.zip"
                download(url, destination)
                downloaded[kind] = destination

            section_to_place, sections_by_place = load_section_to_place(downloaded["profile"])
            places = load_places(downloaded["places"], sections_by_place)
            votes = load_votes(year, downloaded["votes"], section_to_place)

            for code, place in places.items():
                if year == 2024 or code not in canonical_places:
                    canonical_places[code] = dict(place)
                else:
                    existing = canonical_places[code]
                    if not existing.get("name") and place.get("name"):
                        existing["name"] = place["name"]
                    if not existing.get("address") and place.get("address"):
                        existing["address"] = place["address"]
                    if not existing.get("district") and place.get("district"):
                        existing["district"] = place["district"]

            year_payloads[year] = {"places": places, "votes": votes}

        polling_places: List[dict] = []
        all_codes = sorted(set(canonical_places) | set(year_payloads[2024]["votes"]) | set(year_payloads[2022]["votes"]), key=lambda x: int(x))
        for code in all_codes:
            base = dict(canonical_places.get(code) or year_payloads[2024]["places"].get(code) or year_payloads[2022]["places"].get(code) or {})
            zone = base.get("zone") or 61
            elections: Dict[str, dict] = {}
            for year in (2024, 2022):
                offices = year_payloads[year]["votes"].get(code, {})
                if offices:
                    elections[str(year)] = {
                        "year": year,
                        "label": "Eleições Municipais 2024" if year == 2024 else "Eleições Gerais 2022",
                        "offices": offices,
                    }
            if not elections:
                continue
            polling_places.append(
                {
                    "id": f"z{int(zone):03d}-l{int(code):04d}",
                    "code": code,
                    "name": base.get("name") or f"Local de votação {code}",
                    "address": base.get("address") or "",
                    "district": base.get("district") or "",
                    "cep": base.get("cep") or "",
                    "zone": int(zone),
                    "sections": base.get("sections") or [],
                    "totalVoters": int(base.get("totalVoters") or 0),
                    "elections": elections,
                }
            )

        if not polling_places:
            raise RuntimeError("Dataset final ficou vazio; abortando para não publicar dados inválidos")

        payload = {
            "schemaVersion": 1,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "provider": "Tribunal Superior Eleitoral (TSE)",
            "municipality": "Arapongas",
            "uf": "PR",
            "methodology": "Votos oficiais por seção eleitoral agregados pelo NR_LOCAL_VOTACAO; não utiliza estimativas proporcionais.",
            "sourceUrls": [url for year in (2024, 2022) for url in SOURCES[year].values()],
            "pollingPlaces": polling_places,
        }

        OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Gerado {OUTPUT} com {len(polling_places)} locais de votação e {OUTPUT.stat().st_size} bytes")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
