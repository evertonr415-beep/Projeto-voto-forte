import json
import random
from datetime import datetime, timedelta

FIRST_NAMES = [
    "João", "Maria", "José", "Ana", "Carlos", "Paulo", "Lucas", "Marcos", "Gabriel", "Matheus",
    "Eduardo", "Rodrigo", "Guilherme", "Fernando", "Luiz", "Felipe", "Bruno", "Rafael", "Daniel",
    "Juliana", "Camila", "Fernanda", "Amanda", "Letícia", "Bruna", "Jéssica", "Larissa", "Renata",
    "Aline", "Mariana", "Patrícia", "Vanessa", "Beatriz", "Carla", "Daniela", "Simone", "Tatiane",
    "Luciana", "Adriana", "Cláudia", "Sandra", "Rosana", "Marcia", "Eliane", "Cristina", "Sueli",
    "Regina", "Valéria", "Silvana", "Marta", "Rosangela", "Cleide", "Neusa", "Tereza", "Ivone",
    "Antônio", "Francisco", "Manoel", "Sebastião", "Geraldo", "Raimundo", "Valdir", "Edson",
    "Claudio", "Roberto", "Sérgio", "Jorge", "Wagner", "Rogério", "Marcio", "Alexandre", "Marcelo",
    "Flávio", "Fábio", "Ricardo", "Cristiano", "Danilo", "Leandro", "Tiago", "Diego", "Anderson"
]

LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima",
    "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes",
    "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques",
    "Machado", "Mendes", "Freitas", "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira",
    "Macedo", "Campos", "Barros", "Pinto", "Batista", "Cavalcanti", "Borges", "Dantas", "Pacheco",
    "Vargas", "Melo", "Guimarães", "Miranda", "Monteiro", "Farias", "Pinheiro", "Castro", "Fonseca",
    "Bueno", "Moraes", "Siqueira", "Prado", "Toledo", "Galdino", "Zanatta", "Trevisan", "Pavan"
]

TOTAL_VOTES = 9646

ESTADUAL = [
    ("Sérgio Onofre", 4630),
    ("Pedro Paulo Bazana", 1543),
    ("Indeciso / Não sabe", 1275),
    ("Branco / Nulo", 1043),
    ("Cobra Repórter", 578),
    ("Delegado Jacovós", 385),
    ("Aline Franzon", 192),
]

FEDERAL = [
    ("Pedro Lupion", 2990),
    ("Indeciso / Não sabe", 2425),
    ("Branco / Nulo", 1983),
    ("Beto Preto", 771),
    ("Luciano Ducci", 482),
    ("Marco Brasil", 341),
    ("Neto Santos", 318),
    ("Ricardo Barros", 192),
    ("Santin Roveda", 96),
    ("Bonin", 48),
]

GOVERNADOR = [
    ("Sandro Alex", 3357),
    ("Sergio Moro", 3048),
    ("Luiz França", 936),
    ("Indeciso / Não sabe", 868),
    ("Outros", 733),
    ("Requião Filho", 704),
]

SENADOR = [
    ("Alexandre Curi", 2894),
    ("Cristina Graeml", 2411),
    ("Deltan Dallagnol", 1929),
    ("Filipe Barros", 1158),
    ("Gleisi", 772),
    ("Dr Rosinha", 482),
]

PRESIDENTE = [
    ("Flávio Bolsonaro", 4572),
    ("Lula", 1910),
    ("Renan Santos", 1051),
    ("Augusto Cury", 820),
    ("Ronaldo Caiado", 617),
    ("Indeciso / Não sabe", 435),
    ("Romeu Zema", 164),
    ("Outro candidato", 77),
]

GESTAO = [
    ("Boa", 5282),
    ("Ruim", 2331),
    ("Regular / Média", 2033),
]

BAIRROS = [
    ("Centro", 2140),
    ("Jardim Petrópolis", 1830),
    ("Vila Araponguinha", 1450),
    ("Jardim Primavera", 1280),
    ("Conjunto Flamingos", 1150),
    ("Zona Sul", 780),
    ("Vila Nova", 540),
    ("Jardim Panorama", 476),
]

def expand_list(distribution):
    res = []
    for val, count in distribution:
        res.extend([val] * count)
    return res

list_estadual = expand_list(ESTADUAL)
list_federal = expand_list(FEDERAL)
list_governador = expand_list(GOVERNADOR)
list_senador = expand_list(SENADOR)
list_presidente = expand_list(PRESIDENTE)
list_gestao = expand_list(GESTAO)
list_bairros = expand_list(BAIRROS)

assert len(list_estadual) == TOTAL_VOTES, f"Estadual count {len(list_estadual)} != {TOTAL_VOTES}"
assert len(list_federal) == TOTAL_VOTES, f"Federal count {len(list_federal)} != {TOTAL_VOTES}"
assert len(list_governador) == TOTAL_VOTES, f"Governador count {len(list_governador)} != {TOTAL_VOTES}"
assert len(list_senador) == TOTAL_VOTES, f"Senador count {len(list_senador)} != {TOTAL_VOTES}"
assert len(list_presidente) == TOTAL_VOTES, f"Presidente count {len(list_presidente)} != {TOTAL_VOTES}"
assert len(list_gestao) == TOTAL_VOTES, f"Gestao count {len(list_gestao)} != {TOTAL_VOTES}"
assert len(list_bairros) == TOTAL_VOTES, f"Bairros count {len(list_bairros)} != {TOTAL_VOTES}"

random.seed(42)

random.shuffle(list_estadual)
random.shuffle(list_federal)
random.shuffle(list_governador)
random.shuffle(list_senador)
random.shuffle(list_presidente)
random.shuffle(list_gestao)
random.shuffle(list_bairros)

end_time = datetime(2026, 9, 15, 2, 20, 0)
start_time = datetime(2026, 9, 10, 8, 0, 0)
total_seconds = int((end_time - start_time).total_seconds())

records = []
phone_prefixes = ["998", "991", "996", "999", "988", "997", "984", "992"]

for i in range(TOTAL_VOTES):
    id_voto = i + 1
    prefix = random.choice(phone_prefixes)
    mid = random.randint(10, 99)
    phone_display = f"(43) {prefix}{mid}-****"
    
    if i % 4 == 0:
        name = "Eleitor Arapongas"
    elif i % 7 == 0:
        name = "Participante da Enquete"
    else:
        fn = random.choice(FIRST_NAMES)
        ln1 = random.choice(LAST_NAMES)
        ln2 = random.choice(LAST_NAMES) if random.random() > 0.4 else ""
        name = f"{fn} {ln1} {ln2}".strip()

    bairro = list_bairros[i]
    dep_est = list_estadual[i]
    dep_fed = list_federal[i]
    gov = list_governador[i]
    sen = list_senador[i]
    pres = list_presidente[i]
    gestao = list_gestao[i]

    offset = int(i * (total_seconds / TOTAL_VOTES) + random.randint(-120, 120))
    offset = max(0, min(total_seconds, offset))
    voto_time = start_time + timedelta(seconds=offset)
    iso_time = voto_time.isoformat() + "Z"

    record = {
        "id_voto": id_voto,
        "telefone": phone_display,
        "nome": name,
        "bairro": bairro,
        "cidade": "Arapongas",
        "deputado_estadual": dep_est,
        "deputado_federal": dep_fed,
        "governador": gov,
        "senador": sen,
        "presidente": pres,
        "gestao_municipal": gestao,
        "status": "declarado" if "Indeciso" not in dep_est and "Branco" not in dep_est else "indeciso",
        "timestamp": iso_time
    }
    records.append(record)

# Sort latest first (most recent at top)
records.sort(key=lambda x: x["timestamp"], reverse=True)
for i, r in enumerate(records):
    r["id_voto"] = TOTAL_VOTES - i

with open("/Users/felipe/.gemini/antigravity-ide/scratch/Projeto-voto-forte/backups/backup_votos_enquete.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Gerado com sucesso: {len(records)} votos em backups/backup_votos_enquete.json")
