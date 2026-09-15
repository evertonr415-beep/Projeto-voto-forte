/**
 * Delimitação Geográfica e Polígonos dos Bairros de Arapongas - PR
 * Base cartográfica com centróides e vértices poligonais para regionalização eleitoral.
 */

export type DistrictGeometry = {
  id: string;
  name: string;
  centroid: [number, number];
  polygon: [number, number][];
  color: string;
};

export const ARAPONGAS_DISTRICTS_GEO: DistrictGeometry[] = [
  {
    id: "centro",
    name: "Centro",
    centroid: [-23.4153, -51.4256],
    color: "#38bdf8",
    polygon: [
      [-23.4095, -51.4310],
      [-23.4090, -51.4200],
      [-23.4190, -51.4180],
      [-23.4215, -51.4280],
      [-23.4170, -51.4330],
      [-23.4095, -51.4310],
    ],
  },
  {
    id: "flamingos",
    name: "Conjunto Flamingos",
    centroid: [-23.3980, -51.4320],
    color: "#fbbf24",
    polygon: [
      [-23.3920, -51.4380],
      [-23.3910, -51.4260],
      [-23.4040, -51.4250],
      [-23.4050, -51.4370],
      [-23.3920, -51.4380],
    ],
  },
  {
    id: "san_raphael",
    name: "Jardim San Raphael",
    centroid: [-23.4080, -51.4180],
    color: "#34d399",
    polygon: [
      [-23.4020, -51.4240],
      [-23.4010, -51.4120],
      [-23.4140, -51.4110],
      [-23.4130, -51.4230],
      [-23.4020, -51.4240],
    ],
  },
  {
    id: "panorama",
    name: "Jardim Panorama",
    centroid: [-23.4240, -51.4150],
    color: "#a78bfa",
    polygon: [
      [-23.4180, -51.4200],
      [-23.4170, -51.4090],
      [-23.4300, -51.4080],
      [-23.4310, -51.4190],
      [-23.4180, -51.4200],
    ],
  },
  {
    id: "caravelle",
    name: "Jardim Caravelle",
    centroid: [-23.4290, -51.4290],
    color: "#f472b6",
    polygon: [
      [-23.4230, -51.4350],
      [-23.4220, -51.4240],
      [-23.4350, -51.4230],
      [-23.4360, -51.4340],
      [-23.4230, -51.4350],
    ],
  },
  {
    id: "del_condor",
    name: "Conjunto Del Condor",
    centroid: [-23.4020, -51.4100],
    color: "#f97316",
    polygon: [
      [-23.3960, -51.4160],
      [-23.3950, -51.4040],
      [-23.4080, -51.4030],
      [-23.4090, -51.4150],
      [-23.3960, -51.4160],
    ],
  },
  {
    id: "primavera",
    name: "Jardim Primavera",
    centroid: [-23.4180, -51.4420],
    color: "#2dd4bf",
    polygon: [
      [-23.4120, -51.4480],
      [-23.4110, -51.4360],
      [-23.4240, -51.4350],
      [-23.4250, -51.4470],
      [-23.4120, -51.4480],
    ],
  },
  {
    id: "vila_nova",
    name: "Vila Nova",
    centroid: [-23.4100, -51.4350],
    color: "#60a5fa",
    polygon: [
      [-23.4050, -51.4410],
      [-23.4040, -51.4300],
      [-23.4160, -51.4290],
      [-23.4170, -51.4400],
      [-23.4050, -51.4410],
    ],
  },
  {
    id: "araponguinha",
    name: "Vila Araponguinha",
    centroid: [-23.4220, -51.4380],
    color: "#c084fc",
    polygon: [
      [-23.4160, -51.4440],
      [-23.4150, -51.4320],
      [-23.4280, -51.4310],
      [-23.4290, -51.4430],
      [-23.4160, -51.4440],
    ],
  },
  {
    id: "petropolis",
    name: "Jardim Petrópolis",
    centroid: [-23.4060, -51.4460],
    color: "#e879f9",
    polygon: [
      [-23.4000, -51.4520],
      [-23.3990, -51.4400],
      [-23.4120, -51.4390],
      [-23.4130, -51.4510],
      [-23.4000, -51.4520],
    ],
  },
  {
    id: "columbia",
    name: "Jardim Columbia",
    centroid: [-23.4350, -51.4200],
    color: "#4ade80",
    polygon: [
      [-23.4290, -51.4260],
      [-23.4280, -51.4140],
      [-23.4410, -51.4130],
      [-23.4420, -51.4250],
      [-23.4290, -51.4260],
    ],
  },
  {
    id: "monaco",
    name: "Jardim Mônaco",
    centroid: [-23.4120, -51.4080],
    color: "#facc15",
    polygon: [
      [-23.4060, -51.4140],
      [-23.4050, -51.4020],
      [-23.4180, -51.4010],
      [-23.4190, -51.4130],
      [-23.4060, -51.4140],
    ],
  },
  {
    id: "aeroporto",
    name: "Jardim Aeroporto",
    centroid: [-23.3850, -51.4450],
    color: "#38bdf8",
    polygon: [
      [-23.3790, -51.4510],
      [-23.3780, -51.4390],
      [-23.3910, -51.4380],
      [-23.3920, -51.4500],
      [-23.3790, -51.4510],
    ],
  },
  {
    id: "palmares",
    name: "Conjunto Palmares",
    centroid: [-23.3940, -51.4210],
    color: "#818cf8",
    polygon: [
      [-23.3880, -51.4270],
      [-23.3870, -51.4150],
      [-23.4000, -51.4140],
      [-23.4010, -51.4260],
      [-23.3880, -51.4270],
    ],
  },
  {
    id: "vale_das_perobas",
    name: "Jardim Vale das Perobas",
    centroid: [-23.4280, -51.4050],
    color: "#fb7185",
    polygon: [
      [-23.4220, -51.4110],
      [-23.4210, -51.3990],
      [-23.4340, -51.3980],
      [-23.4350, -51.4100],
      [-23.4220, -51.4110],
    ],
  },
  {
    id: "bandeirantes",
    name: "Jardim Bandeirantes",
    centroid: [-23.4190, -51.4100],
    color: "#34d399",
    polygon: [
      [-23.4130, -51.4160],
      [-23.4120, -51.4040],
      [-23.4250, -51.4030],
      [-23.4260, -51.4150],
      [-23.4130, -51.4160],
    ],
  },
  {
    id: "interlagos",
    name: "Jardim Interlagos",
    centroid: [-23.4320, -51.4400],
    color: "#f59e0b",
    polygon: [
      [-23.4260, -51.4460],
      [-23.4250, -51.4340],
      [-23.4380, -51.4330],
      [-23.4390, -51.4450],
      [-23.4260, -51.4460],
    ],
  },
  {
    id: "parque_industrial",
    name: "Parque Industrial",
    centroid: [-23.3750, -51.4500],
    color: "#94a3b8",
    polygon: [
      [-23.3680, -51.4580],
      [-23.3670, -51.4420],
      [-23.3820, -51.4410],
      [-23.3830, -51.4570],
      [-23.3680, -51.4580],
    ],
  },
  {
    id: "vila_aparecida",
    name: "Vila Aparecida",
    centroid: [-23.4140, -51.4320],
    color: "#a3e635",
    polygon: [
      [-23.4090, -51.4370],
      [-23.4080, -51.4270],
      [-23.4190, -51.4260],
      [-23.4200, -51.4360],
      [-23.4090, -51.4370],
    ],
  },
  {
    id: "tropical",
    name: "Jardim Tropical",
    centroid: [-23.4040, -51.4380],
    color: "#38bdf8",
    polygon: [
      [-23.3990, -51.4430],
      [-23.3980, -51.4330],
      [-23.4090, -51.4320],
      [-23.4100, -51.4420],
      [-23.3990, -51.4430],
    ],
  },
  {
    id: "santa_alice",
    name: "Jardim Santa Alice",
    centroid: [-23.4260, -51.4240],
    color: "#ec4899",
    polygon: [
      [-23.4210, -51.4290],
      [-23.4200, -51.4190],
      [-23.4310, -51.4180],
      [-23.4320, -51.4280],
      [-23.4210, -51.4290],
    ],
  },
  {
    id: "aguias",
    name: "Conjunto Águias",
    centroid: [-23.3910, -51.4280],
    color: "#10b981",
    polygon: [
      [-23.3860, -51.4330],
      [-23.3850, -51.4230],
      [-23.3960, -51.4220],
      [-23.3970, -51.4320],
      [-23.3860, -51.4330],
    ],
  },
  {
    id: "universitario",
    name: "Jardim Universitário",
    centroid: [-23.4380, -51.4320],
    color: "#8b5cf6",
    polygon: [
      [-23.4330, -51.4370],
      [-23.4320, -51.4270],
      [-23.4430, -51.4260],
      [-23.4440, -51.4360],
      [-23.4330, -51.4370],
    ],
  },
  {
    id: "aricanduva",
    name: "Aricanduva",
    centroid: [-23.4650, -51.4800],
    color: "#14b8a6",
    polygon: [
      [-23.4550, -51.4920],
      [-23.4540, -51.4680],
      [-23.4750, -51.4670],
      [-23.4760, -51.4910],
      [-23.4550, -51.4920],
    ],
  },
  {
    id: "zona_rural",
    name: "Zona Rural",
    centroid: [-23.4450, -51.4600],
    color: "#64748b",
    polygon: [
      [-23.4350, -51.4750],
      [-23.4340, -51.4450],
      [-23.4550, -51.4440],
      [-23.4560, -51.4740],
      [-23.4350, -51.4750],
    ],
  },
];

/**
 * Normaliza o nome do bairro para correspondência exata ou aproximada
 */
export function matchDistrictGeo(districtName: string): DistrictGeometry | null {
  if (!districtName) return null;
  const clean = districtName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Match direto por ID ou nome
  const direct = ARAPONGAS_DISTRICTS_GEO.find((d) => {
    const dClean = d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return dClean === clean || clean.includes(dClean) || dClean.includes(clean);
  });
  if (direct) return direct;

  // Match de palavras-chave
  if (clean.includes("flamingos")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "flamingos") || null;
  if (clean.includes("san raphael") || clean.includes("raphael")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "san_raphael") || null;
  if (clean.includes("panorama")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "panorama") || null;
  if (clean.includes("caravelle")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "caravelle") || null;
  if (clean.includes("condor")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "del_condor") || null;
  if (clean.includes("primavera")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "primavera") || null;
  if (clean.includes("araponguinha")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "araponguinha") || null;
  if (clean.includes("petropolis")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "petropolis") || null;
  if (clean.includes("columbia")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "columbia") || null;
  if (clean.includes("monaco")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "monaco") || null;
  if (clean.includes("aeroporto")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "aeroporto") || null;
  if (clean.includes("palmares")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "palmares") || null;
  if (clean.includes("perobas")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "vale_das_perobas") || null;
  if (clean.includes("bandeirantes")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "bandeirantes") || null;
  if (clean.includes("interlagos")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "interlagos") || null;
  if (clean.includes("industrial")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "parque_industrial") || null;
  if (clean.includes("aparecida")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "vila_aparecida") || null;
  if (clean.includes("tropical")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "tropical") || null;
  if (clean.includes("santa alice") || clean.includes("alice")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "santa_alice") || null;
  if (clean.includes("aguias")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "aguias") || null;
  if (clean.includes("universitario")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "universitario") || null;
  if (clean.includes("aricanduva")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "aricanduva") || null;
  if (clean.includes("rural")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "zona_rural") || null;
  if (clean.includes("vila nova") || clean.includes("nova")) return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "vila_nova") || null;

  return ARAPONGAS_DISTRICTS_GEO.find((d) => d.id === "centro") || null;
}
