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


replace_once(
    '  | "Usuários"\n  | "Banco de Dados e Backup";',
    '  | "Administração";',
    'tipo View administrativo',
)
replace_once(
    '  { label: "Usuários", icon: "♙" },\n  { label: "Banco de Dados e Backup", icon: "⛁" },',
    '  { label: "Administração", icon: "⚙" },',
    'itens administrativos no menu',
)
replace_once(
    '''  const visibleMenu = isAdmin
    ? menu.filter(
        (item) =>
          item.label !== "Banco de Dados e Backup" ||
          currentUser.role === "master",
      )
    : menu.filter(
        (item) =>
          item.label !== "Usuários" && item.label !== "Banco de Dados e Backup",
      );''',
    '''  const visibleMenu = isAdmin
    ? menu
    : menu.filter((item) => item.label !== "Administração");''',
    'visibilidade do menu administrativo',
)
replace_once(
    '''  ) : view === "Banco de Dados e Backup" && currentUser.role === "master" ? (
    <BackupCenter tell={setNotice} />
  ) : isAdmin ? (
    <Users
      currentUser={currentUser}
      tell={setNotice}
      onUsersChange={setAvailableUsers}
    />
  ) : (
    <Overview''',
    '''  ) : view === "Administração" && isAdmin ? (
    <Administration
      currentUser={currentUser}
      tell={setNotice}
      onUsersChange={setAvailableUsers}
    />
  ) : (
    <Overview''',
    'renderização administrativa',
)

admin_component = r'''
function Administration({
  currentUser,
  tell,
  onUsersChange,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
}) {
  type AdminSection = "users" | "audit" | "backup";
  const [section, setSection] = useState<AdminSection>("users");
  const isMaster = currentUser.role === "master";
  return (
    <>
      <PageHead
        eyebrow="ADMINISTRAÇÃO E SEGURANÇA"
        title="Administração"
        text="Gerencie acessos, acompanhe atividades e proteja a base do VOTO FORTE em um único lugar."
      />
      <div className="management-filter" role="tablist" aria-label="Seções administrativas">
        <button
          role="tab"
          aria-selected={section === "users"}
          className={section === "users" ? "active" : ""}
          onClick={() => setSection("users")}
        >
          Usuários e acessos
        </button>
        <button
          role="tab"
          aria-selected={section === "audit"}
          className={section === "audit" ? "active" : ""}
          onClick={() => setSection("audit")}
        >
          Atividades / Auditoria
        </button>
        {isMaster && (
          <button
            role="tab"
            aria-selected={section === "backup"}
            className={section === "backup" ? "active" : ""}
            onClick={() => setSection("backup")}
          >
            Banco de Dados e Backup
          </button>
        )}
      </div>
      {section === "backup" && isMaster ? (
        <BackupCenter tell={tell} embedded />
      ) : (
        <Users
          currentUser={currentUser}
          tell={tell}
          onUsersChange={onUsersChange}
          section={section === "audit" ? "audit" : "users"}
          embedded
        />
      )}
    </>
  );
}

'''
marker = 'type BackupItem = {'
if marker not in text:
    raise SystemExit('Ponto de inserção da Administração não encontrado')
text = text.replace(marker, admin_component + marker, 1)

replace_once(
    'function BackupCenter({ tell }: { tell: (message: string) => void }) {',
    'function BackupCenter({ tell, embedded = false }: { tell: (message: string) => void; embedded?: boolean }) {',
    'assinatura do BackupCenter',
)
replace_once(
    '''      <PageHead
        eyebrow="PROTEÇÃO E RECUPERAÇÃO"
        title="Banco de Dados e Backup"
        text="Cópias completas, verificadas e acessíveis somente pelo Administrador Master."
      />''',
    '''      {!embedded && (
        <PageHead
          eyebrow="PROTEÇÃO E RECUPERAÇÃO"
          title="Banco de Dados e Backup"
          text="Cópias completas, verificadas e acessíveis somente pelo Administrador Master."
        />
      )}''',
    'cabeçalho opcional de backup',
)

replace_once(
    '''function Users({
  currentUser,
  tell,
  onUsersChange,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
}) {''',
    '''function Users({
  currentUser,
  tell,
  onUsersChange,
  section = "users",
  embedded = false,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
  section?: "users" | "audit";
  embedded?: boolean;
}) {''',
    'assinatura do Users',
)

start = text.find('  return (\n    <>\n      <PageHead\n        eyebrow="SEGURANÇA, PRIVACIDADE E AUDITORIA"', text.find('function Users({'))
if start < 0:
    raise SystemExit('Retorno de Users não encontrado')
end_marker = '\n    </>\n  );\n}\n\nfunction ModalBox({'
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('Fim de Users não encontrado')
old_return = text[start:end + len('\n    </>\n  );\n}')]

# Extract the existing three large visual blocks from the known return body.
users_grid_start = old_return.find('      <div className="admin-kpis">')
audit_start = old_return.find('      <article className="panel audit-panel">')
if users_grid_start < 0 or audit_start < 0:
    raise SystemExit('Blocos de Users não encontrados')

# Keep everything from KPIs through users grid, excluding audit panel.
users_part = old_return[users_grid_start:audit_start]
# Get complete audit article through its closing article before fragment close.
audit_part = old_return[audit_start:]
audit_part = audit_part.rsplit('    </>\n  );\n}', 1)[0]

new_return = '''  return (\n    <>\n      {!embedded && (\n        <PageHead\n          eyebrow="SEGURANÇA, PRIVACIDADE E AUDITORIA"\n          title="Central de usuários"\n          text="Administradores acompanham toda a operação; cada usuário acessa somente o próprio ambiente."\n        />\n      )}\n      {section === "users" ? (\n        <>\n''' + users_part + '''        </>\n      ) : (\n        <>\n''' + audit_part + '''        </>\n      )}\n    </>\n  );\n}'''
text = text[:start] + new_return + text[end + len('\n    </>\n  );\n}'):]

for token in (
    '| "Usuários"',
    '| "Banco de Dados e Backup"',
    '{ label: "Usuários"',
    '{ label: "Banco de Dados e Backup"',
    'view === "Banco de Dados e Backup"',
):
    if token in text:
        raise SystemExit(f'Referência antiga residual: {token}')

for token in (
    '| "Administração"',
    '{ label: "Administração", icon: "⚙" }',
    'function Administration',
    'Usuários e acessos',
    'Atividades / Auditoria',
    'Banco de Dados e Backup',
    'section?: "users" | "audit"',
    'embedded?: boolean',
):
    if token not in text:
        raise SystemExit(f'Validação ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteração foi produzida')

path.write_text(text, encoding="utf-8")
print('Administração consolidada com sucesso.')
