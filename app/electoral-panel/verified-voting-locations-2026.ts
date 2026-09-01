export type VotingLocationChange2026 = {
  movedFrom: string;
  changedSections: number[];
  movedElectors: number;
  reason: string;
};

export type VerifiedVotingLocation2026 = {
  id: string;
  name: string;
  address: string;
  district: string;
  zone: number;
  sections: number[];
  change2026?: VotingLocationChange2026;
};

export const ARAPONGAS_ELECTORATE_2026 = 84546;
export const ARAPONGAS_ZONE = 61;
export const ARAPONGAS_CHANGED_SECTIONS_2026 = 15;
export const ARAPONGAS_CHANGED_ELECTORS_2026 = 4940;

export const ARAPONGAS_VOTING_LOCATION_SOURCES = {
  tse2026: {
    label: "TSE — Eleitorado por local de votação 2026",
    url: "https://dadosabertos.tse.jus.br/dataset/eleitorado-2026",
  },
  trePrChanges2026: {
    label: "TRE-PR — alterações de locais para as Eleições 2026",
    url: "https://www.tre-pr.jus.br/comunicacao/noticias/arquivos/2026-02-27-locais/@@display-file/file/locais.pdf",
  },
  baseline2024: {
    label: "Relação de locais e seções de Arapongas — Eleições 2024",
    url: "https://tnonline.uol.com.br/eleicoes/2024/veja-os-locais-de-votacao-em-apucarana-arapongas-e-ivaipora-921993",
  },
} as const;

export const VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026: VerifiedVotingLocation2026[] = [
  {
    id: "antonica-girol-do-franciosi",
    name: "Escola Antonica Giroldo Franciosi",
    address: "Rua Pavão, 26",
    district: "Centro",
    zone: 61,
    sections: [1, 4, 7, 61, 64, 74, 83, 148, 365],
  },
  {
    id: "jose-bernardo-dos-santos",
    name: "Escola José Bernardo dos Santos",
    address: "Rua Tiriba, s/n",
    district: "Vila Bernardes",
    zone: 61,
    sections: [9, 10, 161, 169, 175, 183, 188, 191],
  },
  {
    id: "francisco-pereira-bastos",
    name: "Colégio Francisco Pereira Bastos",
    address: "Rua Teu-Teu, 275",
    district: "Jardim Aeroporto",
    zone: 61,
    sections: [11, 12, 66, 162, 167, 360, 368],
  },
  {
    id: "alzira-horvatich",
    name: "Escola Prof. Alzira Horvatich",
    address: "Rua Garça Branca, 325",
    district: "Del Condor",
    zone: 61,
    sections: [14, 15, 16, 17, 163, 164, 166, 170, 172, 176, 180, 182, 355],
  },
  {
    id: "antonio-garcez-novaes",
    name: "Colégio Antônio Garcez Novaes",
    address: "Rua Perdizes, 910",
    district: "Centro",
    zone: 61,
    sections: [18, 52, 53, 54, 55, 56, 57, 58, 59, 147, 192],
  },
  {
    id: "heloiza-giancristofaro",
    name: "Escola Heloiza Giancristofaro",
    address: "Rua Jacupemba, 715",
    district: "Jardim Bandeirantes",
    zone: 61,
    sections: [69, 72, 165, 171, 181, 362],
  },
  {
    id: "nadir-mendes-montanha",
    name: "Colégio Prof. Nadir Mendes Montanha",
    address: "Rua Macuru, 470",
    district: "Flamingos I",
    zone: 61,
    sections: [76, 150, 174, 178, 179, 184, 187, 190, 193, 198],
  },
  {
    id: "centro-pastoral-santo-antonio",
    name: "Centro Pastoral Igreja Santo Antônio",
    address: "Rua Batuquira, 100",
    district: "Vila Bernardes",
    zone: 61,
    sections: [77, 78, 79, 134, 152],
  },
  {
    id: "getulio-vargas",
    name: "Escola Presidente Getúlio Vargas",
    address: "Rua Faisão, 585",
    district: "Vila Sampaio",
    zone: 61,
    sections: [80, 81, 82, 85, 86, 151, 153, 155, 185, 189],
  },
  {
    id: "clube-comercial",
    name: "Clube Comercial",
    address: "Rua Condor, 1100",
    district: "Centro",
    zone: 61,
    sections: [109, 110, 126, 127, 128, 129, 130, 131, 132, 133],
  },
  {
    id: "antonio-racanello-sampaio",
    name: "Colégio Antônio Racanello Sampaio",
    address: "Rua Guacuru, 190",
    district: "Vila Araponguinha",
    zone: 61,
    sections: [112, 113, 114, 156, 158, 159, 168, 173, 357],
  },
  {
    id: "walfredo-silveira-correa",
    name: "Escola Walfredo Silveira Corrêa",
    address: "Rua Japim, 483",
    district: "Jardim Bandeirantes",
    zone: 61,
    sections: [135, 136, 137, 138, 139, 160, 186],
  },
  {
    id: "enzo-batista-daleffe-pereira",
    name: "Escola Enzo Batista Daleffe Pereira",
    address: "Rua Negaça, 20",
    district: "Jardim Aeroporto",
    zone: 61,
    sections: [196, 199, 201, 204, 206, 225, 226, 227, 228, 229, 230, 231, 232, 349],
  },
  {
    id: "aleydah-oliveira",
    name: "Escola Prof. Aleydah Oliveira",
    address: "Rua Biguá-Una, 215",
    district: "Monte Carlo II",
    zone: 61,
    sections: [197, 200, 202, 203, 205, 207, 316, 369],
  },
  {
    id: "jose-de-carvalho",
    name: "Escola Prof. José de Carvalho",
    address: "Rua Xexeu, 72",
    district: "Conjunto Tropical",
    zone: 61,
    sections: [233, 234, 235, 236, 237],
  },
  {
    id: "santissima-trindade",
    name: "Salão de Eventos da Igreja Santíssima Trindade",
    address: "Rua Tuim, 33",
    district: "Vila Triângulo",
    zone: 61,
    sections: [238, 239, 240, 241, 242, 243, 244, 352],
    change2026: {
      movedFrom: "Escola Municipal Professora Nereide de Souza Camargo",
      changedSections: [238, 239, 240, 241, 242, 243, 244, 352],
      movedElectors: 2722,
      reason: "Alteração oficial do TRE-PR para 2026 por obras, reformas ou acessibilidade.",
    },
  },
  {
    id: "clotario-portugal",
    name: "Escola Des. Clotário Portugal",
    address: "Rua Tuim, 217",
    district: "Vila Triângulo",
    zone: 61,
    sections: [245, 246, 247, 248, 249],
  },
  {
    id: "ivanilde-noronha",
    name: "Colégio Ivanilde Noronha",
    address: "Rua Rouxinol, 2008",
    district: "Vila Aparecida",
    zone: 61,
    sections: [250, 251, 252, 253, 254, 255, 256, 257],
  },
  {
    id: "diomar-pegorer",
    name: "Escola Prof. Diomar de O. Pegorer",
    address: "Rua Canindé, 84",
    district: "Vila Aparecida",
    zone: 61,
    sections: [258, 259, 260, 261, 356],
  },
  {
    id: "maria-hercilio-stawinski",
    name: "Escola Maria Hercílio Stawinski",
    address: "Rua Formigueiro Estrelado, 141",
    district: "Conjunto Padre Bernardo",
    zone: 61,
    sections: [269, 270, 271, 272, 273, 351],
  },
  {
    id: "emilio-de-menezes",
    name: "Colégio Emílio de Menezes",
    address: "Rua Quíscalo, 185",
    district: "Vila Aratimbo",
    zone: 61,
    sections: [274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287],
  },
  {
    id: "papa-joao-paulo-ii",
    name: "Escola Papa João Paulo II",
    address: "Rua Pato-Mergulhador, s/n",
    district: "Jardim Petrópolis",
    zone: 61,
    sections: [288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298],
  },
  {
    id: "unidade-polo",
    name: "Colégio Unidade Polo",
    address: "Rua Pavão, 831",
    district: "Centro",
    zone: 61,
    sections: [299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311],
  },
  {
    id: "mae-do-divino-amor",
    name: "Colégio Mãe do Divino Amor",
    address: "Rua Eurilemos, 1190",
    district: "Centro",
    zone: 61,
    sections: [312, 313, 314, 315, 316, 317, 318, 319, 320, 321],
  },
  {
    id: "marques-de-caravelas",
    name: "Colégio Marquês de Caravelas",
    address: "Rua Uirapuru, 295",
    district: "Centro",
    zone: 61,
    sections: [322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 367],
  },
  {
    id: "aricanduva",
    name: "Escola de Aricanduva",
    address: "Rua Caiapó, s/n",
    district: "Distrito de Aricanduva",
    zone: 61,
    sections: [332, 333, 334, 335, 336],
  },
  {
    id: "padre-germano-mayer",
    name: "Escola Padre Germano Mayer",
    address: "Rua Ave-Lira, 140",
    district: "Vila Nova",
    zone: 61,
    sections: [337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348],
  },
  {
    id: "irondi-mantovani-pugliese",
    name: "Colégio Estadual Irondi Mantovani Pugliese",
    address: "Rua Uru do Campo, 50",
    district: "Casa Família Arapongas I / Zona Sul",
    zone: 61,
    sections: [262, 263, 264, 265, 266, 267, 268, 364],
    change2026: {
      movedFrom: "Escola Municipal Doutor Antônio Grassano Junior",
      changedSections: [262, 263, 264, 265, 266, 267, 268],
      movedElectors: 2218,
      reason: "Alteração oficial do TRE-PR para 2026 por obras, reformas ou acessibilidade.",
    },
  },
];
