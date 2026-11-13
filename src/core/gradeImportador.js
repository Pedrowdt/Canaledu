// src/core/gradeImportador.js
// Módulo de importação de grades para o Editor de Grade (CanalEdu White-Label).
// Suporta a grade padrão da TV Brasil (Semana 44) e parsing de CSV/JSON com pré-visualização.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var g = root || (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
    if (g) g.GradeImportador = factory(g.GradeEditorCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (GradeEditorCore) {
  'use strict';

  // Grade Oficial TV Brasil — Semana 44 (02 a 08 de Novembro de 2026)
  // Estruturada em blocos contínuos de 24h (das 06:00 às 06:00 do dia seguinte)
  const GRADE_TV_BRASIL_SEMANA_45 = {
  "versao": "Semana 45 (09 a 15/11/2026 - Oficial)",
  "emissoraNome": "TV Brasil",
  "dias": {
    "0": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "RETRATOS DE FÉ",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "DE VOLTA ÀS ESCRITURAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "PALAVRAS DE VIDA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "08:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "SANTA MISSA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "09:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "VALE AGRÍCOLA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "10:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "CANTO E SABOR DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "11:00:00",
        "duration": "00:45:00",
        "program": {
          "title": "LENDAS DO MOTOCROSS BRASILEIRO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "11:45:00",
        "duration": "01:00:00",
        "program": {
          "title": "DOCS BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:45:00",
        "duration": "00:15:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "SAMBA NA GAMBOA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "01:30:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "17:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "HOMENS DO CAMINHO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "RECORDAR TV",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "19:00:00",
        "duration": "03:30:00",
        "program": {
          "title": "PRÊMIO TV BRASIL PETROBRAS PARA ELAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "22:30:00",
        "duration": "01:45:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "00:15:00",
        "duration": "01:15:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "HOMENS DO CAMINHO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "RECORDAR TV",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "CRIATURAS DO GRANDE AZUL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM ANO SELVAGEM NA TERRA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "1": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "RAIZ BRASILEIRA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "AGRO AMAZONAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-1-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-1-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-1-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "NOVA AMAZÔNIA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPORTER BRASIL TARDE - AO VIVO",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "TRIO DE ATAQUE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPÓRTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "20:00:00",
        "duration": "00:45:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "20:45:00",
        "duration": "02:15:00",
        "program": {
          "title": "PAULISTA F SUB-20 PETROBRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "23:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "CAMINHOS DA REPORTAGEM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:30:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "CAMINHOS DA REPORTAGEM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "TRIO DE ATAQUE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "2": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "DISCOTOCA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "AGRO EDUCATIVA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-2-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-2-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-2-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "DESTINO PERNAMBUCO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPORTER BRASIL TARDE - AO VIVO",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA - AO VIVO",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "18:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 07",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "STADIUM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPÓRTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "20:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "CRIATURAS DO GRANDE AZUL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "ECONOMIA E FUTURO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "COMO NASCEM OS HERÓIS? - T 01 EP 06",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:30:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "CRIATURAS DO GRANDE AZUL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "ECONOMIA E FUTURO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "COMO NASCEM OS HERÓIS? - T 01 EP 06",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 07",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "3": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "UNIVERCIÊNCIA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "CULTURAS DO CAMPO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-3-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-3-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-3-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "VEM VER",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPORTER BRASIL TARDE - AO VIVO",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA - AO VIVO",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "18:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 08",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "STADIUM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPÓRTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "20:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "ÁGUA BRANCA: O CAMPO NA CIDADE - T 01 EP 03",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "ENERGIA DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "RUMO AO MARAVILHOSO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "TRILHA DE LETRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:30:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "ÁGUA BRANCA: O CAMPO NA CIDADE - T 01 EP 03",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "ENERGIA DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "RUMO AO MARAVILHOSO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "TRILHA DE LETRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 08",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "4": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "VOZES DO SEMIÁRIDO",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "AGRICULTURA ALTO VALE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-4-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-4-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-4-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "É LOGO ALI",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPORTER BRASIL TARDE - AO VIVO",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA - AO VIVO",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "18:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 09",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "STADIUM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPÓRTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "20:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM ANO SELVAGEM NA TERRA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "RECORDAR TV",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "NA FORAÇA DA LEI",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:30:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM ANO SELVAGEM NA TERRA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "RECORDAR TV",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "NA FORAÇA DA LEI",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 09",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "5": [
      {
        "time": "06:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "OLHAR INDEPENDENTE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "06:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BEM VIVER",
          "code": "",
          "categoria": "Geral",
          "classificacao": "rnpc",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-5-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-5-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-5-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BEM BAHIA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPORTER BRASIL TARDE - AO VIVO",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "PARQUES DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "EXPEDIÇÕES",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "16:00:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 10",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "STADIUM",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "REPÓRTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "20:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "DOCS BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "SAMBA NA GAMBOA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "CIÊNCIA FLUTUANTE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:30:00",
        "duration": "02:00:00",
        "program": {
          "title": "SEM CENSURA",
          "code": "",
          "categoria": "Variedades",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "DOCS BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "SAMBA NA GAMBOA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "CIÊNCIA FLUTUANTE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "BRASIL SOBRE DUAS RODAS - T 01 EP 10",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ],
    "6": [
      {
        "time": "06:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "VALE AGRÍCOLA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "07:00:00",
        "duration": "05:30:00",
        "program": {
          "title": "TV BRASIL ANIMADA",
          "code": "",
          "categoria": "Infantil",
          "classificacao": "licenciado",
          "isFaixa": true,
          "subprogramas": [
            {
              "id": "sub-s45-6-1",
              "ordem": 1,
              "titulo": "ESSE E O BICHO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-2",
              "ordem": 2,
              "titulo": "LIA PEDRO E O MINIMUNDO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-3",
              "ordem": 3,
              "titulo": "PLAYPOLIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-4",
              "ordem": 4,
              "titulo": "TROPA TROCO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-5",
              "ordem": 5,
              "titulo": "MUNDO BITA",
              "temporada": "T 09",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-6",
              "ordem": 6,
              "titulo": "MASSINHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-7",
              "ordem": 7,
              "titulo": "MUNDO BITA",
              "temporada": "T 06",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-8",
              "ordem": 8,
              "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
              "temporada": "T 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-9",
              "ordem": 9,
              "titulo": "MUNDO BITA",
              "temporada": "T 07",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-10",
              "ordem": 10,
              "titulo": "IGARAPE MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-11",
              "ordem": 11,
              "titulo": "SONHOS E SAPATILHAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-12",
              "ordem": 12,
              "titulo": "OS CHOCOLIX",
              "temporada": "T  01 / 02 / 03",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-13",
              "ordem": 13,
              "titulo": "PORTAO MAGICO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-14",
              "ordem": 14,
              "titulo": "MUNDO BITA",
              "temporada": "T 08",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-15",
              "ordem": 15,
              "titulo": "HISTORIAS ATRAS DA PORTA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-16",
              "ordem": 16,
              "titulo": "O DIARIO DE MIKA",
              "temporada": "T 01 / 02",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-17",
              "ordem": 17,
              "titulo": "CRIANCA RAIZ",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-18",
              "ordem": 18,
              "titulo": "AS AVENTURAS DE TITA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-19",
              "ordem": 19,
              "titulo": "NINHOS EM MOVIMENTO",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-20",
              "ordem": 20,
              "titulo": "ALEM DA LENDA",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-21",
              "ordem": 21,
              "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-22",
              "ordem": 22,
              "titulo": "IURI & UDI",
              "temporada": "T 01",
              "duracao": "00:15:00"
            },
            {
              "id": "sub-s45-6-23",
              "ordem": 23,
              "titulo": "HEROINAS NEGRAS BRASILEIRAS",
              "temporada": "T 01",
              "duracao": "00:15:00"
            }
          ]
        },
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-6-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ],
        "tipoExibicao": "inedito"
      },
      {
        "time": "12:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "COZINHA AMAZÔNIA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "XODÓ DE COZINHA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "13:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "DUELO DE GUITARRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "14:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:00:00",
        "duration": "00:45:00",
        "program": {
          "title": "BRASIL ESPORTE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "15:45:00",
        "duration": "02:45:00",
        "program": {
          "title": "PAULISTA FEMININO SUB-20 PETROBRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "18:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "ESTAÇÕES - REDE MINAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "19:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "REPORTER BRASIL",
          "code": "",
          "categoria": "Jornalismo",
          "classificacao": "tv_brasil_aovivo",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "fixo"
      },
      {
        "time": "19:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "AFIADAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "20:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "21:00:00",
        "duration": "01:45:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "22:45:00",
        "duration": "00:15:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "23:00:00",
        "duration": "01:00:00",
        "program": {
          "title": "CENA MUSICAL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "tv_brasil",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "inedito"
      },
      {
        "time": "00:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "DUELO DE GUITARRAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "00:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "ESTAÇÕES - REDE MINAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "AFIADAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "01:30:00",
        "duration": "01:00:00",
        "program": {
          "title": "UM MILAGRE",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "02:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "ESTAÇÕES - REDE MINAS",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "03:00:00",
        "duration": "01:45:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "04:45:00",
        "duration": "00:15:00",
        "program": {
          "title": "SESSÃO DE CINEMA",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:00:00",
        "duration": "00:30:00",
        "program": {
          "title": "FARÓIS DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      },
      {
        "time": "05:30:00",
        "duration": "00:30:00",
        "program": {
          "title": "MEU PEDAÇO DO BRASIL",
          "code": "",
          "categoria": "Geral",
          "classificacao": "reprise_madrugada",
          "isFaixa": false,
          "subprogramas": []
        },
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": [],
        "tipoExibicao": "reprise"
      }
    ]
  },
  "recorrenciaSugerida": {
    "slots": {
      "1|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-1-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-1-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "1|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|13:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|16:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|18:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|20:45:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|23:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|03:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|03:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|04:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|04:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "1|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-2-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-2-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "2|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|13:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|16:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|18:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|18:30:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|21:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|22:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|23:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|03:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|04:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "2|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-3-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-3-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "3|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|13:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|16:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|18:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|18:30:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|21:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|21:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|22:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|23:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|03:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|03:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|04:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "3|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-4-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-4-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "4|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|13:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|16:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|18:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|18:30:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|21:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|22:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|22:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|23:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|03:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|04:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|04:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "4|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-5-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-5-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "5|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|13:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|16:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|18:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|18:30:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|21:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|22:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|23:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|03:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|04:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "5|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "licenciado",
        "isFaixa": true,
        "subprogramas": [
          {
            "id": "sub-s45-6-1",
            "ordem": 1,
            "titulo": "ESSE E O BICHO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-2",
            "ordem": 2,
            "titulo": "LIA PEDRO E O MINIMUNDO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-3",
            "ordem": 3,
            "titulo": "PLAYPOLIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-4",
            "ordem": 4,
            "titulo": "TROPA TROCO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-5",
            "ordem": 5,
            "titulo": "MUNDO BITA",
            "temporada": "T 09",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-6",
            "ordem": 6,
            "titulo": "MASSINHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-7",
            "ordem": 7,
            "titulo": "MUNDO BITA",
            "temporada": "T 06",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-8",
            "ordem": 8,
            "titulo": "LUPITA NO PLANETA DE GENTE GRANDE",
            "temporada": "T 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-9",
            "ordem": 9,
            "titulo": "MUNDO BITA",
            "temporada": "T 07",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-10",
            "ordem": 10,
            "titulo": "IGARAPE MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-11",
            "ordem": 11,
            "titulo": "SONHOS E SAPATILHAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-12",
            "ordem": 12,
            "titulo": "OS CHOCOLIX",
            "temporada": "T  01 / 02 / 03",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-13",
            "ordem": 13,
            "titulo": "PORTAO MAGICO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-14",
            "ordem": 14,
            "titulo": "MUNDO BITA",
            "temporada": "T 08",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-15",
            "ordem": 15,
            "titulo": "HISTORIAS ATRAS DA PORTA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-16",
            "ordem": 16,
            "titulo": "O DIARIO DE MIKA",
            "temporada": "T 01 / 02",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-17",
            "ordem": 17,
            "titulo": "CRIANCA RAIZ",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-18",
            "ordem": 18,
            "titulo": "AS AVENTURAS DE TITA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-19",
            "ordem": 19,
            "titulo": "NINHOS EM MOVIMENTO",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-20",
            "ordem": 20,
            "titulo": "ALEM DA LENDA",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-21",
            "ordem": 21,
            "titulo": "JULIO E VERNE OS IRMAOS GEMIAIS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-22",
            "ordem": 22,
            "titulo": "IURI & UDI",
            "temporada": "T 01",
            "duracao": "00:15:00"
          },
          {
            "id": "sub-s45-6-23",
            "ordem": 23,
            "titulo": "HEROINAS NEGRAS BRASILEIRAS",
            "temporada": "T 01",
            "duracao": "00:15:00"
          }
        ]
      },
      "6|12:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|13:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|13:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|15:45:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|18:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil_aovivo",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|19:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|20:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|21:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|22:45:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|23:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|00:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|00:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|01:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|03:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|04:45:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "6|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|06:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|06:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "rnpc",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|07:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|08:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|09:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|10:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|11:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|11:45:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|12:45:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|13:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|14:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|14:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|15:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|15:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|16:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|17:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|18:00:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|18:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|19:00:00": {
        "tipoExibicao": "fixo",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|22:30:00": {
        "tipoExibicao": "inedito",
        "classificacao": "tv_brasil",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|00:15:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|01:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|02:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|02:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|03:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|04:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|05:00:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      },
      "0|05:30:00": {
        "tipoExibicao": "reprise",
        "classificacao": "reprise_madrugada",
        "isFaixa": false,
        "subprogramas": []
      }
    },
    "filas": {
      "TV BRASIL ANIMADA": [
        "ESSE E O BICHO",
        "LIA PEDRO E O MINIMUNDO",
        "PLAYPOLIS",
        "TROPA TROCO",
        "MUNDO BITA",
        "MASSINHAS",
        "MUNDO BITA",
        "LUPITA NO PLANETA DE GENTE GRANDE",
        "MUNDO BITA",
        "IGARAPE MAGICO",
        "SONHOS E SAPATILHAS",
        "OS CHOCOLIX",
        "PORTAO MAGICO",
        "MUNDO BITA",
        "HISTORIAS ATRAS DA PORTA",
        "O DIARIO DE MIKA",
        "CRIANCA RAIZ",
        "AS AVENTURAS DE TITA",
        "NINHOS EM MOVIMENTO",
        "ALEM DA LENDA",
        "JULIO E VERNE OS IRMAOS GEMIAIS",
        "IURI & UDI",
        "HEROINAS NEGRAS BRASILEIRAS"
      ],
      "SEM CENSURA": [
        {
          "temporada": "T 26",
          "episodio": "EP 131",
          "titulo": "HISTÓRIA COM SABOR"
        },
        {
          "temporada": "T 26",
          "episodio": "EP 135",
          "titulo": "ESPECIAL NELSON MOTTA"
        }
      ]
    }
  }
};

  const GRADE_TV_BRASIL_SEMANA_44 = {
    versao: 'Semana 44 (02 a 08/11/2026)',
    emissoraNome: 'TV Brasil',
    dias: {
      // 1: Segunda-feira
      1: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Raiz Brasileira', code: 'TV_SAGRES_T03_EP11', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agro Amazonas', code: 'TV_AGUAS_T03_EP31', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL', categoria: 'Infantil', isFaixa: true, classificacao: 'tv_brasil', subprogramas: [
          { titulo: 'ESSE E O BICHO', temporada: 'T 01', duracao: '00:15:00', ordem: 1 },
          { titulo: 'LIA PEDRO E O MINIMUNDO', temporada: 'T 01', duracao: '00:15:00', ordem: 2 },
          { titulo: 'PLAYPOLIS', temporada: 'T 01', duracao: '00:15:00', ordem: 3 },
          { titulo: 'TROPA TROCO', temporada: 'T 01', duracao: '00:15:00', ordem: 4 },
          { titulo: 'MUNDO BITA', temporada: 'T 09', duracao: '00:15:00', ordem: 5 },
          { titulo: 'MASSINHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 6 },
          { titulo: 'MUNDO BITA', temporada: 'T 06', duracao: '00:15:00', ordem: 7 },
          { titulo: 'LUPITA NO PLANETA DE GENTE GRANDE', temporada: 'T 02', duracao: '00:15:00', ordem: 8 },
          { titulo: 'MUNDO BITA', temporada: 'T 07', duracao: '00:15:00', ordem: 9 },
          { titulo: 'IGARAPE MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 10 },
          { titulo: 'SONHOS E SAPATILHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 11 },
          { titulo: 'OS CHOCOLIX', temporada: 'T 01 / 02 / 03', duracao: '00:15:00', ordem: 12 },
          { titulo: 'PORTAO MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 13 },
          { titulo: 'MUNDO BITA', temporada: 'T 08', duracao: '00:15:00', ordem: 14 },
          { titulo: 'HISTORIAS ATRAS DA PORTA', temporada: 'T 01', duracao: '00:15:00', ordem: 15 },
          { titulo: 'O DIARIO DE MIKA', temporada: 'T 01 / 02', duracao: '00:15:00', ordem: 16 },
          { titulo: 'CRIANCA RAIZ', temporada: 'T 01', duracao: '00:15:00', ordem: 17 },
          { titulo: 'AS AVENTURAS DE TITA', temporada: 'T 01', duracao: '00:15:00', ordem: 18 },
          { titulo: 'NINHOS EM MOVIMENTO', temporada: 'T 01', duracao: '00:15:00', ordem: 19 },
          { titulo: 'ALEM DA LENDA', temporada: 'T 01', duracao: '00:15:00', ordem: 20 },
          { titulo: 'JULIO E VERNE OS IRMAOS GEMIAIS', temporada: 'T 01', duracao: '00:15:00', ordem: 21 },
          { titulo: 'IURI & UDI', temporada: 'T 01', duracao: '00:15:00', ordem: 22 },
          { titulo: 'HEROINAS NEGRAS BRASILEIRAS', temporada: 'T 01', duracao: '00:15:00', ordem: 23 }
        ] }, tipoExibicao: 'fixo', isFaixa: true, classificacao: 'tv_brasil' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Nova Amazônia', code: 'TV_AGUAS_T09_EP07', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP11', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP03', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_01', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP126', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Trio de Ataque', code: 'TRIO_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP109', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_SUJEITO_OCULTO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Caminhos da Reportagem', code: 'CAMINHOS_REP_SEG', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP126', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP109', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_SUJEITO_OCULTO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Caminhos da Reportagem (Reprise)', code: 'CAMINHOS_REP_SEG', categoria: 'Jornalismo' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Trio de Ataque (Reprise)', code: 'TRIO_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '18:15:00' } },
      ],
      // 2: Terça-feira
      2: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Discotoca', code: 'TVC_PARA_T03_EP13', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agro Educativa', code: 'TV_MS_T02_EP43', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL', categoria: 'Infantil', isFaixa: true, classificacao: 'tv_brasil', subprogramas: [
          { titulo: 'ESSE E O BICHO', temporada: 'T 01', duracao: '00:15:00', ordem: 1 },
          { titulo: 'LIA PEDRO E O MINIMUNDO', temporada: 'T 01', duracao: '00:15:00', ordem: 2 },
          { titulo: 'PLAYPOLIS', temporada: 'T 01', duracao: '00:15:00', ordem: 3 },
          { titulo: 'TROPA TROCO', temporada: 'T 01', duracao: '00:15:00', ordem: 4 },
          { titulo: 'MUNDO BITA', temporada: 'T 09', duracao: '00:15:00', ordem: 5 },
          { titulo: 'MASSINHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 6 },
          { titulo: 'MUNDO BITA', temporada: 'T 06', duracao: '00:15:00', ordem: 7 },
          { titulo: 'LUPITA NO PLANETA DE GENTE GRANDE', temporada: 'T 02', duracao: '00:15:00', ordem: 8 },
          { titulo: 'MUNDO BITA', temporada: 'T 07', duracao: '00:15:00', ordem: 9 },
          { titulo: 'IGARAPE MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 10 },
          { titulo: 'SONHOS E SAPATILHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 11 },
          { titulo: 'OS CHOCOLIX', temporada: 'T 01 / 02 / 03', duracao: '00:15:00', ordem: 12 },
          { titulo: 'PORTAO MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 13 },
          { titulo: 'MUNDO BITA', temporada: 'T 08', duracao: '00:15:00', ordem: 14 },
          { titulo: 'HISTORIAS ATRAS DA PORTA', temporada: 'T 01', duracao: '00:15:00', ordem: 15 },
          { titulo: 'O DIARIO DE MIKA', temporada: 'T 01 / 02', duracao: '00:15:00', ordem: 16 },
          { titulo: 'CRIANCA RAIZ', temporada: 'T 01', duracao: '00:15:00', ordem: 17 },
          { titulo: 'AS AVENTURAS DE TITA', temporada: 'T 01', duracao: '00:15:00', ordem: 18 },
          { titulo: 'NINHOS EM MOVIMENTO', temporada: 'T 01', duracao: '00:15:00', ordem: 19 },
          { titulo: 'ALEM DA LENDA', temporada: 'T 01', duracao: '00:15:00', ordem: 20 },
          { titulo: 'JULIO E VERNE OS IRMAOS GEMIAIS', temporada: 'T 01', duracao: '00:15:00', ordem: 21 },
          { titulo: 'IURI & UDI', temporada: 'T 01', duracao: '00:15:00', ordem: 22 },
          { titulo: 'HEROINAS NEGRAS BRASILEIRAS', temporada: 'T 01', duracao: '00:15:00', ordem: 23 }
        ] }, tipoExibicao: 'fixo', isFaixa: true, classificacao: 'tv_brasil' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Destino Pernambuco', code: 'TV_PE_T01_EP14', categoria: 'Turismo' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP12', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP04', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_02', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP127', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Estádio CBN', code: 'ESTADIO_CBN', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP110', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_TERCA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Brasil Visual', code: 'BRASIL_VISUAL', categoria: 'Artes' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP127', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP110', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_TERCA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Brasil Visual (Reprise)', code: 'BRASIL_VISUAL', categoria: 'Artes' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 3: Quarta-feira
      3: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Univerciência', code: 'TV_UESB_T08_EP06', categoria: 'Ciência' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Culturas do Campo', code: 'TVE_ES_T02_EP44', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL', categoria: 'Infantil', isFaixa: true, classificacao: 'tv_brasil', subprogramas: [
          { titulo: 'ESSE E O BICHO', temporada: 'T 01', duracao: '00:15:00', ordem: 1 },
          { titulo: 'LIA PEDRO E O MINIMUNDO', temporada: 'T 01', duracao: '00:15:00', ordem: 2 },
          { titulo: 'PLAYPOLIS', temporada: 'T 01', duracao: '00:15:00', ordem: 3 },
          { titulo: 'TROPA TROCO', temporada: 'T 01', duracao: '00:15:00', ordem: 4 },
          { titulo: 'MUNDO BITA', temporada: 'T 09', duracao: '00:15:00', ordem: 5 },
          { titulo: 'MASSINHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 6 },
          { titulo: 'MUNDO BITA', temporada: 'T 06', duracao: '00:15:00', ordem: 7 },
          { titulo: 'LUPITA NO PLANETA DE GENTE GRANDE', temporada: 'T 02', duracao: '00:15:00', ordem: 8 },
          { titulo: 'MUNDO BITA', temporada: 'T 07', duracao: '00:15:00', ordem: 9 },
          { titulo: 'IGARAPE MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 10 },
          { titulo: 'SONHOS E SAPATILHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 11 },
          { titulo: 'OS CHOCOLIX', temporada: 'T 01 / 02 / 03', duracao: '00:15:00', ordem: 12 },
          { titulo: 'PORTAO MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 13 },
          { titulo: 'MUNDO BITA', temporada: 'T 08', duracao: '00:15:00', ordem: 14 },
          { titulo: 'HISTORIAS ATRAS DA PORTA', temporada: 'T 01', duracao: '00:15:00', ordem: 15 },
          { titulo: 'O DIARIO DE MIKA', temporada: 'T 01 / 02', duracao: '00:15:00', ordem: 16 },
          { titulo: 'CRIANCA RAIZ', temporada: 'T 01', duracao: '00:15:00', ordem: 17 },
          { titulo: 'AS AVENTURAS DE TITA', temporada: 'T 01', duracao: '00:15:00', ordem: 18 },
          { titulo: 'NINHOS EM MOVIMENTO', temporada: 'T 01', duracao: '00:15:00', ordem: 19 },
          { titulo: 'ALEM DA LENDA', temporada: 'T 01', duracao: '00:15:00', ordem: 20 },
          { titulo: 'JULIO E VERNE OS IRMAOS GEMIAIS', temporada: 'T 01', duracao: '00:15:00', ordem: 21 },
          { titulo: 'IURI & UDI', temporada: 'T 01', duracao: '00:15:00', ordem: 22 },
          { titulo: 'HEROINAS NEGRAS BRASILEIRAS', temporada: 'T 01', duracao: '00:15:00', ordem: 23 }
        ] }, tipoExibicao: 'fixo', isFaixa: true, classificacao: 'tv_brasil' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Vem Ver', code: 'VEM_VER_T02_EP10', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP13', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP05', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_03', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP128', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'No Mundo da Bola', code: 'BOLA_QUA', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP111', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_QUARTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Doc Especial', code: 'DOC_ESPECIAL_QUA', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP128', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP111', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_QUARTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Doc Especial (Reprise)', code: 'DOC_ESPECIAL_QUA', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 4: Quinta-feira
      4: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Vozes do Semiárido', code: 'TV_UERN_T01_EP03', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agricultura Alto Vale', code: 'BELA_ALIANCA_T03_EP44', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL', categoria: 'Infantil', isFaixa: true, classificacao: 'tv_brasil', subprogramas: [
          { titulo: 'ESSE E O BICHO', temporada: 'T 01', duracao: '00:15:00', ordem: 1 },
          { titulo: 'LIA PEDRO E O MINIMUNDO', temporada: 'T 01', duracao: '00:15:00', ordem: 2 },
          { titulo: 'PLAYPOLIS', temporada: 'T 01', duracao: '00:15:00', ordem: 3 },
          { titulo: 'TROPA TROCO', temporada: 'T 01', duracao: '00:15:00', ordem: 4 },
          { titulo: 'MUNDO BITA', temporada: 'T 09', duracao: '00:15:00', ordem: 5 },
          { titulo: 'MASSINHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 6 },
          { titulo: 'MUNDO BITA', temporada: 'T 06', duracao: '00:15:00', ordem: 7 },
          { titulo: 'LUPITA NO PLANETA DE GENTE GRANDE', temporada: 'T 02', duracao: '00:15:00', ordem: 8 },
          { titulo: 'MUNDO BITA', temporada: 'T 07', duracao: '00:15:00', ordem: 9 },
          { titulo: 'IGARAPE MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 10 },
          { titulo: 'SONHOS E SAPATILHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 11 },
          { titulo: 'OS CHOCOLIX', temporada: 'T 01 / 02 / 03', duracao: '00:15:00', ordem: 12 },
          { titulo: 'PORTAO MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 13 },
          { titulo: 'MUNDO BITA', temporada: 'T 08', duracao: '00:15:00', ordem: 14 },
          { titulo: 'HISTORIAS ATRAS DA PORTA', temporada: 'T 01', duracao: '00:15:00', ordem: 15 },
          { titulo: 'O DIARIO DE MIKA', temporada: 'T 01 / 02', duracao: '00:15:00', ordem: 16 },
          { titulo: 'CRIANCA RAIZ', temporada: 'T 01', duracao: '00:15:00', ordem: 17 },
          { titulo: 'AS AVENTURAS DE TITA', temporada: 'T 01', duracao: '00:15:00', ordem: 18 },
          { titulo: 'NINHOS EM MOVIMENTO', temporada: 'T 01', duracao: '00:15:00', ordem: 19 },
          { titulo: 'ALEM DA LENDA', temporada: 'T 01', duracao: '00:15:00', ordem: 20 },
          { titulo: 'JULIO E VERNE OS IRMAOS GEMIAIS', temporada: 'T 01', duracao: '00:15:00', ordem: 21 },
          { titulo: 'IURI & UDI', temporada: 'T 01', duracao: '00:15:00', ordem: 22 },
          { titulo: 'HEROINAS NEGRAS BRASILEIRAS', temporada: 'T 01', duracao: '00:15:00', ordem: 23 }
        ] }, tipoExibicao: 'fixo', isFaixa: true, classificacao: 'tv_brasil' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'É Logo Ali', code: 'TVE_ES_T01_EP19', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP06', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_04', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP129', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Stadium', code: 'STADIUM_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP112', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_QUINTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Grandes Musicais', code: 'GRANDES_MUSICAIS', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP129', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP112', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_QUINTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Grandes Musicais (Reprise)', code: 'GRANDES_MUSICAIS', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 5: Sexta-feira
      5: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Olhar Independente', code: 'TVU_RN_T04_EP45', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Bem Viver', code: 'TVT_T03_EP39', categoria: 'Saúde' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL', categoria: 'Infantil', isFaixa: true, classificacao: 'tv_brasil', subprogramas: [
          { titulo: 'ESSE E O BICHO', temporada: 'T 01', duracao: '00:15:00', ordem: 1 },
          { titulo: 'LIA PEDRO E O MINIMUNDO', temporada: 'T 01', duracao: '00:15:00', ordem: 2 },
          { titulo: 'PLAYPOLIS', temporada: 'T 01', duracao: '00:15:00', ordem: 3 },
          { titulo: 'TROPA TROCO', temporada: 'T 01', duracao: '00:15:00', ordem: 4 },
          { titulo: 'MUNDO BITA', temporada: 'T 09', duracao: '00:15:00', ordem: 5 },
          { titulo: 'MASSINHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 6 },
          { titulo: 'MUNDO BITA', temporada: 'T 06', duracao: '00:15:00', ordem: 7 },
          { titulo: 'LUPITA NO PLANETA DE GENTE GRANDE', temporada: 'T 02', duracao: '00:15:00', ordem: 8 },
          { titulo: 'MUNDO BITA', temporada: 'T 07', duracao: '00:15:00', ordem: 9 },
          { titulo: 'IGARAPE MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 10 },
          { titulo: 'SONHOS E SAPATILHAS', temporada: 'T 01', duracao: '00:15:00', ordem: 11 },
          { titulo: 'OS CHOCOLIX', temporada: 'T 01 / 02 / 03', duracao: '00:15:00', ordem: 12 },
          { titulo: 'PORTAO MAGICO', temporada: 'T 01', duracao: '00:15:00', ordem: 13 },
          { titulo: 'MUNDO BITA', temporada: 'T 08', duracao: '00:15:00', ordem: 14 },
          { titulo: 'HISTORIAS ATRAS DA PORTA', temporada: 'T 01', duracao: '00:15:00', ordem: 15 },
          { titulo: 'O DIARIO DE MIKA', temporada: 'T 01 / 02', duracao: '00:15:00', ordem: 16 },
          { titulo: 'CRIANCA RAIZ', temporada: 'T 01', duracao: '00:15:00', ordem: 17 },
          { titulo: 'AS AVENTURAS DE TITA', temporada: 'T 01', duracao: '00:15:00', ordem: 18 },
          { titulo: 'NINHOS EM MOVIMENTO', temporada: 'T 01', duracao: '00:15:00', ordem: 19 },
          { titulo: 'ALEM DA LENDA', temporada: 'T 01', duracao: '00:15:00', ordem: 20 },
          { titulo: 'JULIO E VERNE OS IRMAOS GEMIAIS', temporada: 'T 01', duracao: '00:15:00', ordem: 21 },
          { titulo: 'IURI & UDI', temporada: 'T 01', duracao: '00:15:00', ordem: 22 },
          { titulo: 'HEROINAS NEGRAS BRASILEIRAS', temporada: 'T 01', duracao: '00:15:00', ordem: 23 }
        ] }, tipoExibicao: 'fixo', isFaixa: true, classificacao: 'tv_brasil' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Bem Bahia', code: 'TVE_BAHIA_T03_EP39', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP06', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP07', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_05', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP130', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Resumo Esportivo', code: 'RESUMO_ESP', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP113', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_SEXTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Cine Retrô', code: 'CINE_RETRO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP130', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP113', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_SEXTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Cine Retrô (Reprise)', code: 'CINE_RETRO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 6: Sábado
      6: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Som do Brasil', code: 'SOM_BRASIL_SAB', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Vale Agrícola', code: 'VALE_AGRICOLA_SAB', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:30:00', program: { title: 'TV Brasil Animada Especial', code: 'INFANTIL_SABADO', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:30:00', duration: '00:30:00', program: { title: 'Cozinha Amazônia', code: 'COZINHA_AMAZONIA_T03_EP07', categoria: 'Culinária' }, tipoExibicao: 'inedito' },
        { time: '13:00:00', duration: '00:30:00', program: { title: 'Xodó de Cozinha', code: 'XODO_T01_EP25', categoria: 'Culinária' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Duelo de Guitarras', code: 'GUITARRAS_T01_EP03', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '14:00:00' } },
        { time: '14:30:00', duration: '00:45:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:15:00', duration: '02:00:00', program: { title: 'Brasil Esporte Especial', code: 'BRASIL_ESPORTE_SAB', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '17:15:00', duration: '00:45:00', program: { title: 'Sessão de Cinema Curta', code: 'CINE_PEDRA_FAROL', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '18:00:00', duration: '00:30:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '18:30:00', duration: '00:30:00', program: { title: 'Estações', code: 'REDE_MINAS_T03_EP04', categoria: 'Cultura' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '00:30:00', program: { title: 'Repórter Brasil', code: 'RB_SAB_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '19:30:00', duration: '00:45:00', program: { title: 'Afiadas', code: 'AFIADAS_T01_EP05', categoria: 'Debate' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:15:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP114', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:30:00', duration: '02:00:00', program: { title: 'Sessão de Cinema Especial', code: 'CINE_ESPECIAL_SAB', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:30:00', duration: '01:30:00', program: { title: 'Noite dos Museus', code: 'MUSEUS_SAB', categoria: 'Cultura' }, tipoExibicao: 'inedito' },
        { time: '01:00:00', duration: '02:00:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_ESPECIAL_SAB', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '21:30:00' } },
        { time: '03:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP114', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '20:15:00' } },
        { time: '04:15:00', duration: '01:00:00', program: { title: 'Afiadas (Reprise)', code: 'AFIADAS_T01_EP05', categoria: 'Debate' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '19:30:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '18:00:00' } },
      ],
      // 0: Domingo
      0: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Retratos de Fé', code: 'RETRATOS_FE_T02_EP26', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:45:00', program: { title: 'De Volta às Escrituras', code: 'TV_GUARAPARI_T03_EP40', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '07:15:00', duration: '01:00:00', program: { title: 'Palavras de Vida', code: 'PALAVRAS_VIDA', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '08:15:00', duration: '01:00:00', program: { title: 'Santa Missa', code: 'MISSA_AOVIVO', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '09:15:00', duration: '01:00:00', program: { title: 'Vale Agrícola', code: 'VALE_AGRICOLA_DOM', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '10:15:00', duration: '02:15:00', program: { title: 'Futebol Feminino: Semifinal Paulista Sub-20', code: 'FUTEBOL_FEM_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '12:30:00', duration: '01:00:00', program: { title: 'Canto e Sabor do Brasil', code: 'CANTO_SABOR_T02_EP43', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Samba na Gamboa', code: 'SAMBA_GAMBOA', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '14:00:00' } },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP08', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:30:00', program: { title: 'Sessão Família', code: 'SESSAO_FAMILIA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '17:30:00', duration: '01:30:00', program: { title: 'Sessão de Cinema: Dança', code: 'CINE_MARCIA_HAYDEE', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '00:45:00', program: { title: 'Recordar TV', code: 'RECORDAR_T05_EP01', categoria: 'Memória' }, tipoExibicao: 'inedito' },
        { time: '19:45:00', duration: '00:30:00', program: { title: 'Um Ano Selvagem na Terra', code: 'SELVAGEM_T01_EP05', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:15:00', program: { title: 'Estádio CBN Domingo', code: 'ESTADIO_CBN_DOM', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '21:30:00', duration: '02:00:00', program: { title: 'Sessão de Cinema Clássico', code: 'CINE_DOMINGO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:30:00', duration: '01:30:00', program: { title: 'Canto e Sabor do Brasil (Reprise)', code: 'CANTO_SABOR_T02_EP43', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '12:30:00' } },
        { time: '01:00:00', duration: '02:00:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_DOMINGO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '21:30:00' } },
        { time: '03:00:00', duration: '01:30:00', program: { title: 'Samba na Gamboa (Reprise)', code: 'SAMBA_GAMBOA', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '13:30:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Recordar TV (Reprise)', code: 'RECORDAR_T05_EP01', categoria: 'Memória' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '19:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP06', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
    },
  };

  /**
   * Converte o preset ou um objeto estruturado em blocos e acervo prontos para o Editor de Grade.
   */
  const SUBPROGRAMAS_TV_BRASIL_ANIMADA = [
    { ordem: 1, titulo: "ESSE E O BICHO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 2, titulo: "LIA PEDRO E O MINIMUNDO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 3, titulo: "PLAYPOLIS - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 4, titulo: "TROPA TROCO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 5, titulo: "MUNDO BITA - T 09", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 6, titulo: "MASSINHAS - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 7, titulo: "MUNDO BITA - T 06", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 8, titulo: "LUPITA NO PLANETA DE GENTE GRANDE - T 02", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 9, titulo: "MUNDO BITA - T 07", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 10, titulo: "IGARAPE MAGICO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 11, titulo: "SONHOS E SAPATILHAS - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 12, titulo: "OS CHOCOLIX - T  01 / 02 / 03", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 13, titulo: "PORTAO MAGICO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 14, titulo: "MUNDO BITA - T 08", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 15, titulo: "HISTORIAS ATRAS DA PORTA - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 16, titulo: "O DIARIO DE MIKA - T 01 / 02", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 17, titulo: "CRIANCA RAIZ - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 18, titulo: "AS AVENTURAS DE TITA - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 19, titulo: "NINHOS EM MOVIMENTO - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 20, titulo: "ALEM DA LENDA - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 21, titulo: "JULIO E VERNE OS IRMAOS GEMIAIS - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 22, titulo: "IURI & UDI - T 01", categoria: "Infantil", duracao: "00:15:00" },
    { ordem: 23, titulo: "HEROINAS NEGRAS BRASILEIRAS - T 01", categoria: "Infantil", duracao: "00:15:00" },
  ];

  /**
   * Converte o preset ou um objeto estruturado em blocos e acervo prontos para o Editor de Grade.
   * Por padrão, faixas compostas (ex: TV Brasil Animada) são desmembradas em slots individuais de 15 min.
   */
  function prepararPreviaImportacao(dadosGrade, acervoAtual = [], opcoes = {}) {
    if (!dadosGrade || !dadosGrade.dias) {
      throw new Error('Formato de dados de grade inválido. Objeto com chave "dias" é esperado.');
    }

    const desmembrarFaixas = opcoes.desmembrarFaixas !== false; // Padrão: true

    const acervoMap = new Map();
    (acervoAtual || []).forEach(p => {
      if (p && p.title) {
        acervoMap.set(p.title.trim().toUpperCase(), p);
      }
    });

    const novosProgramas = [];
    const programasIdentificados = new Map();
    let totalSlots = 0;
    const diasResumo = {};
    const slotsPorDia = {};
    const avisos = [];
    const recorrenciaSugerida = { slots: {}, episodeQueues: {}, dateExceptions: {} };

    // Dias 0 a 6
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const items = dadosGrade.dias[d] || [];
      diasResumo[d] = {
        nome: getNomeDia(d),
        totalSlots: 0,
        duracaoTotalSec: 0,
        programasUnicos: new Set(),
      };

      const blocks = [];
      items.forEach((item, idx) => {
        const prog = item.program || {};
        const title = (prog.title || item.title || 'Livre').trim();
        const code = (prog.code || item.code || '').trim();
        const categoria = prog.categoria || item.categoria || 'Geral';
        const durStr = item.duration || '00:30:00';
        const durSec = timeToSec(durStr);
        const isFaixa = !!(item.isFaixa || prog.isFaixa || /ANIMADA|FAIXA/i.test(title));
        let subs = item.subprogramas || prog.subprogramas || [];

        if (isFaixa && (!subs || subs.length === 0) && /ANIMADA/i.test(title)) {
          subs = SUBPROGRAMAS_TV_BRASIL_ANIMADA;
        }

        // Desmembramento de faixas: total ou até o limite de tempo do bloco (sem sobreposição)
        const duracaoAtrações = Array.isArray(subs) ? subs.reduce((sum, sub) => sum + (timeToSec(typeof sub === 'object' ? sub.duracao : null) || 900), 0) : 0;
        const podeDesmembrarTotal = desmembrarFaixas && isFaixa && Array.isArray(subs) && subs.length > 0 && duracaoAtrações <= durSec;
        const podeDesmembrarParcial = desmembrarFaixas && isFaixa && Array.isArray(subs) && subs.length > 0 && duracaoAtrações > durSec && !!opcoes.alocarAteLimite;

        if (desmembrarFaixas && isFaixa && Array.isArray(subs) && subs.length > 0 && duracaoAtrações > durSec && !opcoes.alocarAteLimite) {
          avisos.push(`${getNomeDia(d)} ${item.time || ''}: ${title} lista ${subs.length} atrações (${secToTime(duracaoAtrações)}), mas o bloco tem ${durStr}; foi mantido composto para evitar sobreposição.`);
        }

        if (podeDesmembrarTotal || podeDesmembrarParcial) {
          const faixaNome = title || 'TV BRASIL ANIMADA';
          const startSec = timeToSec(item.time || '07:00:00');
          const classificacao = item.classificacao || prog.classificacao || 'licenciado';
          let curAccumulatedSec = 0;

          subs.forEach((sub, subIdx) => {
            const slotDurSec = timeToSec(typeof sub === 'object' ? sub.duracao : null) || 900;
            const subTitle = (typeof sub === 'string' ? sub : (sub.titulo || sub.title || `Atração ${subIdx + 1}`)).trim();
            const subCode = (typeof sub === 'object' ? (sub.codigo || sub.code || '') : '').trim();
            const subCat = (typeof sub === 'object' ? sub.categoria : null) || categoria || 'Infantil';
            const subTemp = typeof sub === 'object' ? (sub.temporada || '') : '';

            // Só aloca se couber dentro da duração limite do bloco
            if (curAccumulatedSec + slotDurSec <= durSec) {
              const curStartSec = startSec + curAccumulatedSec;
              const curTime = secToTime(curStartSec);
              const curEnd = secToTime(curStartSec + slotDurSec);
              curAccumulatedSec += slotDurSec;

              totalSlots++;
              diasResumo[d].totalSlots++;
              diasResumo[d].duracaoTotalSec += slotDurSec;
              diasResumo[d].programasUnicos.add(subTitle);

              const keyUpper = subTitle.toUpperCase();
              if (!acervoMap.has(keyUpper) && !programasIdentificados.has(keyUpper)) {
                const novo = {
                  title: subTitle,
                  code: subCode,
                  categoria: subCat,
                  tempo: '00:15:00',
                };
                novosProgramas.push(novo);
                programasIdentificados.set(keyUpper, novo);
              }

              const block = {
                id: `slot_imp_${d}_${idx}_sub_${subIdx}_${curTime.replace(/:/g, '')}`,
                index: blocks.length,
                time: curTime,
                duration: secToTime(slotDurSec),
                durationSec: slotDurSec,
                endTime: curEnd,
                program: {
                  title: subTitle,
                  code: subCode,
                  categoria: subCat,
                  faixaNome: faixaNome,
                },
                faixaNome: faixaNome,
                isSubprogramaFaixa: true,
                classificacao: classificacao,
              };
              blocks.push(block);

              const ruleData = {
                tipoExibicao: (typeof sub === 'object' && sub.tipoExibicao) ? sub.tipoExibicao : 'inedito',
                origemInedito: null,
                classificacao: classificacao,
                isFaixa: false,
                isSubprogramaFaixa: true,
                faixaNome: faixaNome,
                subprogramaDe: faixaNome,
              };
              recorrenciaSugerida.slots[`${d}:${curTime}`] = ruleData;
              recorrenciaSugerida.slots[`${d}|${curTime}`] = ruleData;
            } else {
              // Atração excedeu a capacidade do bloco
              if (!diasResumo[d].atracoesExcedentes) diasResumo[d].atracoesExcedentes = [];
              diasResumo[d].atracoesExcedentes.push({
                dia: d,
                diaNome: getNomeDia(d),
                faixaNome: faixaNome,
                titulo: subTitle,
                temporada: subTemp,
                duracao: secToTime(slotDurSec),
                motivo: `Excedente à capacidade de ${durStr} da faixa (${secToTime(curAccumulatedSec)} já preenchidos)`
              });
            }
          });

          if (diasResumo[d].atracoesExcedentes && diasResumo[d].atracoesExcedentes.length > 0) {
            avisos.push(`${getNomeDia(d)} ${item.time || ''}: Faixa ${faixaNome} desmembrada em ${curAccumulatedSec / 900} slots de 15 min. ${diasResumo[d].atracoesExcedentes.length} atrações não couberam na duração de ${durStr} e ficaram pendentes de distribuição.`);
          }
          return;
        }

        // Comportamento normal para slots convencionais ou faixa não desmembrada
        totalSlots++;
        diasResumo[d].totalSlots++;
        diasResumo[d].duracaoTotalSec += durSec;
        diasResumo[d].programasUnicos.add(title);

        if (title !== 'Livre') {
          const keyUpper = title.toUpperCase();
          if (!acervoMap.has(keyUpper) && !programasIdentificados.has(keyUpper)) {
            const novo = {
              title: title,
              code: code,
              categoria: categoria,
              tempo: durStr,
            };
            novosProgramas.push(novo);
            programasIdentificados.set(keyUpper, novo);
          }
        }

        const block = {
          id: `slot_imp_${d}_${idx}_${(item.time || '00:00:00').replace(/:/g, '')}`,
          index: blocks.length,
          time: item.time || '06:00:00',
          duration: durStr,
          durationSec: durSec,
          endTime: addSeconds(item.time || '06:00:00', durSec),
          program: title !== 'Livre' ? { title, code, categoria } : null,
          isFaixa: isFaixa,
          subprogramas: subs,
        };
        blocks.push(block);

        // Regras de exibição / recorrência
        if (item.tipoExibicao || item.classificacao || isFaixa) {
          const hora = item.time || '06:00:00';
          const ruleData = {
            tipoExibicao: item.tipoExibicao || 'fixo',
            origemInedito: item.repriseDe || null,
            classificacao: item.classificacao || prog.classificacao || (title.includes('AO VIVO') ? 'tv_brasil_aovivo' : 'tv_brasil'),
            isFaixa: isFaixa,
            subprogramas: subs
          };
          recorrenciaSugerida.slots[`${d}:${hora}`] = ruleData;
          recorrenciaSugerida.slots[`${d}|${hora}`] = ruleData;
        }
      });

      slotsPorDia[d] = blocks;
      diasResumo[d].programasUnicosCount = diasResumo[d].programasUnicos.size;

      // Calcula métricas operacionais deste dia (duração, livres, excedentes, atrações pendentes)
      const metricasDia = calcularMetricasDia(blocks, d, diasResumo[d].atracoesExcedentes || []);
      Object.assign(diasResumo[d], metricasDia);
    });

    // Consolida resumo operacional semanal
    const resumoOperacional = calcularResumoOperacional(slotsPorDia, diasResumo);

    return {
      versao: dadosGrade.versao || 'Grade Semanal',
      emissoraNome: dadosGrade.emissoraNome || 'Emissora',
      totalSlots,
      diasResumo,
      resumoOperacional,
      novosProgramas,
      totalNovosProgramas: novosProgramas.length,
      avisos,
      slotsPorDia,
      recorrenciaSugerida,
    };
  }

  /**
   * Utilitário para desmembrar um bloco de faixa composta em slots de 15 minutos.
   */
  function desmembrarFaixaSlots(block, subprogramas = [], options = {}) {
    if (!block) return [];
    const faixaNome = (block.program?.title || block.faixaNome || 'Faixa Composta').trim();
    const startSec = timeToSec(block.time || '06:00:00');
    const slotDurSec = options.slotDurationSec || 900;
    const classificacao = block.classificacao || block.program?.classificacao || 'licenciado';
    const subs = (subprogramas && subprogramas.length > 0)
      ? subprogramas
      : (block.subprogramas || block.program?.subprogramas || (/ANIMADA/i.test(faixaNome) ? SUBPROGRAMAS_TV_BRASIL_ANIMADA : []));

    if (!subs.length) return [block];

    return subs.map((sub, i) => {
      const durationSec = timeToSec(typeof sub === 'object' ? sub.duracao : null) || slotDurSec;
      const curStartSec = startSec + subs.slice(0, i).reduce((sum, previous) => sum + (timeToSec(typeof previous === 'object' ? previous.duracao : null) || slotDurSec), 0);
      const curTime = secToTime(curStartSec);
      const curEnd = secToTime(curStartSec + durationSec);
      const subTitle = (typeof sub === 'string' ? sub : (sub.titulo || sub.title || `Atração ${i + 1}`)).trim();
      const subCode = (typeof sub === 'object' ? (sub.codigo || sub.code || '') : '').trim();
      const subCat = (typeof sub === 'object' ? sub.categoria : null) || block.program?.categoria || 'Infantil';

      return {
        id: `slot_desm_${curTime.replace(/:/g, '')}_${i}`,
        index: i,
        time: curTime,
        duration: secToTime(durationSec),
        durationSec,
        endTime: curEnd,
        program: {
          title: subTitle,
          code: subCode,
          categoria: subCat,
          faixaNome: faixaNome,
        },
        faixaNome: faixaNome,
        isSubprogramaFaixa: true,
        classificacao: classificacao,
      };
    });
  }

  /**
   * Utilitário para reagrupar slots consecutivos de uma faixa de volta em um único bloco composto.
   */
  function reagruparFaixaSlots(slots = [], faixaNome = null) {
    if (!Array.isArray(slots) || slots.length === 0) return null;
    const nome = (faixaNome || slots[0].faixaNome || slots[0].program?.faixaNome || 'Faixa Composta').trim();
    const startSec = timeToSec(slots[0].time || '06:00:00');
    const totalDurationSec = slots.reduce((acc, s) => acc + (s.durationSec || 900), 0);
    const totalDuration = secToTime(totalDurationSec);
    const endTime = secToTime(startSec + totalDurationSec);

    const subprogramas = slots.map((s, idx) => ({
      id: `sub-${idx + 1}`,
      ordem: idx + 1,
      titulo: s.program?.title || `Atração ${idx + 1}`,
      codigo: s.program?.code || '',
      categoria: s.program?.categoria || 'Infantil',
      duracao: s.duration || '00:15:00',
    }));

    return {
      id: `slot_agrup_${slots[0].time.replace(/:/g, '')}_faixa`,
      index: 0,
      time: slots[0].time,
      duration: totalDuration,
      durationSec: totalDurationSec,
      endTime: endTime,
      program: {
        title: nome,
        code: '',
        categoria: 'Infantil',
        isFaixa: true,
        subprogramas: subprogramas,
      },
      isFaixa: true,
      subprogramas: subprogramas,
      classificacao: slots[0].classificacao || 'licenciado',
    };
  }

  function parseCsvGrade(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Conteúdo CSV vazio ou inválido.');
    }

    const lines = csvText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));

    if (lines.length === 0) {
      throw new Error('O arquivo CSV não possui linhas válidas.');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(delimiter).map(c => c.trim().toLowerCase());

    const idxDia = header.findIndex(h => h.includes('dia') || h === 'dow');
    const idxHora = header.findIndex(h => h.includes('hora') || h.includes('time'));
    const idxDur = header.findIndex(h => h.includes('dur') || h.includes('tempo'));
    const idxProg = header.findIndex(h => h.includes('prog') || h.includes('titulo') || h.includes('title'));
    const idxCode = header.findIndex(h => h.includes('cod') || h.includes('code'));
    const idxCat = header.findIndex(h => h.includes('cat'));
    const idxTipo = header.findIndex(h => h.includes('tipo'));

    if (idxProg === -1 && idxHora === -1) {
      throw new Error('Cabeçalho do CSV deve conter pelo menos as colunas "dia", "horario" e "programa".');
    }

    const dias = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      const rawDia = idxDia !== -1 ? cols[idxDia] : '1';
      const dow = normalizarDiaSemana(rawDia);
      const time = idxHora !== -1 ? normalizarHorario(cols[idxHora]) : '06:00:00';
      const dur = idxDur !== -1 ? normalizarHorario(cols[idxDur]) : '00:30:00';
      const title = idxProg !== -1 ? cols[idxProg] : 'Livre';
      const code = idxCode !== -1 ? cols[idxCode] : '';
      const categoria = idxCat !== -1 ? cols[idxCat] : 'Geral';
      const tipoExibicao = idxTipo !== -1 ? cols[idxTipo] : 'inedito';

      if (dow !== null) {
        dias[dow].push({
          time,
          duration: dur,
          program: { title, code, categoria },
          tipoExibicao: tipoExibicao.toLowerCase().includes('reprise') ? 'reprise' : (tipoExibicao.toLowerCase().includes('fixo') ? 'fixo' : 'inedito'),
        });
      }
    }

    return {
      versao: 'Importação CSV',
      emissoraNome: 'Arquivo CSV',
      dias,
    };
  }

  function normalizarDiaSemana(val) {
    if (val === null || val === undefined) return 1;
    const s = String(val).trim().toLowerCase();
    if (s === '0' || s.startsWith('dom')) return 0;
    if (s === '1' || s.startsWith('seg')) return 1;
    if (s === '2' || s.startsWith('ter')) return 2;
    if (s === '3' || s.startsWith('qua')) return 3;
    if (s === '4' || s.startsWith('qui')) return 4;
    if (s === '5' || s.startsWith('sex')) return 5;
    if (s === '6' || s.startsWith('sab') || s.startsWith('sáb')) return 6;
    const n = parseInt(s, 10);
    return !isNaN(n) && n >= 0 && n <= 6 ? n : null;
  }

  function normalizarHorario(t) {
    if (!t) return '00:30:00';
    const s = String(t).trim();
    const parts = s.split(':').map(Number);
    if (parts.length === 3) {
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${String(parts[2]).padStart(2, '0')}`;
    }
    if (parts.length === 2) {
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:00`;
    }
    return '00:30:00';
  }

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).trim().split(':').map(Number);
    if (parts.length >= 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
    return 0;
  }

  function secToTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600) % 24;
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function addSeconds(timeStr, seconds) {
    const s = timeToSec(timeStr) + seconds;
    return secToTime(s);
  }

  function getNomeDia(dow) {
    const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return nomes[dow] || 'Dia';
  }


  function formatDurationHuman(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (s > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  function toCycleSec(timeStr) {
    const s = timeToSec(timeStr);
    const base = 21600; // 06:00:00
    return (s >= base) ? (s - base) : (s + 86400 - base);
  }

  function calcularMetricasDia(blocks = [], d = 0, atracoesExcedentes = []) {
    const diaNome = getNomeDia(d);
    let duracaoTotalSec = 0;
    const slotsLivres = [];
    const lacunas = [];
    const sobreposicoes = [];
    const atracoesNaoDistribuidas = [...(atracoesExcedentes || [])];

    // Mapeia blocos do dia
    blocks.forEach((b, idx) => {
      const durSec = b.durationSec || timeToSec(b.duration) || 0;
      duracaoTotalSec += durSec;

      const progTitle = (b.program?.title || '').trim().toUpperCase();
      const isLivre = !b.program || !b.program.title || progTitle === 'LIVRE' || progTitle === 'VAZIO' || progTitle === 'DESOCUPADO';
      if (isLivre) {
        slotsLivres.push({
          dia: d,
          diaNome,
          index: idx,
          time: b.time,
          endTime: b.endTime || addSeconds(b.time, durSec),
          duration: b.duration || secToTime(durSec),
          duracaoSec: durSec,
          tipo: 'slot_vazio'
        });
      }

      // Se o bloco foi mantido como faixa composta sem desmembrar,
      // todas as suas atrações/desenhos continuam não distribuídos em slots individuais
      if (b.isFaixa && Array.isArray(b.subprogramas) && b.subprogramas.length > 0) {
        b.subprogramas.forEach((sub, sIdx) => {
          const sTit = (typeof sub === 'string' ? sub : sub.titulo || sub.title || `Atração ${sIdx + 1}`).trim();
          const sTemp = typeof sub === 'object' ? (sub.temporada || '') : '';
          const sDur = typeof sub === 'object' ? (sub.duracao || '00:15:00') : '00:15:00';
          atracoesNaoDistribuidas.push({
            dia: d,
            diaNome,
            faixaNome: b.program?.title || b.faixaNome || 'Faixa Composta',
            titulo: sTit,
            temporada: sTemp,
            duracao: sDur,
            motivo: 'Agrupada na faixa composta (faixa mantida em bloco único)'
          });
        });
      }
    });

    // Ordena os blocos pelo ciclo diário das 06:00:00 às 06:00:00 do dia seguinte
    const ordered = [...blocks].sort((a, b) => toCycleSec(a.time) - toCycleSec(b.time));

    // Verifica lacuna no início do ciclo (entre 06:00:00 e o primeiro programa)
    if (ordered.length > 0) {
      const first = ordered[0];
      const firstStart = toCycleSec(first.time);
      if (firstStart > 0) {
        lacunas.push({
          dia: d,
          diaNome,
          inicio: '06:00:00',
          fim: first.time,
          duracao: secToTime(firstStart),
          duracaoSec: firstStart,
          entre: `Início do dia até "${first.program?.title || 'Primeiro programa'}"`,
          tipo: 'lacuna_inicio_dia'
        });
      }
    }

    // Verifica intervalos entre blocos consecutivos
    for (let i = 0; i < ordered.length - 1; i++) {
      const cur = ordered[i];
      const nxt = ordered[i + 1];
      const curStart = toCycleSec(cur.time);
      const curDur = cur.durationSec || timeToSec(cur.duration) || 0;
      const curEnd = curStart + curDur;
      const nxtStart = toCycleSec(nxt.time);

      if (nxtStart > curEnd) {
        const gapSec = nxtStart - curEnd;
        const horaInicio = secToTime((timeToSec(cur.time) + curDur) % 86400);
        lacunas.push({
          dia: d,
          diaNome,
          inicio: horaInicio,
          fim: nxt.time,
          duracao: secToTime(gapSec),
          duracaoSec: gapSec,
          entre: `Entre "${cur.program?.title || 'Anterior'}" e "${nxt.program?.title || 'Seguinte'}"`,
          tipo: 'lacuna_entre_programas'
        });
      } else if (nxtStart < curEnd) {
        const overlapSec = curEnd - nxtStart;
        sobreposicoes.push({
          dia: d,
          diaNome,
          inicio: nxt.time,
          fim: secToTime((timeToSec(cur.time) + curDur) % 86400),
          duracao: secToTime(overlapSec),
          duracaoSec: overlapSec,
          programaA: cur.program?.title || 'Anterior',
          programaB: nxt.program?.title || 'Seguinte',
          tipo: 'sobreposicao_horario'
        });
      }
    }

    // Verifica término no final do ciclo (entre o último programa e 06:00:00)
    if (ordered.length > 0) {
      const last = ordered[ordered.length - 1];
      const lastStart = toCycleSec(last.time);
      const lastDur = last.durationSec || timeToSec(last.duration) || 0;
      const lastEnd = lastStart + lastDur;
      if (lastEnd < 86400) {
        const remSec = 86400 - lastEnd;
        const horaFim = secToTime((timeToSec(last.time) + lastDur) % 86400);
        lacunas.push({
          dia: d,
          diaNome,
          inicio: horaFim,
          fim: '06:00:00',
          duracao: secToTime(remSec),
          duracaoSec: remSec,
          entre: `Término de "${last.program?.title || 'Último programa'}" até o encerramento do dia (06:00:00)`,
          tipo: 'lacuna_fim_dia'
        });
      } else if (lastEnd > 86400) {
        const excSec = lastEnd - 86400;
        sobreposicoes.push({
          dia: d,
          diaNome,
          inicio: '06:00:00',
          fim: secToTime((timeToSec(last.time) + lastDur) % 86400),
          duracao: secToTime(excSec),
          duracaoSec: excSec,
          programaA: last.program?.title || 'Último programa',
          programaB: 'Início do dia seguinte (06:00:00)',
          tipo: 'excesso_fim_dia'
        });
      }
    }

    // Tempo livre total: slots livres + lacunas
    const secSlotsLivres = slotsLivres.reduce((sum, s) => sum + s.duracaoSec, 0);
    const secLacunas = lacunas.reduce((sum, l) => sum + l.duracaoSec, 0);
    let segundosLivres = secSlotsLivres + secLacunas;
    const segEsperados = 86400;
    const dif24h = duracaoTotalSec - segEsperados;
    if (dif24h < 0) {
      const deficit = Math.abs(dif24h);
      if (deficit > segundosLivres) segundosLivres = deficit;
    }

    // Tempo excedente: sobreposições + excesso além de 24h
    const secSobreposicoes = sobreposicoes.reduce((sum, o) => sum + o.duracaoSec, 0);
    let segundosExcedentes = secSobreposicoes;
    if (dif24h > 0) {
      segundosExcedentes = Math.max(segundosExcedentes, dif24h);
    }

    return {
      diaNome,
      duracaoTotalSec,
      duracaoFormatada: formatDurationHuman(duracaoTotalSec),
      segundosEsperados: segEsperados,
      duracaoEsperadaFormatada: '24h 00m',
      segundosLivres,
      segundosLivresFormatados: formatDurationHuman(segundosLivres),
      segundosExcedentes,
      segundosExcedentesFormatados: formatDurationHuman(segundosExcedentes),
      slotsLivres,
      lacunas,
      sobreposicoes,
      atracoesNaoDistribuidas,
      isCompleto24h: duracaoTotalSec === segEsperados && lacunas.length === 0 && sobreposicoes.length === 0 && slotsLivres.length === 0,
    };
  }

  function calcularResumoOperacional(slotsPorDia = {}, diasResumo = {}) {
    let duracaoTotalSemanaSec = 0;
    let segundosLivresTotal = 0;
    let segundosExcedentesTotal = 0;
    const todosSlotsLivres = [];
    const todasLacunas = [];
    const todasSobreposicoes = [];
    const todasAtracoesNaoDistribuidas = [];

    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const info = diasResumo[d];
      if (!info) return;
      duracaoTotalSemanaSec += info.duracaoTotalSec || 0;
      segundosLivresTotal += info.segundosLivres || 0;
      segundosExcedentesTotal += info.segundosExcedentes || 0;

      (info.slotsLivres || []).forEach(s => todosSlotsLivres.push(s));
      (info.lacunas || []).forEach(l => todasLacunas.push(l));
      (info.sobreposicoes || []).forEach(o => todasSobreposicoes.push(o));
      (info.atracoesNaoDistribuidas || []).forEach(a => todasAtracoesNaoDistribuidas.push(a));
    });

    return {
      duracaoTotalSemanaSec,
      duracaoTotalSemanaFormatada: formatDurationHuman(duracaoTotalSemanaSec),
      duracaoEsperadaSemanaSec: 604800,
      duracaoEsperadaSemanaFormatada: '168h 00m',
      segundosLivresTotal,
      segundosLivresTotalFormatados: formatDurationHuman(segundosLivresTotal),
      segundosExcedentesTotal,
      segundosExcedentesTotalFormatados: formatDurationHuman(segundosExcedentesTotal),
      totalSlotsLivres: todosSlotsLivres.length,
      slotsLivres: todosSlotsLivres,
      totalLacunas: todasLacunas.length,
      lacunas: todasLacunas,
      totalSobreposicoes: todasSobreposicoes.length,
      sobreposicoes: todasSobreposicoes,
      totalAtracoesNaoDistribuidas: todasAtracoesNaoDistribuidas.length,
      atracoesNaoDistribuidas: todasAtracoesNaoDistribuidas,
      isSemanaCompleta: duracaoTotalSemanaSec === 604800 && segundosLivresTotal === 0 && segundosExcedentesTotal === 0,
    };
  }

  return {
    SUBPROGRAMAS_TV_BRASIL_ANIMADA,
    desmembrarFaixaSlots,
    reagruparFaixaSlots,
    GRADE_TV_BRASIL_SEMANA_44,
    GRADE_TV_BRASIL_SEMANA_45,
    prepararPreviaImportacao,
    parseCsvGrade,
    normalizarDiaSemana,
    normalizarHorario,
    formatDurationHuman,
    calcularMetricasDia,
    calcularResumoOperacional,
  };
});
