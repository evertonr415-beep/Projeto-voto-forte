import { VERIFIED_ARAPONGAS_2022_GENERAL_OFFICES } from "./verified-electoral-2022-general";

export type VerifiedCandidate = {
  name: string;
  ballotNumber: number | string;
  party: string;
  votes: number;
  percentage: number;
  elected?: boolean;
  situation?: string;
};

export type VerifiedOfficeData = {
  office: string;
  officeLabel: string;
  year: number;
  totalValidVotes: number;
  blankVotes?: number;
  nullVotes?: number;
  blankNullVotes?: number;
  abstentions: number;
  totalElectorate: number;
  coverage: "complete" | "elected-only" | "top-candidates";
  sourceLabel: string;
  sourceUrl?: string;
  candidates: VerifiedCandidate[];
};

export type VerifiedElectionYear = {
  year: number;
  label: string;
  type: "municipal" | "geral";
  offices: VerifiedOfficeData[];
};

/**
 * Snapshot eleitoral conservador para o Painel Eleitoral de Arapongas.
 *
 * Regra de integridade:
 * - so entram disputas/numeros conferidos em publicacoes de apuracao que
 *   identificam o TSE como fonte;
 * - nenhuma votacao por local/colegio e estimada ou projetada;
 * - quando a fonte consultada publica apenas os eleitos do Legislativo,
 *   a cobertura e marcada explicitamente como "elected-only";
 * - rankings parciais sao marcados como "top-candidates" e nunca exibidos
 *   como se fossem a lista completa da disputa.
 */
export const VERIFIED_ARAPONGAS_ELECTIONS: VerifiedElectionYear[] = [
  {
    year: 2024,
    label: "Eleições Municipais 2024",
    type: "municipal",
    offices: [
      {
        office: "prefeito",
        officeLabel: "Prefeito",
        year: 2024,
        totalValidVotes: 58089,
        blankVotes: 2648,
        nullVotes: 3385,
        abstentions: 20952,
        totalElectorate: 85074,
        coverage: "complete",
        sourceLabel: "TSE — 100% das urnas apuradas",
        candidates: [
          {
            name: "Rafael Cita",
            ballotNumber: 55,
            party: "PSD",
            votes: 30557,
            percentage: 52.6,
            elected: true,
            situation: "Eleito",
          },
          {
            name: "Jair Milani",
            ballotNumber: 22,
            party: "PL",
            votes: 27532,
            percentage: 47.4,
            elected: false,
            situation: "Não eleito",
          },
        ],
      },
      {
        office: "vereador",
        officeLabel: "Vereadores eleitos",
        year: 2024,
        totalValidVotes: 58252,
        blankVotes: 3336,
        nullVotes: 2534,
        abstentions: 20952,
        totalElectorate: 85074,
        coverage: "elected-only",
        sourceLabel: "TSE — lista dos 15 eleitos, 100% das urnas apuradas",
        candidates: [
          { name: "Décio Rosanelli", ballotNumber: 20220, party: "PODE", votes: 2135, percentage: 3.67, elected: true, situation: "Eleito" },
          { name: "Levi do Handebol", ballotNumber: 55155, party: "PSD", votes: 1720, percentage: 2.95, elected: true, situation: "Eleito" },
          { name: "Paulo Grassano", ballotNumber: 11234, party: "PP", votes: 1576, percentage: 2.71, elected: true, situation: "Eleito" },
          { name: "Toninho da Ambulancia", ballotNumber: 44044, party: "UNIÃO", votes: 1212, percentage: 2.08, elected: true, situation: "Eleito" },
          { name: "João Graça", ballotNumber: 70000, party: "AVANTE", votes: 1210, percentage: 2.08, elected: true, situation: "Eleito" },
          { name: "Marcio Nicke", ballotNumber: 40133, party: "PSB", votes: 1102, percentage: 1.89, elected: true, situation: "Eleito" },
          { name: "Aroldo Pagan", ballotNumber: 20120, party: "PODE", votes: 1024, percentage: 1.76, elected: true, situation: "Eleito" },
          { name: "Professor Marcelo", ballotNumber: 11555, party: "PP", votes: 1010, percentage: 1.73, elected: true, situation: "Eleito" },
          { name: "Alexandre Juliani Sorriso", ballotNumber: 44567, party: "UNIÃO", votes: 943, percentage: 1.62, elected: true, situation: "Eleito" },
          { name: "Simone Sponton Mãe de Autista", ballotNumber: 55555, party: "PSD", votes: 913, percentage: 1.57, elected: true, situation: "Eleito" },
          { name: "Luisinho da Saude", ballotNumber: 55147, party: "PSD", votes: 877, percentage: 1.51, elected: true, situation: "Eleito" },
          { name: "Diretora Marilsa Staub", ballotNumber: 22777, party: "PL", votes: 858, percentage: 1.47, elected: true, situation: "Eleito" },
          { name: "Pardini", ballotNumber: 44190, party: "UNIÃO", votes: 853, percentage: 1.46, elected: true, situation: "Eleito" },
          { name: "Cecéu", ballotNumber: 55120, party: "PSD", votes: 849, percentage: 1.46, elected: true, situation: "Eleito" },
          { name: "Meiry Farias Proteção Animal", ballotNumber: 12500, party: "PDT", votes: 832, percentage: 1.43, elected: true, situation: "Eleito" },
        ],
      },
    ],
  },
  {
    year: 2022,
    label: "Eleições Gerais 2022",
    type: "geral",
    offices: [
      {
        office: "presidente_2t",
        officeLabel: "Presidente — 2º turno",
        year: 2022,
        totalValidVotes: 66257,
        blankNullVotes: 2402,
        abstentions: 13949,
        totalElectorate: 82608,
        coverage: "complete",
        sourceLabel: "TSE — 100% das urnas apuradas",
        candidates: [
          { name: "Jair Bolsonaro", ballotNumber: 22, party: "PL", votes: 50404, percentage: 76.07, elected: false, situation: "Mais votado em Arapongas" },
          { name: "Luiz Inácio Lula da Silva", ballotNumber: 13, party: "PT", votes: 15853, percentage: 23.93, elected: true, situation: "Eleito nacionalmente" },
        ],
      },
      {
        office: "presidente_1t",
        officeLabel: "Presidente — 1º turno",
        year: 2022,
        totalValidVotes: 64011,
        blankVotes: 1200,
        nullVotes: 1910,
        abstentions: 15476,
        totalElectorate: 82597,
        coverage: "complete",
        sourceLabel: "TSE — 100% das seções apuradas",
        candidates: [
          { name: "Jair Bolsonaro", ballotNumber: 22, party: "PL", votes: 45033, percentage: 70.35, situation: "2º turno" },
          { name: "Luiz Inácio Lula da Silva", ballotNumber: 13, party: "PT", votes: 14401, percentage: 22.5, situation: "2º turno" },
          { name: "Simone Tebet", ballotNumber: 15, party: "MDB", votes: 2431, percentage: 3.8, situation: "Não eleito" },
          { name: "Ciro Gomes", ballotNumber: 12, party: "PDT", votes: 1474, percentage: 2.3, situation: "Não eleito" },
          { name: "Soraya Thronicke", ballotNumber: 44, party: "UNIÃO", votes: 303, percentage: 0.47, situation: "Não eleito" },
          { name: "Felipe D'Avila", ballotNumber: 30, party: "NOVO", votes: 264, percentage: 0.41, situation: "Não eleito" },
          { name: "Padre Kelmon", ballotNumber: 14, party: "PTB", votes: 49, percentage: 0.08, situation: "Não eleito" },
          { name: "Léo Péricles", ballotNumber: 80, party: "UP", votes: 21, percentage: 0.03, situation: "Não eleito" },
          { name: "Sofia Manzano", ballotNumber: 21, party: "PCB", votes: 18, percentage: 0.03, situation: "Não eleito" },
          { name: "Constituinte Eymael", ballotNumber: 27, party: "DC", votes: 11, percentage: 0.02, situation: "Não eleito" },
          { name: "Vera", ballotNumber: 16, party: "PSTU", votes: 6, percentage: 0.01, situation: "Não eleito" },
        ],
      },
      ...VERIFIED_ARAPONGAS_2022_GENERAL_OFFICES,
    ],
  },
  {
    year: 2020,
    label: "Eleições Municipais 2020",
    type: "municipal",
    offices: [
      {
        office: "prefeito",
        officeLabel: "Prefeito",
        year: 2020,
        totalValidVotes: 55015,
        blankVotes: 2144,
        nullVotes: 3665,
        abstentions: 18858,
        totalElectorate: 79682,
        coverage: "complete",
        sourceLabel: "TSE — 100% das urnas apuradas",
        candidates: [
          { name: "Sergio Onofre da Silva", ballotNumber: 20, party: "PSC", votes: 35533, percentage: 64.59, elected: true, situation: "Eleito" },
          { name: "Waldyr Ortêncio Pugliesi", ballotNumber: 15, party: "MDB", votes: 5068, percentage: 9.21, situation: "Não eleito" },
          { name: "Ricardo Augusto Grassano", ballotNumber: 19, party: "PODE", votes: 4327, percentage: 7.87, situation: "Não eleito" },
          { name: "Valdecir Oliveira", ballotNumber: 28, party: "PRTB", votes: 3772, percentage: 6.86, situation: "Não eleito" },
          { name: "Pedro Paulo Bazana", ballotNumber: 43, party: "PV", votes: 3221, percentage: 5.85, situation: "Não eleito" },
          { name: "Angelica Ferreira", ballotNumber: 90, party: "PROS", votes: 2612, percentage: 4.75, situation: "Não eleito" },
          { name: "Fernando Roman Bolico", ballotNumber: 36, party: "PTC", votes: 482, percentage: 0.88, situation: "Não eleito" },
        ],
      },
    ],
  },
];
