export interface CandidatoPrefeito {
  nome: string;
  partido: string;
  numero: number;
  votos: number;
  porcentagem: string;
  status: "Eleito" | "Não Eleito";
}

export interface CandidatoVereador {
  nome: string;
  partido: string;
  numero: number;
  votos: number;
  status: "Eleito por QP" | "Eleito por média" | "Suplente";
}

export interface Deputado {
  posicao: number;
  nome: string;
  partido: string;
  votos: number;
  porcentagem: string;
}

export interface DadosEleicaoArapongas {
  municipio: string;
  uf: string;
  prefeito: CandidatoPrefeito[];
  vereadoresEleitos: CandidatoVereador[];
  vereadoresSuplentes: CandidatoVereador[];
  deputadosFederais: {
    ranking: Deputado[];
    brancos: string;
    nulos: string;
  };
  deputadosEstaduais: {
    ranking: Deputado[];
  };
}

export const DADOS_ELEICAO_ARAPONGAS: DadosEleicaoArapongas = {
  municipio: "Arapongas",
  uf: "PR",
  prefeito: [
    {
      nome: "RAFAEL CITA",
      partido: "PSD",
      numero: 55,
      votos: 30557,
      porcentagem: "52,60%",
      status: "Eleito"
    },
    {
      nome: "JAIR MILANI",
      partido: "PL",
      numero: 22,
      votos: 27532,
      porcentagem: "47,40%",
      status: "Não Eleito"
    }
  ],
  vereadoresEleitos: [
    {
      nome: "DÉCIO ROSANELLI",
      partido: "PODE",
      numero: 20220,
      votos: 2135,
      status: "Eleito por QP"
    },
    {
      nome: "LEVI DO HANDEBOL",
      partido: "PSD",
      numero: 55155,
      votos: 1720,
      status: "Eleito por QP"
    },
    {
      nome: "PAULO GRASSANO",
      partido: "PP",
      numero: 11234,
      votos: 1576,
      status: "Eleito por QP"
    },
    {
      nome: "TONINHO DA AMBULANCIA",
      partido: "UNIÃO",
      numero: 44044,
      votos: 1212,
      status: "Eleito por QP"
    },
    {
      nome: "MARCIO NICKE",
      partido: "PSB",
      numero: 40133,
      votos: 1102,
      status: "Eleito por QP"
    },
    {
      nome: "AROLDO PAGAN",
      partido: "PODE",
      numero: 20120,
      votos: 1024,
      status: "Eleito por média"
    },
    {
      nome: "PROFESSOR MARCELO",
      partido: "PP",
      numero: 11555,
      votos: 1010,
      status: "Eleito por média"
    },
    {
      nome: "ALEXANDRE JULIANI SORRISO",
      partido: "UNIÃO",
      numero: 44567,
      votos: 943,
      status: "Eleito por média"
    },
    {
      nome: "SIMONE SPONTON MÃE DE AUTISTA",
      partido: "PSD",
      numero: 55555,
      votos: 913,
      status: "Eleito por média"
    },
    {
      nome: "LUISINHO DA SAUDE",
      partido: "PSD",
      numero: 55147,
      votos: 877,
      status: "Eleito por média"
    },
    {
      nome: "DIRETORA MARILSA STAUB",
      partido: "PL",
      numero: 22777,
      votos: 858,
      status: "Eleito por QP"
    },
    {
      nome: "PARDINI",
      partido: "UNIÃO",
      numero: 44190,
      votos: 853,
      status: "Eleito por média"
    },
    {
      nome: "CECÉU",
      partido: "PSD",
      numero: 55120,
      votos: 849,
      status: "Eleito por média"
    },
    {
      nome: "MEIRY FARIAS PROTEÇÃO ANIMAL",
      partido: "PDT",
      numero: 12500,
      votos: 832,
      status: "Eleito por QP"
    },
    {
      nome: "ARNALDO DO POVO",
      partido: "AVANTE",
      numero: 70123,
      votos: 451,
      status: "Eleito por média"
    }
  ],
  deputadosFederais: {
    ranking: [
      {
        posicao: 1,
        nome: "Pedro Lupion",
        partido: "PROGRESSISTAS",
        votos: 14066,
        porcentagem: "23,98%"
      },
      {
        posicao: 2,
        nome: "Filipe Barros",
        partido: "PL",
        votos: 5901,
        porcentagem: "10,06%"
      },
      {
        posicao: 3,
        nome: "Beto Preto",
        partido: "PSD",
        votos: 4060,
        porcentagem: "6,92%"
      },
      {
        posicao: 4,
        nome: "Angelica Enfermeira",
        partido: "PROS",
        votos: 3731,
        porcentagem: "6,36%"
      },
      {
        posicao: 5,
        nome: "Deltan Dallagnol",
        partido: "PODEMOS",
        votos: 2228,
        porcentagem: "3,80%"
      },
      {
        posicao: 6,
        nome: "Sargento Fahur",
        partido: "PSD",
        votos: 2225,
        porcentagem: "3,79%"
      },
      {
        posicao: 7,
        nome: "Luciano Ducci",
        partido: "PSB",
        votos: 2130,
        porcentagem: "3,63%"
      },
      {
        posicao: 8,
        nome: "Luísa Canziani",
        partido: "PSD",
        votos: 1777,
        porcentagem: "3,03%"
      },
      {
        posicao: 9,
        nome: "Oduwaldo Calixto",
        partido: "PL",
        votos: 1757,
        porcentagem: "2,99%"
      },
      {
        posicao: 10,
        nome: "Gleisi",
        partido: "PT",
        votos: 1724,
        porcentagem: "2,94%"
      }
    ],
    brancos: "7,63%",
    nulos: "4,97%"
  },
  deputadosEstaduais: {
    ranking: [
      {
        posicao: 1,
        nome: "Tiago Amaral",
        partido: "PSD",
        votos: 15471,
        porcentagem: "26,65%"
      },
      {
        posicao: 2,
        nome: "Pedro Paulo Bazana",
        partido: "PSD",
        votos: 9843,
        porcentagem: "16,96%"
      },
      {
        posicao: 3,
        nome: "Aroldo Pagan",
        partido: "PODEMOS",
        votos: 5486,
        porcentagem: "9,45%"
      },
      {
        posicao: 4,
        nome: "Marcio Nunes",
        partido: "PSD",
        votos: 2974,
        porcentagem: "5,12%"
      },
      {
        posicao: 5,
        nome: "Cobra Repórter",
        partido: "PSD",
        votos: 2190,
        porcentagem: "3,77%"
      },
      {
        posicao: 6,
        nome: "Delegado Jacovós",
        partido: "PL",
        votos: 1403,
        porcentagem: "2,42%"
      },
      {
        posicao: 7,
        nome: "Arilson Chiorato",
        partido: "PT",
        votos: 818,
        porcentagem: "1,41%"
      },
      {
        posicao: 8,
        nome: "Tercilio Turini",
        partido: "PSD",
        votos: 617,
        porcentagem: "1,06%"
      },
      {
        posicao: 9,
        nome: "Cloara Pinheiro",
        partido: "PSD",
        votos: 275,
        porcentagem: "0,47%"
      },
      {
        posicao: 10,
        nome: "Alexandre Curi",
        partido: "PSD",
        votos: 248,
        porcentagem: "0,43%"
      }
    ]
  }
};
