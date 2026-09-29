import type {
  DistrictStatistics,
  TerritoryStatistics,
} from "./territory-statistics";

export type TerritoryRankingKey =
  | "growth"
  | "coverage"
  | "low-coverage"
  | "voters"
  | "leaders"
  | "unmapped"
  | "balance";

export type TerritoryRankingItem = {
  district: DistrictStatistics;
  value: number;
  label: string;
};

export type TerritoryRankings = Record<
  TerritoryRankingKey,
  TerritoryRankingItem[]
>;

function takeTop(
  districts: DistrictStatistics[],
  selector: (district: DistrictStatistics) => number,
  label: (district: DistrictStatistics) => string,
  direction: "asc" | "desc" = "desc",
  limit = 10,
) {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...districts]
    .sort((a, b) => {
      const difference = selector(a) - selector(b);
      if (difference !== 0) return difference * multiplier;
      return b.total - a.total || a.name.localeCompare(b.name, "pt-BR");
    })
    .slice(0, limit)
    .map((district) => ({
      district,
      value: selector(district),
      label: label(district),
    }));
}

function calculateBalanceScore(district: DistrictStatistics) {
  if (!district.total) return 0;
  const idealLeaders = Math.max(1, district.voters / 12);
  const leaderDifference = Math.abs(district.leaders - idealLeaders);
  const representationScore = Math.max(
    0,
    100 - Math.round((leaderDifference / idealLeaders) * 100),
  );
  return Math.round(
    representationScore * 0.65 + district.mappedPercent * 0.35,
  );
}

export function buildTerritoryRankings(
  statistics: TerritoryStatistics,
  limit = 10,
): TerritoryRankings {
  const districts = statistics.districts;

  return {
    growth: takeTop(
      districts,
      (district) => district.weeklyGrowth,
      (district) => `${district.weeklyGrowth >= 0 ? "+" : ""}${district.weeklyGrowth}% na semana`,
      "desc",
      limit,
    ),
    coverage: takeTop(
      districts,
      (district) => district.mappedPercent,
      (district) => `${district.mappedPercent}% mapeado`,
      "desc",
      limit,
    ),
    "low-coverage": takeTop(
      districts,
      (district) => district.mappedPercent,
      (district) => `${district.unmapped} pendências · ${district.mappedPercent}% mapeado`,
      "asc",
      limit,
    ),
    voters: takeTop(
      districts,
      (district) => district.voters,
      (district) => `${district.voters} eleitores`,
      "desc",
      limit,
    ),
    leaders: takeTop(
      districts,
      (district) => district.leaders,
      (district) => `${district.leaders} lideranças`,
      "desc",
      limit,
    ),
    unmapped: takeTop(
      districts,
      (district) => district.unmapped,
      (district) => `${district.unmapped} sem geolocalização`,
      "desc",
      limit,
    ),
    balance: takeTop(
      districts,
      calculateBalanceScore,
      (district) => `${calculateBalanceScore(district)} pontos de equilíbrio`,
      "desc",
      limit,
    ),
  };
}
