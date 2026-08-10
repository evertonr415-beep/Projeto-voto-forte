from pathlib import Path

path = Path('app/neutral-dashboard-client.tsx')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
'import { apiFetch, supabase } from "./supabase-client";',
'import { apiFetch } from "./supabase-client";',
1,
)

button = '''          <button\n            className="optimized-logout"\n            onClick={() => void supabase.auth.signOut()}\n          >\n            Sair\n          </button>\n'''
if button not in text:
    raise SystemExit('Botao Sair nao encontrado no painel de contatos')
text = text.replace(button, '', 1)

if 'className="optimized-logout"' in text:
    raise SystemExit('Botao Sair ainda presente')
if 'supabase.auth.signOut()' in text:
    raise SystemExit('Logout local ainda presente')
if 'className="optimized-scope-control"' not in text:
    raise SystemExit('Seletor Visualizando foi afetado')
if 'params.set("district", districtFilter)' not in text:
    raise SystemExit('Filtro de bairro foi afetado')
if 'onClick={() => setEditing(contact)}' not in text:
    raise SystemExit('Edicao de contatos foi afetada')
if text == original:
    raise SystemExit('Nenhuma alteracao produzida')

path.write_text(text, encoding='utf-8')
print('Botao Sair removido do Painel de contatos.')
