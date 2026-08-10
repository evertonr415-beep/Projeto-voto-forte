from pathlib import Path
import re

path = Path("app/dashboard-client.tsx")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"Trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once('  | "Relatórios"\n', '', 'tipo View Relatórios')
replace_once('  { label: "Relatórios", icon: "▥" },\n', '', 'item Relatórios no menu')

text, count = re.subn(
    r'\n  \) : view === "Relatórios" \? \(\n    <Reports tell=\{setNotice\} contacts=\{contacts\} />\n',
    '\n',
    text,
    count=1,
)
if count != 1:
    raise SystemExit('Não foi possível remover o branch de Relatórios')

text, count = re.subn(
    r'\nfunction Reports\(\{.*?\n\}\n\ntype BackupItem = \{',
    '\n\ntype BackupItem = {',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Não foi possível remover o componente Reports')

for token in (
    '| "Relatórios"',
    '{ label: "Relatórios"',
    'view === "Relatórios"',
    'function Reports',
    'setView("Relatórios")',
):
    if token in text:
        raise SystemExit(f'Referência residual encontrada: {token}')

for token in (
    '| "Contatos"',
    '| "Agenda Inteligente"',
    '| "Mapa Eleitoral"',
    '| "WhatsApp"',
    'function ContactManager',
    'function BackupCenter',
):
    if token not in text:
        raise SystemExit(f'Validação estrutural ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteração foi produzida')

path.write_text(text, encoding="utf-8")
print('Aba Relatórios removida com sucesso.')
