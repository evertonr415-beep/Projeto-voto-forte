from pathlib import Path

path = Path("app/dashboard-client.tsx")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"Trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once('  | "Usuários"\n', '  | "Administração"\n', 'tipo View Usuários')
replace_once('  { label: "Usuários", icon: "♙" },\n  { label: "Banco de Dados e Backup", icon: "⛁" },\n', '  { label: "Administração", icon: "♙" },\n', 'menu administrativo')

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
  ) : (''',
'''  ) : view === "Banco de Dados e Backup" && currentUser.role === "master" ? (
    <BackupCenter tell={setNotice} back={() => setView("Administração")} />
  ) : view === "Administração" && isAdmin ? (
    <Users
      currentUser={currentUser}
      tell={setNotice}
      onUsersChange={setAvailableUsers}
      openBackup={
        currentUser.role === "master"
          ? () => setView("Banco de Dados e Backup")
          : undefined
      }
    />
  ) : (''',
'roteamento Administração e Backup',
)

replace_once(
'function BackupCenter({ tell }: { tell: (message: string) => void }) {',
'''function BackupCenter({
  tell,
  back,
}: {
  tell: (message: string) => void;
  back: () => void;
}) {''',
'assinatura BackupCenter',
)

replace_once(
'''      <PageHead
        eyebrow="PROTEÇÃO E RECUPERAÇÃO"
        title="Banco de Dados e Backup"
        text="Cópias completas, verificadas e acessíveis somente pelo Administrador Master."
      />''',
'''      <PageHead
        eyebrow="ADMINISTRAÇÃO · PROTEÇÃO E RECUPERAÇÃO"
        title="Banco de Dados e Backup"
        text="Cópias completas, verificadas e acessíveis somente pelo Administrador Master."
        action="← Voltar à Administração"
        onClick={back}
      />''',
'cabeçalho BackupCenter',
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
  openBackup,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
  openBackup?: () => void;
}) {''',
'assinatura Users',
)

replace_once(
'''      <PageHead
        eyebrow="SEGURANÇA, PRIVACIDADE E AUDITORIA"
        title="Central de usuários"
        text="Administradores acompanham toda a operação; cada usuário acessa somente o próprio ambiente."
      />''',
'''      <PageHead
        eyebrow="ACESSOS, SEGURANÇA E AUDITORIA"
        title="Administração"
        text="Gerencie acessos, permissões, atividade dos usuários e os recursos administrativos do sistema."
      />
      <div className="admin-kpis">
        <article>
          <small>ADMINISTRADORES</small>
          <b>{adminCount}/3</b>
          <span>{3 - adminCount} vaga(s) protegida(s)</span>
        </article>
        <article>
          <small>USUÁRIOS CADASTRADOS</small>
          <b>{usersList.length}</b>
          <span>Ambientes individuais</span>
        </article>
        <article>
          <small>ATIVIDADES REGISTRADAS</small>
          <b>{logs.length}</b>
          <span>Rastreabilidade ativa</span>
        </article>
        {openBackup && (
          <article className="admin-backup-shortcut">
            <small>MASTER</small>
            <b>Backup</b>
            <span>Proteção e recuperação da base</span>
            <button type="button" onClick={openBackup}>
              Abrir backup
            </button>
          </article>
        )}
      </div>''',
'cabeçalho Administração',
)

# Remove the old duplicated admin-kpis block that followed the PageHead.
old_kpis = '''      <div className="admin-kpis">
        <article>
          <small>ADMINISTRADORES</small>
          <b>{adminCount}/3</b>
          <span>{3 - adminCount} vaga(s) protegida(s)</span>
        </article>
        <article>
          <small>USUÁRIOS CADASTRADOS</small>
          <b>{usersList.length}</b>
          <span>Ambientes individuais</span>
        </article>
        <article>
          <small>ATIVIDADES REGISTRADAS</small>
          <b>{logs.length}</b>
          <span>Rastreabilidade ativa</span>
        </article>
      </div>'''
# After the replacement above, this exact block should occur once more: remove it.
idx = text.find(old_kpis, text.find('title="Administração"'))
if idx == -1:
    raise SystemExit('Bloco antigo de KPIs não encontrado para remoção')
text = text[:idx] + text[idx + len(old_kpis):]

for token in (
    '| "Usuários"',
    '{ label: "Usuários"',
    '{ label: "Banco de Dados e Backup"',
    'item.label !== "Usuários"',
):
    if token in text:
        raise SystemExit(f'Referência de menu antiga encontrada: {token}')

for token in (
    '| "Administração"',
    '{ label: "Administração", icon: "♙" }',
    'view === "Administração" && isAdmin',
    'openBackup?: () => void;',
    'action="← Voltar à Administração"',
    'className="admin-backup-shortcut"',
):
    if token not in text:
        raise SystemExit(f'Validação ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteração foi produzida')

path.write_text(text, encoding="utf-8")
print('Administração reorganizada com sucesso.')
