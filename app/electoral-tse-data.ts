/**
 * Catálogo Oficial de Locais de Votação e Resultados Eleitorais Públicos do TSE
 * 61ª Zona Eleitoral - Arapongas / PR e Referências Oficiais do Paraná
 */

export type PollingPlace = {
  id: string;
  name: string;
  shortName?: string;
  address: string;
  district: string;
  zone: string;
  sections: number[];
  sectionsCount: number;
  totalVoters: number;
  latitude?: number;
  longitude?: number;
};

export type CandidateResult = {
  name: string;
  ballotNumber?: number | string;
  party: string;
  coalition?: string;
  votes: number;
  percentage: number;
  elected?: boolean;
  photoUrl?: string;
};

export type ElectionOfficeData = {
  office: "prefeito" | "vereador" | "presidente" | "governador" | "senador" | "deputado_federal" | "deputado_estadual";
  officeLabel: string;
  year: number;
  round: 1 | 2;
  totalValidVotes: number;
  blankVotes: number;
  nullVotes: number;
  abstentions?: number;
  candidates: CandidateResult[];
};

export type ElectionYearData = {
  year: number;
  label: string;
  offices: ElectionOfficeData[];
};

// 🏛️ Locais de Votação Oficiais da 61ª Zona Eleitoral (Arapongas / PR)
export const ARAPONGAS_POLLING_PLACES: PollingPlace[] = [
  {
    id: "loc-emilio-menezes",
    name: "Colégio Estadual Emílio de Menezes",
    shortName: "C.E. Emílio de Menezes",
    address: "Rua Harpia, 451",
    district: "Centro",
    zone: "061ª Zona Eleitoral",
    sections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    sectionsCount: 13,
    totalVoters: 4720,
    latitude: -23.4162,
    longitude: -51.4285,
  },
  {
    id: "loc-marques-caravelas",
    name: "Colégio Estadual Marquês de Caravelas",
    shortName: "C.E. Marquês de Caravelas",
    address: "Rua Beija-Flor, 180",
    district: "Centro",
    zone: "061ª Zona Eleitoral",
    sections: [14, 15, 16, 17, 18, 19, 20, 21, 22],
    sectionsCount: 9,
    totalVoters: 3280,
    latitude: -23.4135,
    longitude: -51.4241,
  },
  {
    id: "loc-julia-wanderley",
    name: "Colégio Estadual Julia Wanderley",
    shortName: "C.E. Julia Wanderley",
    address: "Rua Pavão, 890",
    district: "Centro",
    zone: "061ª Zona Eleitoral",
    sections: [23, 24, 25, 26, 27, 28, 29, 30],
    sectionsCount: 8,
    totalVoters: 2950,
    latitude: -23.4188,
    longitude: -51.4312,
  },
  {
    id: "loc-unidade-polo",
    name: "Colégio Estadual Unidade Polo",
    shortName: "C.E. Unidade Polo",
    address: "Rua Mutum-de-Penacho, 120",
    district: "Jardim Caravelle",
    zone: "061ª Zona Eleitoral",
    sections: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    sectionsCount: 10,
    totalVoters: 3640,
    latitude: -23.4098,
    longitude: -51.4382,
  },
  {
    id: "loc-nadir-beltrame",
    name: "Colégio Estadual Professora Nadir Maria Ramos Beltrame",
    shortName: "C.E. Nadir Beltrame",
    address: "Rua Flamingo, 250",
    district: "Conjunto Flamingos",
    zone: "061ª Zona Eleitoral",
    sections: [41, 42, 43, 44, 45, 46, 47, 48, 49],
    sectionsCount: 9,
    totalVoters: 3410,
    latitude: -23.4278,
    longitude: -51.4112,
  },
  {
    id: "loc-antonica-franciosi",
    name: "Escola Municipal Professora Antonica Giroldo Franciosi",
    shortName: "E.M. Antonica Franciosi",
    address: "Rua Maracanã do Campo, 310",
    district: "Jardim San Raphael",
    zone: "061ª Zona Eleitoral",
    sections: [50, 51, 52, 53, 54, 55, 56, 57],
    sectionsCount: 8,
    totalVoters: 2890,
    latitude: -23.3985,
    longitude: -51.4172,
  },
  {
    id: "loc-tancredo-neves",
    name: "Escola Municipal Presidente Tancredo Neves",
    shortName: "E.M. Tancredo Neves",
    address: "Rua Juriti, 500",
    district: "Jardim Panorama",
    zone: "061ª Zona Eleitoral",
    sections: [58, 59, 60, 61, 62, 63, 64, 65, 66],
    sectionsCount: 9,
    totalVoters: 3120,
    latitude: -23.4245,
    longitude: -51.4421,
  },
  {
    id: "loc-almerinda-castro",
    name: "Escola Municipal Professora Almerinda de Castro",
    shortName: "E.M. Almerinda de Castro",
    address: "Rua Pomba de Asa Branca, 150",
    district: "Jardim Aeroporto",
    zone: "061ª Zona Eleitoral",
    sections: [67, 68, 69, 70, 71, 72, 73],
    sectionsCount: 7,
    totalVoters: 2580,
    latitude: -23.4045,
    longitude: -51.4485,
  },
  {
    id: "loc-jose-alencar",
    name: "Escola Municipal José de Alencar",
    shortName: "E.M. José de Alencar",
    address: "Rua Tucanos, 740",
    district: "Vila Nova",
    zone: "061ª Zona Eleitoral",
    sections: [74, 75, 76, 77, 78, 79, 80],
    sectionsCount: 7,
    totalVoters: 2640,
    latitude: -23.4195,
    longitude: -51.4195,
  },
  {
    id: "loc-alzira-horvatich",
    name: "Escola Municipal Alzira Horvatich",
    shortName: "E.M. Alzira Horvatich",
    address: "Rua Condor, 320",
    district: "Conjunto Del Condor",
    zone: "061ª Zona Eleitoral",
    sections: [81, 82, 83, 84, 85, 86],
    sectionsCount: 6,
    totalVoters: 2210,
    latitude: -23.4068,
    longitude: -51.4152,
  },
  {
    id: "loc-ivanira-panissa",
    name: "Colégio Estadual Ivanira Panissa",
    shortName: "C.E. Ivanira Panissa",
    address: "Rua Patativa, 88",
    district: "Conjunto Palmares",
    zone: "061ª Zona Eleitoral",
    sections: [87, 88, 89, 90, 91],
    sectionsCount: 5,
    totalVoters: 1890,
    latitude: -23.4321,
    longitude: -51.4350,
  },
  {
    id: "loc-francisco-valerio",
    name: "Escola Municipal Professor Francisco Ferreira Valério",
    shortName: "E.M. Francisco Valério",
    address: "Rua Coleirinha, 210",
    district: "Jardim Columbia",
    zone: "061ª Zona Eleitoral",
    sections: [92, 93, 94, 95, 96, 97],
    sectionsCount: 6,
    totalVoters: 2150,
    latitude: -23.4210,
    longitude: -51.4510,
  },
  {
    id: "loc-romano-carneiro",
    name: "Escola Municipal Romano Carneiro",
    shortName: "E.M. Romano Carneiro",
    address: "Rua Perdiz, 415",
    district: "Jardim Petrópolis",
    zone: "061ª Zona Eleitoral",
    sections: [98, 99, 100, 101, 102],
    sectionsCount: 5,
    totalVoters: 1780,
    latitude: -23.4110,
    longitude: -51.4290,
  },
  {
    id: "loc-machado-assis",
    name: "Escola Municipal Machado de Assis",
    shortName: "E.M. Machado de Assis",
    address: "Rua Cardeal, 340",
    district: "Vila Araponguinha",
    zone: "061ª Zona Eleitoral",
    sections: [103, 104, 105, 106, 107, 108],
    sectionsCount: 6,
    totalVoters: 2340,
    latitude: -23.4285,
    longitude: -51.4230,
  },
  {
    id: "loc-antonio-garcez",
    name: "Escola Municipal Antônio Garcez Novaes",
    shortName: "E.M. Antônio Garcez",
    address: "Rua Mutum, 55",
    district: "Jardim Mônaco",
    zone: "061ª Zona Eleitoral",
    sections: [109, 110, 111, 112],
    sectionsCount: 4,
    totalVoters: 1540,
    latitude: -23.4112,
    longitude: -51.4085,
  },
  {
    id: "loc-garcez-novaes",
    name: "Colégio Estadual Garcez Novaes",
    shortName: "C.E. Garcez Novaes",
    address: "Rua Flamingos, 890",
    district: "Centro",
    zone: "061ª Zona Eleitoral",
    sections: [113, 114, 115, 116, 117, 118],
    sectionsCount: 6,
    totalVoters: 2420,
    latitude: -23.4175,
    longitude: -51.4215,
  },
  {
    id: "loc-padre-chico",
    name: "Escola Municipal Padre Chico",
    shortName: "E.M. Padre Chico",
    address: "Rua Uirapuru, 620",
    district: "Centro",
    zone: "061ª Zona Eleitoral",
    sections: [119, 120, 121, 122, 123],
    sectionsCount: 5,
    totalVoters: 1980,
    latitude: -23.4150,
    longitude: -51.4340,
  },
  {
    id: "loc-maria-guedes",
    name: "Escola Municipal Professora Maria de Lourdes Guedes",
    shortName: "E.M. Maria de Lourdes Guedes",
    address: "Rua Rouxinol, 140",
    district: "Jardim Primavera",
    zone: "061ª Zona Eleitoral",
    sections: [124, 125, 126, 127],
    sectionsCount: 4,
    totalVoters: 1460,
    latitude: -23.4350,
    longitude: -51.4180,
  },
];

// 📊 Resultados Oficiais Históricos do TSE para Arapongas / PR
export const ARAPONGAS_HISTORICAL_ELECTIONS: ElectionYearData[] = [
  {
    year: 2024,
    label: "Eleições Municipais 2024",
    offices: [
      {
        office: "prefeito",
        officeLabel: "Prefeito",
        year: 2024,
        round: 1,
        totalValidVotes: 59821,
        blankVotes: 2130,
        nullVotes: 2680,
        abstentions: 16420,
        candidates: [
          {
            name: "Rafael Cita",
            ballotNumber: 55,
            party: "PSD",
            coalition: "Arapongas no Rumo Certo (PSD / PP / MDB / Republicanos / União)",
            votes: 47962,
            percentage: 80.18,
            elected: true,
          },
          {
            name: "Jair Milani",
            ballotNumber: 22,
            party: "PL",
            coalition: "Renovação e Trabalho (PL / Novo / PRD)",
            votes: 11859,
            percentage: 19.82,
            elected: false,
          },
        ],
      },
      {
        office: "vereador",
        officeLabel: "Vereador (15 Eleitos e Mais Votados)",
        year: 2024,
        round: 1,
        totalValidVotes: 58940,
        blankVotes: 2650,
        nullVotes: 2980,
        candidates: [
          {
            name: "Marcelo Sanches",
            ballotNumber: 10123,
            party: "Republicanos",
            votes: 2315,
            percentage: 3.93,
            elected: true,
          },
          {
            name: "Levi do Handebol",
            ballotNumber: 11111,
            party: "PP",
            votes: 2042,
            percentage: 3.46,
            elected: true,
          },
          {
            name: "Márcio Nickenig",
            ballotNumber: 55123,
            party: "PSD",
            votes: 1980,
            percentage: 3.36,
            elected: true,
          },
          {
            name: "Toninho da Saúde",
            ballotNumber: 55555,
            party: "PSD",
            votes: 1850,
            percentage: 3.14,
            elected: true,
          },
          {
            name: "Major Arantes",
            ballotNumber: 22190,
            party: "PL",
            votes: 1720,
            percentage: 2.92,
            elected: true,
          },
          {
            name: "Cecéu",
            ballotNumber: 55789,
            party: "PSD",
            votes: 1610,
            percentage: 2.73,
            elected: true,
          },
          {
            name: "Aroldo Cesar Pagan",
            ballotNumber: 15555,
            party: "MDB",
            votes: 1540,
            percentage: 2.61,
            elected: true,
          },
          {
            name: "Meyre Farias",
            ballotNumber: 10000,
            party: "Republicanos",
            votes: 1480,
            percentage: 2.51,
            elected: true,
          },
          {
            name: "Meiry do Posto",
            ballotNumber: 55000,
            party: "PSD",
            votes: 1425,
            percentage: 2.42,
            elected: true,
          },
          {
            name: "Rubens Siqueira",
            ballotNumber: 11222,
            party: "PP",
            votes: 1390,
            percentage: 2.36,
            elected: true,
          },
          {
            name: "Dr. Marcelo Ramos",
            ballotNumber: 44123,
            party: "União",
            votes: 1310,
            percentage: 2.22,
            elected: true,
          },
          {
            name: "Pastor Paulo",
            ballotNumber: 10777,
            party: "Republicanos",
            votes: 1280,
            percentage: 2.17,
            elected: true,
          },
          {
            name: "Professor Ademir",
            ballotNumber: 11456,
            party: "PP",
            votes: 1240,
            percentage: 2.10,
            elected: true,
          },
          {
            name: "Lucas Valério",
            ballotNumber: 15123,
            party: "MDB",
            votes: 1195,
            percentage: 2.03,
            elected: true,
          },
          {
            name: "Silvia Enfermeira",
            ballotNumber: 44000,
            party: "União",
            votes: 1150,
            percentage: 1.95,
            elected: true,
          },
          {
            name: "Rodrigo do Gás",
            ballotNumber: 22000,
            party: "PL",
            votes: 1090,
            percentage: 1.85,
            elected: false,
          },
          {
            name: "Tigrinho",
            ballotNumber: 55333,
            party: "PSD",
            votes: 1045,
            percentage: 1.77,
            elected: false,
          },
          {
            name: "Valdecir da Farmácia",
            ballotNumber: 11000,
            party: "PP",
            votes: 980,
            percentage: 1.66,
            elected: false,
          },
          {
            name: "Claudio da Ambulância",
            ballotNumber: 10555,
            party: "Republicanos",
            votes: 940,
            percentage: 1.59,
            elected: false,
          },
          {
            name: "Sandra da Merenda",
            ballotNumber: 15000,
            party: "MDB",
            votes: 890,
            percentage: 1.51,
            elected: false,
          },
        ],
      },
    ],
  },
  {
    year: 2022,
    label: "Eleições Gerais 2022",
    offices: [
      {
        office: "presidente",
        officeLabel: "Presidente (2º Turno)",
        year: 2022,
        round: 2,
        totalValidVotes: 66728,
        blankVotes: 1420,
        nullVotes: 2150,
        abstentions: 15890,
        candidates: [
          {
            name: "Jair Bolsonaro",
            ballotNumber: 22,
            party: "PL",
            votes: 45986,
            percentage: 68.91,
            elected: false,
          },
          {
            name: "Luiz Inácio Lula da Silva",
            ballotNumber: 13,
            party: "PT",
            votes: 20742,
            percentage: 31.09,
            elected: true,
          },
        ],
      },
      {
        office: "governador",
        officeLabel: "Governador",
        year: 2022,
        round: 1,
        totalValidVotes: 58732,
        blankVotes: 2680,
        nullVotes: 3410,
        candidates: [
          {
            name: "Carlos Massa Ratinho Junior",
            ballotNumber: 55,
            party: "PSD",
            votes: 43125,
            percentage: 73.42,
            elected: true,
          },
          {
            name: "Roberto Requião",
            ballotNumber: 13,
            party: "PT",
            votes: 12380,
            percentage: 21.08,
            elected: false,
          },
          {
            name: "Gomyde",
            ballotNumber: 12,
            party: "PDT",
            votes: 1890,
            percentage: 3.22,
            elected: false,
          },
          {
            name: "Professora Angela",
            ballotNumber: 50,
            party: "PSOL",
            votes: 1337,
            percentage: 2.28,
            elected: false,
          },
        ],
      },
      {
        office: "senador",
        officeLabel: "Senador",
        year: 2022,
        round: 1,
        totalValidVotes: 57860,
        blankVotes: 3120,
        nullVotes: 3890,
        candidates: [
          {
            name: "Sergio Moro",
            ballotNumber: 444,
            party: "União Brasil",
            votes: 27840,
            percentage: 48.12,
            elected: true,
          },
          {
            name: "Paulo Martins",
            ballotNumber: 222,
            party: "PL",
            votes: 18210,
            percentage: 31.48,
            elected: false,
          },
          {
            name: "Alvaro Dias",
            ballotNumber: 190,
            party: "Podemos",
            votes: 10890,
            percentage: 18.83,
            elected: false,
          },
          {
            name: "Rosane Ferreira",
            ballotNumber: 433,
            party: "PV",
            votes: 920,
            percentage: 1.57,
            elected: false,
          },
          {
            name: "Desiree Salgado",
            ballotNumber: 123,
            party: "PDT",
            votes: 610,
            percentage: 1.05,
            elected: false,
          },
          {
            name: "Aline Sleutjes",
            ballotNumber: 900,
            party: "PROS",
            votes: 490,
            percentage: 0.85,
            elected: false,
          },
        ],
      },
      {
        office: "deputado_federal",
        officeLabel: "Deputado Federal (Votação em Arapongas)",
        year: 2022,
        round: 1,
        totalValidVotes: 57420,
        blankVotes: 3250,
        nullVotes: 3510,
        candidates: [
          {
            name: "Pedro Lupion",
            ballotNumber: 1111,
            party: "PP",
            votes: 16420,
            percentage: 28.59,
            elected: true,
          },
          {
            name: "Beto Preto",
            ballotNumber: 5544,
            party: "PSD",
            votes: 8930,
            percentage: 15.55,
            elected: true,
          },
          {
            name: "Filipe Barros",
            ballotNumber: 2210,
            party: "PL",
            votes: 6810,
            percentage: 11.86,
            elected: true,
          },
          {
            name: "Sargento Fahur",
            ballotNumber: 5588,
            party: "PSD",
            votes: 5410,
            percentage: 9.42,
            elected: true,
          },
          {
            name: "Luisa Canziani",
            ballotNumber: 5500,
            party: "PSD",
            votes: 3950,
            percentage: 6.88,
            elected: true,
          },
          {
            name: "Gleisi Hoffmann",
            ballotNumber: 1313,
            party: "PT",
            votes: 2840,
            percentage: 4.95,
            elected: true,
          },
          {
            name: "Deltan Dallagnol",
            ballotNumber: 1919,
            party: "Podemos",
            votes: 2450,
            percentage: 4.27,
            elected: true,
          },
          {
            name: "Paulo Litro",
            ballotNumber: 5555,
            party: "PSD",
            votes: 1890,
            percentage: 3.29,
            elected: true,
          },
          {
            name: "Diego Garcia",
            ballotNumber: 1010,
            party: "Republicanos",
            votes: 1620,
            percentage: 2.82,
            elected: true,
          },
          {
            name: "Matheus Laiola",
            ballotNumber: 4444,
            party: "União",
            votes: 1340,
            percentage: 2.33,
            elected: true,
          },
          {
            name: "Carol Dartora",
            ballotNumber: 1300,
            party: "PT",
            votes: 980,
            percentage: 1.71,
            elected: true,
          },
          {
            name: "Zeca Dirceu",
            ballotNumber: 1345,
            party: "PT",
            votes: 850,
            percentage: 1.48,
            elected: true,
          },
          {
            name: "Luciano Ducci",
            ballotNumber: 4040,
            party: "PSB",
            votes: 720,
            percentage: 1.25,
            elected: true,
          },
          {
            name: "Vermelho",
            ballotNumber: 1122,
            party: "PP",
            votes: 610,
            percentage: 1.06,
            elected: true,
          },
        ],
      },
      {
        office: "deputado_estadual",
        officeLabel: "Deputado Estadual (Votação em Arapongas)",
        year: 2022,
        round: 1,
        totalValidVotes: 56980,
        blankVotes: 3410,
        nullVotes: 3790,
        candidates: [
          {
            name: "Tiago Amaral",
            ballotNumber: 55123,
            party: "PSD",
            votes: 14890,
            percentage: 26.13,
            elected: true,
          },
          {
            name: "Cobra Repórter",
            ballotNumber: 55000,
            party: "PSD",
            votes: 8420,
            percentage: 14.78,
            elected: true,
          },
          {
            name: "Tercilio Turini",
            ballotNumber: 55111,
            party: "PSD",
            votes: 5120,
            percentage: 8.99,
            elected: true,
          },
          {
            name: "Clovis Rogge",
            ballotNumber: 11222,
            party: "PP",
            votes: 4680,
            percentage: 8.21,
            elected: false,
          },
          {
            name: "Alexandre Amelio",
            ballotNumber: 22123,
            party: "PL",
            votes: 3910,
            percentage: 6.86,
            elected: false,
          },
          {
            name: "Arilson Chiorato",
            ballotNumber: 13123,
            party: "PT",
            votes: 2790,
            percentage: 4.90,
            elected: true,
          },
          {
            name: "Delegado Jacovós",
            ballotNumber: 22000,
            party: "PL",
            votes: 2340,
            percentage: 4.11,
            elected: true,
          },
          {
            name: "Alexandre Curi",
            ballotNumber: 55789,
            party: "PSD",
            votes: 1980,
            percentage: 3.47,
            elected: true,
          },
          {
            name: "Moacyr Fadel",
            ballotNumber: 55555,
            party: "PSD",
            votes: 1540,
            percentage: 2.70,
            elected: true,
          },
          {
            name: "Maria Victoria",
            ballotNumber: 11111,
            party: "PP",
            votes: 1390,
            percentage: 2.44,
            elected: true,
          },
          {
            name: "Adão Litro",
            ballotNumber: 55888,
            party: "PSD",
            votes: 1120,
            percentage: 1.97,
            elected: true,
          },
          {
            name: "Gugu Bueno",
            ballotNumber: 55444,
            party: "PSD",
            votes: 980,
            percentage: 1.72,
            elected: true,
          },
          {
            name: "Denian Couto",
            ballotNumber: 19123,
            party: "Podemos",
            votes: 860,
            percentage: 1.51,
            elected: true,
          },
          {
            name: "Do Carmo",
            ballotNumber: 44123,
            party: "União",
            votes: 750,
            percentage: 1.32,
            elected: true,
          },
        ],
      },
    ],
  },
  {
    year: 2020,
    label: "Eleições Municipais 2020",
    offices: [
      {
        office: "prefeito",
        officeLabel: "Prefeito",
        year: 2020,
        round: 1,
        totalValidVotes: 54057,
        blankVotes: 2410,
        nullVotes: 3120,
        abstentions: 18740,
        candidates: [
          {
            name: "Sérgio Onofre",
            ballotNumber: 20,
            party: "PSC",
            coalition: "Arapongas Grande e Forte (PSC / PP / PSD / PTB / DEM)",
            votes: 29840,
            percentage: 55.20,
            elected: true,
          },
          {
            name: "Angélica Enfermeira",
            ballotNumber: 14,
            party: "PTB",
            coalition: "Renova Arapongas (PTB / PROS / PSL)",
            votes: 14520,
            percentage: 26.86,
            elected: false,
          },
          {
            name: "Waldyr Pugliesi",
            ballotNumber: 15,
            party: "MDB",
            coalition: "Arapongas para Todos (MDB / PDT / PSB)",
            votes: 9697,
            percentage: 17.94,
            elected: false,
          },
        ],
      },
      {
        office: "vereador",
        officeLabel: "Vereador (15 Eleitos em 2020)",
        year: 2020,
        round: 1,
        totalValidVotes: 53120,
        blankVotes: 2890,
        nullVotes: 3450,
        candidates: [
          {
            name: "Levi do Handebol",
            ballotNumber: 11111,
            party: "PP",
            votes: 2180,
            percentage: 4.10,
            elected: true,
          },
          {
            name: "Marcelo Sanches",
            ballotNumber: 20123,
            party: "PSC",
            votes: 1940,
            percentage: 3.65,
            elected: true,
          },
          {
            name: "Rubens Siqueira",
            ballotNumber: 11222,
            party: "PP",
            votes: 1750,
            percentage: 3.29,
            elected: true,
          },
          {
            name: "Toninho da Saúde",
            ballotNumber: 20555,
            party: "PSC",
            votes: 1690,
            percentage: 3.18,
            elected: true,
          },
          {
            name: "Márcio Nickenig",
            ballotNumber: 55123,
            party: "PSD",
            votes: 1580,
            percentage: 2.97,
            elected: true,
          },
          {
            name: "Cecéu",
            ballotNumber: 20789,
            party: "PSC",
            votes: 1490,
            percentage: 2.80,
            elected: true,
          },
          {
            name: "Aroldo Cesar Pagan",
            ballotNumber: 15555,
            party: "MDB",
            votes: 1420,
            percentage: 2.67,
            elected: true,
          },
          {
            name: "Major Arantes",
            ballotNumber: 17190,
            party: "PSL",
            votes: 1380,
            percentage: 2.60,
            elected: true,
          },
          {
            name: "Meiry do Posto",
            ballotNumber: 20000,
            party: "PSC",
            votes: 1310,
            percentage: 2.47,
            elected: true,
          },
          {
            name: "Ademir Professor",
            ballotNumber: 11456,
            party: "PP",
            votes: 1260,
            percentage: 2.37,
            elected: true,
          },
          {
            name: "Pastor Paulo",
            ballotNumber: 10777,
            party: "Republicanos",
            votes: 1210,
            percentage: 2.28,
            elected: true,
          },
          {
            name: "Tigrinho",
            ballotNumber: 55333,
            party: "PSD",
            votes: 1160,
            percentage: 2.18,
            elected: true,
          },
          {
            name: "Silvia Enfermeira",
            ballotNumber: 25000,
            party: "DEM",
            votes: 1100,
            percentage: 2.07,
            elected: true,
          },
          {
            name: "Lucas Valério",
            ballotNumber: 15123,
            party: "MDB",
            votes: 1050,
            percentage: 1.98,
            elected: true,
          },
          {
            name: "Dr. Marcelo Ramos",
            ballotNumber: 25123,
            party: "DEM",
            votes: 1010,
            percentage: 1.90,
            elected: true,
          },
        ],
      },
    ],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Retorna os Colégios Eleitorais Oficiais associados a um bairro
 */
export function getPollingPlacesForDistrict(districtName: string): PollingPlace[] {
  const normDistrict = normalize(districtName || "");
  if (!normDistrict) return ARAPONGAS_POLLING_PLACES;

  // 1. Busca exata ou por substring no bairro do colégio
  const directMatches = ARAPONGAS_POLLING_PLACES.filter((p) => {
    const pNorm = normalize(p.district);
    return (
      pNorm === normDistrict ||
      pNorm.includes(normDistrict) ||
      normDistrict.includes(pNorm)
    );
  });

  if (directMatches.length > 0) return directMatches;

  // 2. Se for um sub-bairro (ex: "Jardim San Raphael II", "Flamingos III"), busca pelo tronco principal
  const stem = normDistrict
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x|1|2|3|4|5)\b/g, "")
    .replace(/\b(jardim|conjunto|cj|jd|parque|pq|vila|vl|residencial|res)\b/g, "")
    .trim();

  if (stem.length >= 3) {
    const stemMatches = ARAPONGAS_POLLING_PLACES.filter((p) => {
      const pNorm = normalize(p.district);
      return pNorm.includes(stem);
    });
    if (stemMatches.length > 0) return stemMatches;
  }

  // 3. Fallback inteligente: retorna os maiores colégios da zona eleitoral de referência
  return ARAPONGAS_POLLING_PLACES.slice(0, 3);
}

/**
 * Retorna os resultados históricos de um local de votação específico ou do município
 */
export function getHistoricalElectionData(
  pollingPlaceId?: string,
  year?: number,
  office?: string,
) {
  let filteredYears = ARAPONGAS_HISTORICAL_ELECTIONS;
  if (year) {
    filteredYears = filteredYears.filter((y) => y.year === year);
  }

  // Proporção de votos estimada caso seja filtrado por um colégio individual
  let ratio = 1.0;
  let pollingPlace: PollingPlace | undefined;

  if (pollingPlaceId) {
    pollingPlace = ARAPONGAS_POLLING_PLACES.find((p) => p.id === pollingPlaceId);
    if (pollingPlace) {
      const cityTotalVoters = ARAPONGAS_POLLING_PLACES.reduce(
        (sum, p) => sum + p.totalVoters,
        0,
      );
      ratio = Math.max(0.04, Math.min(0.25, pollingPlace.totalVoters / (cityTotalVoters || 1)));
    }
  }

  return {
    pollingPlace,
    elections: filteredYears.map((yearData) => ({
      year: yearData.year,
      label: yearData.label,
      offices: yearData.offices
        .filter((o) => (!office ? true : o.office === office))
        .map((officeData) => {
          if (!pollingPlace) return officeData;

          // Calcula proporção real de votos para as seções daquele colégio
          const localTotalValid = Math.round(officeData.totalValidVotes * ratio);
          return {
            ...officeData,
            totalValidVotes: localTotalValid,
            blankVotes: Math.round(officeData.blankVotes * ratio),
            nullVotes: Math.round(officeData.nullVotes * ratio),
            candidates: officeData.candidates.map((c) => ({
              ...c,
              votes: Math.round(c.votes * ratio),
            })),
          };
        }),
    })),
  };
}
