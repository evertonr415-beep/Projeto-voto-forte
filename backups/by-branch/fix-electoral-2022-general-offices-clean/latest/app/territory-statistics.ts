export type TerritoryRecord = {
  kind?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  payload?: {
    district?: string;
    kind?: string;
    latitude?: number | string;
    longitude?: number | string;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
  };
};

export type DistrictStatistics = {
  key: string;
  name: string;
  total: number;
  voters: number;
  leaders: number;
  mapped: number;
  unmapped: number;
  mappedPercent: number;
  lastRegistrationAt: string | null;
  registrationsToday: number;
  registrationsLast7Days: number;
  registrationsPrevious7Days: number;
  weeklyGrowth: number;
};

export type TerritoryStatistics = {
  total: number;
  voters: number;
  leaders: number;
  mapped: number;
  unmapped: number;
  mappedPercent: number;
  districtsReached: number;
  registrationsToday: number;
  registrationsLast7Days: number;
  registrationsPrevious7Days: number;
  weeklyGrowth: number;
  districts: DistrictStatistics[];
};

export function normalizeTerritoryText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function parseRecordDate(record: TerritoryRecord) {
  const candidates = [
    record.createdAt,
    record.created_at,
    record.payload?.createdAt,
    record.payload?.created_at,
    record.updatedAt,
    record.updated_at,
    record.payload?.updatedAt,
    record.payload?.updated_at,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function isMapped(record: TerritoryRecord) {
  const latitude = Number(record.payload?.latitude);
  const longitude = Number(record.payload?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function isLeader(record: TerritoryRecord) {
  return normalizeTerritoryText(record.payload?.kind).includes("LIDER");
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildTerritoryStatistics(
  records: TerritoryRecord[],
  referenceDate = new Date(),
): TerritoryStatistics {
  const contacts = records.filter((record) => record.kind === "contact");
  const todayStart = startOfDay(referenceDate);
  const currentPeriodStart = new Date(todayStart);
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 6);
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);

  const grouped = new Map<
    string,
    {
      name: string;
      records: TerritoryRecord[];
    }
  >();

  for (const record of contacts) {
    const district = String(record.payload?.district || "").trim();
    if (!district) continue;
    const key = normalizeTerritoryText(district);
    const current = grouped.get(key) || { name: district, records: [] };
    current.records.push(record);
    grouped.set(key, current);
  }

  const districts = Array.from(grouped.entries())
    .map(([key, group]): DistrictStatistics => {
      let voters = 0;
      let leaders = 0;
      let mapped = 0;
      let registrationsToday = 0;
      let registrationsLast7Days = 0;
      let registrationsPrevious7Days = 0;
      let lastRegistration: Date | null = null;

      for (const record of group.records) {
        if (isLeader(record)) leaders += 1;
        else voters += 1;
        if (isMapped(record)) mapped += 1;

        const recordDate = parseRecordDate(record);
        if (!recordDate) continue;
        if (!lastRegistration || recordDate > lastRegistration) {
          lastRegistration = recordDate;
        }
        if (recordDate >= todayStart) registrationsToday += 1;
        if (recordDate >= currentPeriodStart) registrationsLast7Days += 1;
        else if (recordDate >= previousPeriodStart) {
          registrationsPrevious7Days += 1;
        }
      }

      const total = group.records.length;
      return {
        key,
        name: group.name,
        total,
        voters,
        leaders,
        mapped,
        unmapped: total - mapped,
        mappedPercent: total ? Math.round((mapped / total) * 100) : 0,
        lastRegistrationAt: lastRegistration?.toISOString() || null,
        registrationsToday,
        registrationsLast7Days,
        registrationsPrevious7Days,
        weeklyGrowth: calculateGrowth(
          registrationsLast7Days,
          registrationsPrevious7Days,
        ),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));

  const voters = contacts.filter((record) => !isLeader(record)).length;
  const leaders = contacts.length - voters;
  const mapped = contacts.filter(isMapped).length;
  const registrationsToday = districts.reduce(
    (total, district) => total + district.registrationsToday,
    0,
  );
  const registrationsLast7Days = districts.reduce(
    (total, district) => total + district.registrationsLast7Days,
    0,
  );
  const registrationsPrevious7Days = districts.reduce(
    (total, district) => total + district.registrationsPrevious7Days,
    0,
  );

  return {
    total: contacts.length,
    voters,
    leaders,
    mapped,
    unmapped: contacts.length - mapped,
    mappedPercent: contacts.length
      ? Math.round((mapped / contacts.length) * 100)
      : 0,
    districtsReached: districts.length,
    registrationsToday,
    registrationsLast7Days,
    registrationsPrevious7Days,
    weeklyGrowth: calculateGrowth(
      registrationsLast7Days,
      registrationsPrevious7Days,
    ),
    districts,
  };
}
