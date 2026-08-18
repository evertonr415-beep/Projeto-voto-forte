from pathlib import Path

path = Path('app/dashboard-client.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
'''type OwnedRecord = {
  id: number;
  ownerEmail: string;
  kind: "contact" | "meeting" | "draft";
  payload: Contact | Meeting | Draft;
  createdAt: string;
  updatedAt: string;
};
''',
'''type OwnedRecord = {
  id: number;
  ownerEmail: string;
  kind: "contact" | "meeting" | "draft";
  payload: Contact | Meeting | Draft;
  createdAt: string;
  updatedAt: string;
};
type OverviewSummary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
};

const EMPTY_OVERVIEW_SUMMARY: OverviewSummary = {
  total: 0,
  voters: 0,
  leaders: 0,
  meetings: 0,
  districtsReached: 0,
};
''',
'overview summary type',
)

replace_once(
'''  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [loadingData, setLoadingData] = useState(true);
  const [draftsLoadedScope, setDraftsLoadedScope] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
''',
'''  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [overviewSummary, setOverviewSummary] = useState<OverviewSummary>(
    EMPTY_OVERVIEW_SUMMARY,
  );
  const [overviewMeetings, setOverviewMeetings] = useState<
    (Meeting & { id: number; ownerEmail: string })[]
  >([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [contactsLoadedScope, setContactsLoadedScope] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [meetingsLoadedScope, setMeetingsLoadedScope] = useState<string | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [draftsLoadedScope, setDraftsLoadedScope] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
''',
'lazy state',
)

old_effect = '''  useEffect(() => {
    let cancelled = false;
    setDraftsLoadedScope(null);
    setLoadingDrafts(false);
    apiFetch(`/api/records?owner=${encodeURIComponent(scope)}&includeDrafts=0`)
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (response.ok) setRecords(data.records || []);
        else setNotice(data.error || "Não foi possível carregar os dados.");
      })
      .catch(() => {
        if (!cancelled) setNotice("Não foi possível carregar os dados agora.");
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);
'''
new_effect = '''  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [summaryResponse, meetingsResponse] = await Promise.all([
        apiFetch(
          `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
          { cache: "no-store" },
        ),
        apiFetch(
          `/api/records?owner=${encodeURIComponent(scope)}&kind=meeting&mode=overview`,
          { cache: "no-store" },
        ),
      ]);
      const [summaryData, meetingsData] = await Promise.all([
        summaryResponse.json(),
        meetingsResponse.json(),
      ]);
      if (!summaryResponse.ok)
        throw new Error(summaryData.error || "Não foi possível carregar os indicadores.");
      if (!meetingsResponse.ok)
        throw new Error(meetingsData.error || "Não foi possível carregar os próximos compromissos.");
      setOverviewSummary({
        total: Number(summaryData.total || 0),
        voters: Number(summaryData.voters || 0),
        leaders: Number(summaryData.leaders || 0),
        meetings: Number(summaryData.meetings || 0),
        districtsReached: Number(summaryData.districtsReached || 0),
      });
      const previewRecords = Array.isArray(meetingsData.records)
        ? (meetingsData.records as OwnedRecord[])
        : [];
      setOverviewMeetings(
        previewRecords.map((record) => ({
          id: record.id,
          ownerEmail: record.ownerEmail,
          ...(record.payload as Meeting),
        })),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a Visão Geral agora.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, [scope]);

  useEffect(() => {
    setRecords([]);
    setOverviewSummary(EMPTY_OVERVIEW_SUMMARY);
    setOverviewMeetings([]);
    setContactsLoadedScope(null);
    setMeetingsLoadedScope(null);
    setDraftsLoadedScope(null);
    setLoadingContacts(false);
    setLoadingMeetings(false);
    setLoadingDrafts(false);
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (
      (view !== "Contatos" && view !== "Mapa Eleitoral") ||
      contactsLoadedScope === scope
    )
      return;
    let cancelled = false;
    setLoadingContacts(true);
    apiFetch(
      `/api/records?owner=${encodeURIComponent(scope)}&kind=contact&mode=dashboard`,
      { cache: "no-store" },
    )
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar os contatos.");
        const contactRecords = Array.isArray(data.records)
          ? (data.records as OwnedRecord[])
          : [];
        setRecords((current) => [
          ...current.filter((record) => record.kind !== "contact"),
          ...contactRecords,
        ]);
        setContactsLoadedScope(scope);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os contatos agora.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactsLoadedScope, scope, view]);

  useEffect(() => {
    if (view !== "Agenda Inteligente" || meetingsLoadedScope === scope) return;
    let cancelled = false;
    setLoadingMeetings(true);
    apiFetch(
      `/api/records?owner=${encodeURIComponent(scope)}&kind=meeting&mode=dashboard`,
      { cache: "no-store" },
    )
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar a agenda.");
        const meetingRecords = Array.isArray(data.records)
          ? (data.records as OwnedRecord[])
          : [];
        setRecords((current) => [
          ...current.filter((record) => record.kind !== "meeting"),
          ...meetingRecords,
        ]);
        setMeetingsLoadedScope(scope);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a agenda agora.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingMeetings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingsLoadedScope, scope, view]);
'''
replace_once(old_effect, new_effect, 'initial data effect')

replace_once(
'''    if (view !== "WhatsApp" || loadingData || draftsLoadedScope === scope) return;''',
'''    if (view !== "WhatsApp" || draftsLoadedScope === scope) return;''',
'whatsapp guard',
)
replace_once(
'''  }, [draftsLoadedScope, loadingData, scope, view]);''',
'''  }, [draftsLoadedScope, scope, view]);''',
'whatsapp deps',
)

replace_once(
'''    setRecords((current) => [data.record, ...current]);
    setNotice(
''',
'''    setRecords((current) => [data.record, ...current]);
    void loadOverview();
    setNotice(
''',
'create refresh overview',
)

replace_once(
'''    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    setNotice("Contato atualizado com segurança.");
''',
'''    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    void loadOverview();
    setNotice("Contato atualizado com segurança.");
''',
'contact update refresh overview',
)
replace_once(
'''    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    setNotice("Reunião atualizada com segurança.");
''',
'''    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    void loadOverview();
    setNotice("Reunião atualizada com segurança.");
''',
'meeting update refresh overview',
)
replace_once(
'''    setRecords((current) => current.filter((record) => record.id !== id));
    setNotice(`${label} excluído.`);
''',
'''    setRecords((current) => current.filter((record) => record.id !== id));
    void loadOverview();
    setNotice(`${label} excluído.`);
''',
'delete refresh overview',
)

old_content = '''  const content = loadingData ? (
    <div className="loading-state">Carregando ambiente protegido…</div>
  ) : view === "Visão Geral" ? (
    <Overview
      go={setView}
      open={setModal}
      openVoterReport={openVoterReport}
      contacts={contacts}
      meetings={meetings}
      contextName={contextName}
      userName={currentUser.name}
    />
  ) : view === "Contatos" ? (
    <ContactManager
      contacts={contacts}
      open={setModal}
      filter={contactFilter}
      setFilter={setContactFilter}
      districtFilter={contactDistrictFilter}
      setDistrictFilter={setContactDistrictFilter}
      scope={scope}
      tell={setNotice}
      importContact={(payload) => createRecord("contact", payload)}
      updateContact={updateContact}
      deleteContact={(id) => deleteRecord(id, "Contato")}
      isAdmin={isAdmin}
    />
  ) : view === "Agenda Inteligente" ? (
    <Agenda
      meetings={meetings}
      tell={setNotice}
      open={setModal}
      updateMeeting={updateMeeting}
      deleteMeeting={(id) => deleteRecord(id, "Reunião")}
      isAdmin={isAdmin}
      users={availableUsers}
    />
  ) : view === "Mapa Eleitoral" ? (
    <MapPage open={setModal} contacts={contacts} />
  ) : view === "WhatsApp" ? (
'''
new_content = '''  const content = view === "Visão Geral" ? (
    loadingOverview ? (
      <div className="loading-state">Carregando indicadores…</div>
    ) : (
      <Overview
        go={setView}
        open={setModal}
        openVoterReport={openVoterReport}
        summary={overviewSummary}
        meetings={overviewMeetings}
        contextName={contextName}
        userName={currentUser.name}
      />
    )
  ) : view === "Contatos" ? (
    loadingContacts && contactsLoadedScope !== scope ? (
      <div className="loading-state">Carregando contatos…</div>
    ) : (
      <ContactManager
        contacts={contacts}
        open={setModal}
        filter={contactFilter}
        setFilter={setContactFilter}
        districtFilter={contactDistrictFilter}
        setDistrictFilter={setContactDistrictFilter}
        scope={scope}
        tell={setNotice}
        importContact={(payload) => createRecord("contact", payload)}
        updateContact={updateContact}
        deleteContact={(id) => deleteRecord(id, "Contato")}
        isAdmin={isAdmin}
      />
    )
  ) : view === "Agenda Inteligente" ? (
    loadingMeetings && meetingsLoadedScope !== scope ? (
      <div className="loading-state">Carregando agenda…</div>
    ) : (
      <Agenda
        meetings={meetings}
        tell={setNotice}
        open={setModal}
        updateMeeting={updateMeeting}
        deleteMeeting={(id) => deleteRecord(id, "Reunião")}
        isAdmin={isAdmin}
        users={availableUsers}
      />
    )
  ) : view === "Mapa Eleitoral" ? (
    loadingContacts && contactsLoadedScope !== scope ? (
      <div className="loading-state">Carregando mapa eleitoral…</div>
    ) : (
      <MapPage open={setModal} contacts={contacts} />
    )
  ) : view === "WhatsApp" ? (
'''
replace_once(old_content, new_content, 'content lazy views')

replace_once(
'''    <Overview
      go={setView}
      open={setModal}
      openVoterReport={openVoterReport}
      contacts={contacts}
      meetings={meetings}
      contextName={contextName}
      userName={currentUser.name}
    />
''',
'''    <Overview
      go={setView}
      open={setModal}
      openVoterReport={openVoterReport}
      summary={overviewSummary}
      meetings={overviewMeetings}
      contextName={contextName}
      userName={currentUser.name}
    />
''',
'fallback overview props',
)

replace_once(
'''                  onChange={(event) => {
                    setLoadingData(true);
                    setScope(event.target.value);
                  }}
''',
'''                  onChange={(event) => {
                    setScope(event.target.value);
                  }}
''',
'scope picker loading',
)

replace_once(
'''function Overview({
  go,
  open,
  openVoterReport,
  contacts,
  meetings,
  contextName,
  userName,
}: {
  go: (v: View) => void;
  open: (m: Modal) => void;
  openVoterReport: () => void;
  contacts: (Contact & { id: number; ownerEmail: string })[];
  meetings: (Meeting & { id: number; ownerEmail: string })[];
  contextName: string;
  userName: string;
}) {
''',
'''function Overview({
  go,
  open,
  openVoterReport,
  summary,
  meetings,
  contextName,
  userName,
}: {
  go: (v: View) => void;
  open: (m: Modal) => void;
  openVoterReport: () => void;
  summary: OverviewSummary;
  meetings: (Meeting & { id: number; ownerEmail: string })[];
  contextName: string;
  userName: string;
}) {
''',
'overview signature',
)

replace_once(
'''  const leaders = contacts.filter(
    (person) => person.kind === "Liderança",
  ).length;
  const voters = contacts.filter((person) => person.kind === "Eleitor").length;
  const districts = new Set(
    contacts.map((person) => person.district).filter(Boolean),
  ).size;
''',
'''  const leaders = summary.leaders;
  const voters = summary.voters;
  const districts = summary.districtsReached;
''',
'overview metrics',
)

replace_once(
'''          value={String(meetings.length)}
          label="Reuniões agendadas"
''',
'''          value={String(summary.meetings)}
          label="Reuniões agendadas"
''',
'overview meeting metric',
)

path.write_text(text)
print('patched', path, len(text))
