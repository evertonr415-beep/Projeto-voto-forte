from pathlib import Path

path = Path("app/dashboard-client.tsx")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"Trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once(
    '  { label: "WhatsApp", icon: "◉" },\n  { label: "Administração", icon: "⚙" },\n',
    '  { label: "WhatsApp", icon: "◉" },\n',
    'Administração dentro do menu operacional',
)

old_nav_end = '''          ))}
        </nav>'''
new_nav_end = '''          ))}
          {isAdmin && (
            <button
              className={`${view === "Administração" ? "active " : ""}administration-nav-item`}
              onClick={() => {
                navigateTo("Administração");
                apiFetch("/api/audit", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "Navegação",
                    detail: "Administração",
                  }),
                }).catch(() => undefined);
              }}
              title="Administração"
            >
              <span className="nav-icon">⚙</span>
              <span className="nav-name">Administração</span>
            </button>
          )}
        </nav>'''
replace_once(old_nav_end, new_nav_end, 'Administração fixa no final da navegação')

menu_start = text.index('const menu:')
menu_end = text.index('];', menu_start)
menu_block = text[menu_start:menu_end]
if 'label: "Administração"' in menu_block:
    raise SystemExit('Administração ainda está no menu operacional')

nav_start = text.index('<nav>')
nav_end = text.index('</nav>', nav_start)
nav_block = text[nav_start:nav_end]
admin_pos = nav_block.find('title="Administração"')
map_end_pos = nav_block.find('          ))}')
if admin_pos == -1 or map_end_pos == -1 or admin_pos < map_end_pos:
    raise SystemExit('Administração não ficou após a lista operacional')

for token in (
    '| "Administração"',
    'view === "Administração" && isAdmin',
    'administration-nav-item',
    'navigateTo("Administração")',
):
    if token not in text:
        raise SystemExit(f'Validação ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteração foi produzida')

path.write_text(text, encoding="utf-8")
print('Administração fixada como última opção do menu.')

# Trigger after workflow creation.
