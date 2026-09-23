#!/usr/bin/env python3
import csv
import re
import os

SOURCE_CSV = "/Users/felipe/Downloads/Paraná não compartilhar.csv"
OUTPUT_CSV_DOWNLOADS = "/Users/felipe/Downloads/Arapongas_33k_Eleitores_VotoForte.csv"
OUTPUT_CSV_LOCAL = "/Users/felipe/.gemini/antigravity-ide/scratch/Arapongas_33k_Eleitores_VotoForte.csv"

def clean_phone(phone_str):
    parts = [p.strip() for p in phone_str.split('/')]
    for p in parts:
        digits = re.sub(r'\D', '', p)
        if (len(digits) == 12 or len(digits) == 13) and digits.startswith('55'):
            digits = digits[2:]
        if len(digits) in (10, 11) and digits[0] in '123456789':
            return p.strip()
    return phone_str.strip()

def parse_address(addr_str):
    parts = [p.strip() for p in addr_str.split(',')]
    street = parts[0] if len(parts) >= 1 else ''
    number = re.sub(r'^[nN]\s*', '', parts[1]).strip() if len(parts) >= 2 else ''
    district = parts[2] if len(parts) >= 3 else ''
    cep = parts[3] if len(parts) >= 4 else ''
    return street, number, district, cep

def main():
    print("Iniciando processamento dos eleitores de Arapongas...")
    
    arapongas_rows = []
    seen_phones = set()
    duplicates_in_file = 0

    with open(SOURCE_CSV, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f, delimiter=';')
        header = next(reader)
        for row in reader:
            if len(row) < 6:
                continue
            nome, cpf, telefone, endereco, cidade, uf = [c.strip() for c in row[:6]]
            if cidade.upper() != 'ARAPONGAS':
                continue
            
            primary_phone = clean_phone(telefone)
            digits = re.sub(r'\D', '', primary_phone)
            if digits in seen_phones:
                duplicates_in_file += 1
                continue
            seen_phones.add(digits)
            
            street, number, district, cep = parse_address(endereco)
            
            arapongas_rows.append({
                'nome': nome,
                'telefone': primary_phone,
                'bairro': district,
                'rua': street,
                'numero': number,
                'cep': cep,
                'cidade': 'Arapongas',
                'uf': 'PR',
                'perfil': 'Eleitor',
                'cpf': cpf
            })

    print(f"Total de eleitores únicos filtrados para Arapongas: {len(arapongas_rows):,}".replace(",", "."))
    print(f"Duplicados no arquivo descartados: {duplicates_in_file}")

    fieldnames = ['nome', 'telefone', 'bairro', 'rua', 'numero', 'cep', 'cidade', 'uf', 'perfil', 'cpf']

    for out_path in [OUTPUT_CSV_DOWNLOADS, OUTPUT_CSV_LOCAL]:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', encoding='utf-8', newline='') as out_f:
            writer = csv.DictWriter(out_f, fieldnames=fieldnames, delimiter=';')
            writer.writeheader()
            writer.writerows(arapongas_rows)
        print(f"✅ Arquivo salvo: {out_path} ({os.path.getsize(out_path):,} bytes)".replace(",", "."))

if __name__ == '__main__':
    main()
