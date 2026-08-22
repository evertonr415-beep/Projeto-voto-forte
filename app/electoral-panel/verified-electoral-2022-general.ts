export type VerifiedGeneralCandidate2022 = {
  name: string;
  ballotNumber: number | string;
  party: string;
  votes: number;
  percentage: number;
  elected?: boolean;
  situation?: string;
};

export type VerifiedGeneralOffice2022 = {
  office: string;
  officeLabel: string;
  year: 2022;
  totalValidVotes: number;
  blankVotes: number;
  nullVotes: number;
  abstentions: number;
  totalElectorate: number;
  coverage: "complete" | "top-candidates";
  sourceLabel: string;
  sourceUrl: string;
  candidates: VerifiedGeneralCandidate2022[];
};

const TSE_2022_PR_SOURCE =
  "https://dadosabertos.tse.jus.br/dataset/resultados-2022/resource/ac7bb6a5-68e4-4852-a690-dd2b526c92ee";

/**
 * Snapshot da apuração de 2022 em Arapongas/PR.
 *
 * Fonte primária: Portal de Dados Abertos do TSE, recurso oficial
 * "PR - Votação por seção eleitoral - 2022". O recurso registra a
 * totalização dos cargos de Governador, Senador, Deputado Federal e
 * Deputado Estadual. Nenhuma votação abaixo é estimada.
 *
 * Governador e Senador possuem a lista completa de candidatos.
 * Para Deputado Federal e Deputado Estadual, o painel mantém os 30 mais
 * votados no município, identificados pela cobertura `top-candidates`;
 * os totais de válidos, brancos, nulos e abstenções são os totais da
 * disputa no município, não a soma dos 30 nomes exibidos.
 */
export const VERIFIED_ARAPONGAS_2022_GENERAL_OFFICES: VerifiedGeneralOffice2022[] = [
  {
    office: "governador",
    officeLabel: "Governador",
    year: 2022,
    totalValidVotes: 59145,
    blankVotes: 3325,
    nullVotes: 4596,
    abstentions: 15476,
    totalElectorate: 82597,
    coverage: "complete",
    sourceLabel: "TSE — apuração oficial 2022 em Arapongas/PR, 100% das seções",
    sourceUrl: TSE_2022_PR_SOURCE,
    candidates: [
      { name: "Carlos Massa Ratinho Junior", ballotNumber: 55, party: "PSD", votes: 48622, percentage: 82.13, elected: true, situation: "Eleito" },
      { name: "Requião", ballotNumber: 13, party: "PT", votes: 8644, percentage: 14.6, elected: false, situation: "Não eleito" },
      { name: "Gomyde", ballotNumber: 12, party: "PDT", votes: 1002, percentage: 1.69, elected: false, situation: "Não eleito" },
      { name: "Joni Correia", ballotNumber: 27, party: "DC", votes: 494, percentage: 0.83, elected: false, situation: "Não eleito" },
      { name: "Professora Angela", ballotNumber: 50, party: "PSOL", votes: 230, percentage: 0.39, elected: false, situation: "Não eleito" },
      { name: "Vivi Motta", ballotNumber: 21, party: "PCB", votes: 91, percentage: 0.15, elected: false, situation: "Não eleito" },
      { name: "Solange Ferreira Bueno", ballotNumber: 33, party: "PMN", votes: 55, percentage: 0.09, elected: false, situation: "Não eleito" },
      { name: "Professor Ivan", ballotNumber: 16, party: "PSTU", votes: 38, percentage: 0.06, elected: false, situation: "Não eleito" },
      { name: "Adriano Teixeira", ballotNumber: 29, party: "PCO", votes: 24, percentage: 0.04, elected: false, situation: "Não eleito" },
    ],
  },
  {
    office: "senador",
    officeLabel: "Senador",
    year: 2022,
    totalValidVotes: 56506,
    blankVotes: 5031,
    nullVotes: 5584,
    abstentions: 15476,
    totalElectorate: 82597,
    coverage: "complete",
    sourceLabel: "TSE — apuração oficial 2022 em Arapongas/PR, 100% das seções",
    sourceUrl: TSE_2022_PR_SOURCE,
    candidates: [
      { name: "Paulo Martins", ballotNumber: 222, party: "PL", votes: 21864, percentage: 38.69, elected: false, situation: "Não eleito" },
      { name: "Sergio Moro", ballotNumber: 444, party: "UNIÃO", votes: 17958, percentage: 31.78, elected: true, situation: "Eleito" },
      { name: "Alvaro Dias", ballotNumber: 190, party: "PODE", votes: 13212, percentage: 23.38, elected: false, situation: "Não eleito" },
      { name: "Rosane Ferreira", ballotNumber: 433, party: "PV", votes: 2099, percentage: 3.71, elected: false, situation: "Não eleito" },
      { name: "Desiree", ballotNumber: 123, party: "PDT", votes: 666, percentage: 1.18, elected: false, situation: "Não eleito" },
      { name: "Orlando Pessuti", ballotNumber: 155, party: "MDB", votes: 371, percentage: 0.66, elected: false, situation: "Não eleito" },
      { name: "Aline Sleutjes", ballotNumber: 900, party: "PROS", votes: 199, percentage: 0.35, elected: false, situation: "Não eleito" },
      { name: "Laerson Matias", ballotNumber: 500, party: "PSOL", votes: 103, percentage: 0.18, elected: false, situation: "Não eleito" },
      { name: "Roberto França da Silva Junior", ballotNumber: 290, party: "PCO", votes: 22, percentage: 0.04, elected: false, situation: "Não eleito" },
      { name: "Dr Saboia", ballotNumber: 337, party: "PMN", votes: 12, percentage: 0.02, elected: false, situation: "Não eleito" },
    ],
  },
  {
    office: "deputado_federal",
    officeLabel: "Deputado Federal — 30 mais votados",
    year: 2022,
    totalValidVotes: 58524,
    blankVotes: 5121,
    nullVotes: 3322,
    abstentions: 15476,
    totalElectorate: 82597,
    coverage: "top-candidates",
    sourceLabel: "TSE — apuração oficial 2022 em Arapongas/PR; 30 mais votados, 100% das seções",
    sourceUrl: TSE_2022_PR_SOURCE,
    candidates: [
      { name: "Pedro Lupion", ballotNumber: "—", party: "PP", votes: 14066, percentage: 23.98, elected: true, situation: "Eleito por QP" },
      { name: "Filipe Barros", ballotNumber: "—", party: "PL", votes: 5901, percentage: 10.06, elected: true, situation: "Eleito por QP" },
      { name: "Beto Preto", ballotNumber: "—", party: "PSD", votes: 4060, percentage: 6.92, elected: true, situation: "Eleito por QP" },
      { name: "Angelica Enfermeira", ballotNumber: "—", party: "PROS", votes: 3731, percentage: 6.36, elected: false, situation: "Suplente" },
      { name: "Deltan Dallagnol", ballotNumber: "—", party: "PODE", votes: 2228, percentage: 3.8, elected: true, situation: "Eleito por QP" },
      { name: "Sargento Fahur", ballotNumber: "—", party: "PSD", votes: 2225, percentage: 3.79, elected: true, situation: "Eleito por QP" },
      { name: "Luciano Ducci", ballotNumber: "—", party: "PSB", votes: 2130, percentage: 3.63, elected: true, situation: "Eleito por média" },
      { name: "Luísa Canziani", ballotNumber: "—", party: "PSD", votes: 1777, percentage: 3.03, elected: true, situation: "Eleito por média" },
      { name: "Oduwaldo Calixto", ballotNumber: "—", party: "PL", votes: 1757, percentage: 2.99, elected: false, situation: "Suplente" },
      { name: "Gleisi", ballotNumber: "—", party: "PT", votes: 1724, percentage: 2.94, elected: true, situation: "Eleito por QP" },
      { name: "Carol Dartora", ballotNumber: "—", party: "PT", votes: 1039, percentage: 1.77, elected: true, situation: "Eleito por QP" },
      { name: "Diego Garcia", ballotNumber: "—", party: "REPUBLICANOS", votes: 989, percentage: 1.69, elected: true, situation: "Eleito por QP" },
      { name: "Marco Brasil", ballotNumber: "—", party: "PP", votes: 964, percentage: 1.64, elected: false, situation: "Suplente" },
      { name: "Felipe Francischini", ballotNumber: "—", party: "UNIÃO", votes: 913, percentage: 1.56, elected: true, situation: "Eleito por QP" },
      { name: "Alex Santana", ballotNumber: "—", party: "MDB", votes: 756, percentage: 1.29, elected: false, situation: "Suplente" },
      { name: "Delegado Matheus Laiola", ballotNumber: "—", party: "UNIÃO", votes: 657, percentage: 1.12, elected: true, situation: "Eleito por QP" },
      { name: "Aroldo Martins", ballotNumber: "—", party: "REPUBLICANOS", votes: 637, percentage: 1.09, elected: false, situation: "Suplente" },
      { name: "Ricardo Barros", ballotNumber: "—", party: "PP", votes: 625, percentage: 1.07, elected: true, situation: "Eleito por QP" },
      { name: "Newton Bonin", ballotNumber: "—", party: "UNIÃO", votes: 569, percentage: 0.97, elected: false, situation: "Suplente" },
      { name: "Jessicão", ballotNumber: "—", party: "PP", votes: 479, percentage: 0.82, elected: false, situation: "Suplente" },
      { name: "Paulo Litro", ballotNumber: "—", party: "PSD", votes: 457, percentage: 0.78, elected: true, situation: "Eleito por QP" },
      { name: "Marisa Lobo Psicóloga Cristã", ballotNumber: "—", party: "—", votes: 453, percentage: 0.77, elected: false, situation: "Não eleito" },
      { name: "Beto Richa", ballotNumber: "—", party: "PSDB", votes: 430, percentage: 0.73, elected: true, situation: "Eleito por média" },
      { name: "Giacobo", ballotNumber: "—", party: "PL", votes: 396, percentage: 0.67, elected: true, situation: "Eleito por QP" },
      { name: "Mara Boca Aberta", ballotNumber: "—", party: "PROS", votes: 317, percentage: 0.54, elected: false, situation: "Suplente" },
      { name: "Aliel Machado", ballotNumber: "—", party: "PV", votes: 316, percentage: 0.54, elected: true, situation: "Eleito por média" },
      { name: "Christiane Yared", ballotNumber: "—", party: "PP", votes: 311, percentage: 0.53, elected: false, situation: "Suplente" },
      { name: "Giovani Mattos", ballotNumber: "—", party: "—", votes: 296, percentage: 0.5, elected: false, situation: "Não eleito" },
      { name: "Enio Verri", ballotNumber: "—", party: "PT", votes: 246, percentage: 0.42, elected: true, situation: "Eleito por QP" },
      { name: "Hauly", ballotNumber: "—", party: "—", votes: 237, percentage: 0.4, elected: false, situation: "Suplente" },
    ],
  },
  {
    office: "deputado_estadual",
    officeLabel: "Deputado Estadual — 30 mais votados",
    year: 2022,
    totalValidVotes: 58035,
    blankVotes: 5634,
    nullVotes: 3403,
    abstentions: 15476,
    totalElectorate: 82597,
    coverage: "top-candidates",
    sourceLabel: "TSE — apuração oficial 2022 em Arapongas/PR; 30 mais votados, 100% das seções",
    sourceUrl: TSE_2022_PR_SOURCE,
    candidates: [
      { name: "Tiago Amaral", ballotNumber: "—", party: "PSD", votes: 15471, percentage: 26.65, situation: "Votação em Arapongas" },
      { name: "Pedro Paulo Bazana", ballotNumber: "—", party: "PSD", votes: 9843, percentage: 16.96, situation: "Votação em Arapongas" },
      { name: "Aroldo Pagan", ballotNumber: "—", party: "PODE", votes: 5486, percentage: 9.45, situation: "Votação em Arapongas" },
      { name: "Marcio Nunes", ballotNumber: "—", party: "PSD", votes: 2974, percentage: 5.12, situation: "Votação em Arapongas" },
      { name: "Cobra Repórter", ballotNumber: "—", party: "PSD", votes: 2190, percentage: 3.77, situation: "Votação em Arapongas" },
      { name: "Delegado Jacovos", ballotNumber: "—", party: "—", votes: 1403, percentage: 2.42, situation: "Votação em Arapongas" },
      { name: "Alex Canziani", ballotNumber: "—", party: "—", votes: 968, percentage: 1.67, situation: "Votação em Arapongas" },
      { name: "Arilson Chiorato", ballotNumber: "—", party: "PT", votes: 818, percentage: 1.41, situation: "Votação em Arapongas" },
      { name: "Cantora Mara Lima", ballotNumber: "—", party: "—", votes: 785, percentage: 1.35, situation: "Votação em Arapongas" },
      { name: "Professor Lemos", ballotNumber: "—", party: "PT", votes: 669, percentage: 1.15, situation: "Votação em Arapongas" },
      { name: "Alisson Wandscheer", ballotNumber: "—", party: "—", votes: 668, percentage: 1.15, situation: "Votação em Arapongas" },
      { name: "Tercilio Turini", ballotNumber: "—", party: "PSD", votes: 617, percentage: 1.06, situation: "Votação em Arapongas" },
      { name: "Alexandre Amaro", ballotNumber: "—", party: "—", votes: 612, percentage: 1.05, situation: "Votação em Arapongas" },
      { name: "Ricardo Arruda", ballotNumber: "—", party: "—", votes: 611, percentage: 1.05, situation: "Votação em Arapongas" },
      { name: "Requião Filho", ballotNumber: "—", party: "PT", votes: 518, percentage: 0.89, situation: "Votação em Arapongas" },
      { name: "Jairo Tamura", ballotNumber: "—", party: "—", votes: 435, percentage: 0.75, situation: "Votação em Arapongas" },
      { name: "César Mello", ballotNumber: "—", party: "—", votes: 413, percentage: 0.71, situation: "Votação em Arapongas" },
      { name: "Alexandre Curi", ballotNumber: "—", party: "PSD", votes: 390, percentage: 0.67, situation: "Votação em Arapongas" },
      { name: "Sargento França", ballotNumber: "—", party: "—", votes: 380, percentage: 0.65, situation: "Votação em Arapongas" },
      { name: "Evandro Araujo", ballotNumber: "—", party: "PSD", votes: 323, percentage: 0.56, situation: "Votação em Arapongas" },
      { name: "Michele Thomazinho", ballotNumber: "—", party: "—", votes: 305, percentage: 0.53, situation: "Votação em Arapongas" },
      { name: "Rodolfo Mota", ballotNumber: "—", party: "—", votes: 300, percentage: 0.52, situation: "Votação em Arapongas" },
      { name: "Boca Aberta Jr", ballotNumber: "—", party: "—", votes: 281, percentage: 0.48, situation: "Votação em Arapongas" },
      { name: "Cloara Pinheiro", ballotNumber: "—", party: "PSD", votes: 275, percentage: 0.47, situation: "Votação em Arapongas" },
      { name: "Michele Caputo", ballotNumber: "—", party: "—", votes: 269, percentage: 0.46, situation: "Votação em Arapongas" },
      { name: "Renato Freitas", ballotNumber: "—", party: "PT", votes: 247, percentage: 0.43, situation: "Votação em Arapongas" },
      { name: "João Bettega", ballotNumber: "—", party: "—", votes: 245, percentage: 0.42, situation: "Votação em Arapongas" },
      { name: "Professora Josete", ballotNumber: "—", party: "PT", votes: 226, percentage: 0.39, situation: "Votação em Arapongas" },
      { name: "Flavia Francischini", ballotNumber: "—", party: "—", votes: 221, percentage: 0.38, situation: "Votação em Arapongas" },
      { name: "Gilberto Ribeiro", ballotNumber: "—", party: "—", votes: 221, percentage: 0.38, situation: "Votação em Arapongas" },
    ],
  },
];
