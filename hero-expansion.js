// 47 heróis novos com chaves imutáveis. 18 anteriores + 47 = 65 invocáveis; 5 sazonais = 70.
const EXPANSION_DATA = Object.freeze([
  {
    "key": "eldoria_white_01",
    "faction": "Guarda de Corvos",
    "motto": "Defender primeiro",
    "aura": "aura-eldoria-01",
    "name": "Brann Corvapedra",
    "type": "infantaria",
    "rarity": "white",
    "portrait": "eldoria-white-01"
  },
  {
    "key": "eldoria_white_02",
    "faction": "Campos Rosados",
    "motto": "Avançar com honra",
    "aura": "aura-eldoria-02",
    "name": "Ina Rosaforte",
    "type": "cavalaria",
    "rarity": "white",
    "portrait": "eldoria-white-02"
  },
  {
    "key": "eldoria_white_03",
    "faction": "Mata do Ouro",
    "motto": "Cada folha é sinal",
    "aura": "aura-eldoria-03",
    "name": "Taren Bosquedouro",
    "type": "arqueiro",
    "rarity": "white",
    "portrait": "eldoria-white-03"
  },
  {
    "key": "eldoria_white_04",
    "faction": "Vale do Cedro",
    "motto": "A vida persiste",
    "aura": "aura-eldoria-04",
    "name": "Milla Valtim",
    "type": "suporte",
    "rarity": "white",
    "portrait": "eldoria-white-04"
  },
  {
    "key": "eldoria_white_05",
    "faction": "Círculo de Gelo",
    "motto": "A muralha resiste",
    "aura": "aura-eldoria-05",
    "name": "Orin Pedrafria",
    "type": "infantaria",
    "rarity": "white",
    "portrait": "eldoria-white-05"
  },
  {
    "key": "eldoria_white_06",
    "faction": "Planícies Claras",
    "motto": "O caminho é nosso",
    "aura": "aura-eldoria-06",
    "name": "Sela Campolume",
    "type": "cavalaria",
    "rarity": "white",
    "portrait": "eldoria-white-06"
  },
  {
    "key": "eldoria_white_07",
    "faction": "Torres do Poente",
    "motto": "A flecha se lembra",
    "aura": "aura-eldoria-07",
    "name": "Fenric Arcoledo",
    "type": "arqueiro",
    "rarity": "white",
    "portrait": "eldoria-white-07"
  },
  {
    "key": "eldoria_white_08",
    "faction": "Círculo Âmbar",
    "motto": "Curar é resistir",
    "aura": "aura-eldoria-08",
    "name": "Nara Ambravia",
    "type": "suporte",
    "rarity": "white",
    "portrait": "eldoria-white-08"
  },
  {
    "key": "eldoria_white_09",
    "faction": "Ponte da Aurora",
    "motto": "Passagem segura",
    "aura": "aura-eldoria-09",
    "name": "Alden Ponteluz",
    "type": "infantaria",
    "rarity": "white",
    "portrait": "eldoria-white-09"
  },
  {
    "key": "eldoria_white_10",
    "faction": "Forte do Trigo",
    "motto": "Uma vida por vez",
    "aura": "aura-eldoria-10",
    "name": "Tessa Grangarda",
    "type": "cavalaria",
    "rarity": "white",
    "portrait": "eldoria-white-10"
  },
  {
    "key": "eldoria_white_11",
    "faction": "Montes Vinhedos",
    "motto": "Toda casa é reino",
    "aura": "aura-eldoria-11",
    "name": "Rurik Vinhamar",
    "type": "infantaria",
    "rarity": "white",
    "portrait": "eldoria-white-11"
  },
  {
    "key": "eldoria_white_12",
    "faction": "Bosque dos Corvos",
    "motto": "O sol ainda brilha",
    "aura": "aura-eldoria-12",
    "name": "Elin Corvassol",
    "type": "arqueiro",
    "rarity": "white",
    "portrait": "eldoria-white-12"
  },
  {
    "key": "eldoria_white_13",
    "faction": "Campos da Colheita",
    "motto": "Nenhuma vila cai",
    "aura": "aura-eldoria-13",
    "name": "Ciro Palhaforte",
    "type": "infantaria",
    "rarity": "white",
    "portrait": "eldoria-white-13"
  },
  {
    "key": "eldoria_white_14",
    "faction": "Fontes do Cristal",
    "motto": "A paz se protege",
    "aura": "aura-eldoria-14",
    "name": "Vina Cristalina",
    "type": "suporte",
    "rarity": "white",
    "portrait": "eldoria-white-14"
  },
  {
    "key": "eldoria_blue_15",
    "faction": "Muralha Boreal",
    "motto": "Ao norte não cedemos",
    "aura": "aura-eldoria-15",
    "name": "Ivar Ferronévoa",
    "type": "infantaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-15"
  },
  {
    "key": "eldoria_blue_16",
    "faction": "Torre do Vento",
    "motto": "O céu informa",
    "aura": "aura-eldoria-16",
    "name": "Lyss Tecevento",
    "type": "arqueiro",
    "rarity": "blue",
    "portrait": "eldoria-blue-16"
  },
  {
    "key": "eldoria_blue_17",
    "faction": "Faróis Altos",
    "motto": "Eu vejo a passagem",
    "aura": "aura-eldoria-17",
    "name": "Corvin Lumealto",
    "type": "cavalaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-17"
  },
  {
    "key": "eldoria_blue_18",
    "faction": "Forjas de Arven",
    "motto": "Meu aço não falha",
    "aura": "aura-eldoria-18",
    "name": "Adria Talhapedra",
    "type": "infantaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-18"
  },
  {
    "key": "eldoria_blue_19",
    "faction": "Cordilheira Vhal",
    "motto": "Fogo com disciplina",
    "aura": "aura-eldoria-19",
    "name": "Beren Escamaluz",
    "type": "cavalaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-19"
  },
  {
    "key": "eldoria_blue_20",
    "faction": "Costa das Âncoras",
    "motto": "A maré avisa",
    "aura": "aura-eldoria-20",
    "name": "Veyla Marebrava",
    "type": "arqueiro",
    "rarity": "blue",
    "portrait": "eldoria-blue-20"
  },
  {
    "key": "eldoria_blue_21",
    "faction": "Estradas Rubras",
    "motto": "Nenhum viajante só",
    "aura": "aura-eldoria-21",
    "name": "Garric Ventroura",
    "type": "infantaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-21"
  },
  {
    "key": "eldoria_blue_22",
    "faction": "Prado Estelar",
    "motto": "Magia para todos",
    "aura": "aura-eldoria-22",
    "name": "Isen Roscaelo",
    "type": "suporte",
    "rarity": "blue",
    "portrait": "eldoria-blue-22"
  },
  {
    "key": "eldoria_blue_23",
    "faction": "Jardins Cinzentos",
    "motto": "Luz após a cinza",
    "aura": "aura-eldoria-23",
    "name": "Selene Cinderval",
    "type": "suporte",
    "rarity": "blue",
    "portrait": "eldoria-blue-23"
  },
  {
    "key": "eldoria_blue_24",
    "faction": "Mar da Bruma",
    "motto": "Luto pelo futuro",
    "aura": "aura-eldoria-24",
    "name": "Tork Brumamar",
    "type": "cavalaria",
    "rarity": "blue",
    "portrait": "eldoria-blue-24"
  },
  {
    "key": "eldoria_blue_25",
    "faction": "Rio das Safiras",
    "motto": "A corrente ensina",
    "aura": "aura-eldoria-25",
    "name": "Naia Cristalflo",
    "type": "arqueiro",
    "rarity": "blue",
    "portrait": "eldoria-blue-25"
  },
  {
    "key": "eldoria_blue_26",
    "faction": "Mirante das Runas",
    "motto": "Cada marca é aviso",
    "aura": "aura-eldoria-26",
    "name": "Aeron Falcorruna",
    "type": "arqueiro",
    "rarity": "blue",
    "portrait": "eldoria-blue-26"
  },
  {
    "key": "eldoria_blue_27",
    "faction": "Santuário Vesper",
    "motto": "A noite é caminho",
    "aura": "aura-eldoria-27",
    "name": "Livra Vesper",
    "type": "suporte",
    "rarity": "blue",
    "portrait": "eldoria-blue-27"
  },
  {
    "key": "eldoria_purple_28",
    "faction": "Fortaleza Alada",
    "motto": "A distância obedece",
    "aura": "aura-eldoria-28",
    "name": "Eldrin Setearcos",
    "type": "arqueiro",
    "rarity": "purple",
    "portrait": "eldoria-purple-28"
  },
  {
    "key": "eldoria_purple_29",
    "faction": "Vale Celeste",
    "motto": "Que o céu responda",
    "aura": "aura-eldoria-29",
    "name": "Aelira Valnox",
    "type": "suporte",
    "rarity": "purple",
    "portrait": "eldoria-purple-29"
  },
  {
    "key": "eldoria_purple_30",
    "faction": "Coração da Montanha",
    "motto": "Forjamos o amanhã",
    "aura": "aura-eldoria-30",
    "name": "Vardek Solferro",
    "type": "infantaria",
    "rarity": "purple",
    "portrait": "eldoria-purple-30"
  },
  {
    "key": "eldoria_purple_31",
    "faction": "Escarpas dos Dragões",
    "motto": "Voamos em união",
    "aura": "aura-eldoria-31",
    "name": "Sylena Dragonave",
    "type": "cavalaria",
    "rarity": "purple",
    "portrait": "eldoria-purple-31"
  },
  {
    "key": "eldoria_purple_32",
    "faction": "Trono do Estuário",
    "motto": "A água sustenta",
    "aura": "aura-eldoria-32",
    "name": "Draven Corsal",
    "type": "infantaria",
    "rarity": "purple",
    "portrait": "eldoria-purple-32"
  },
  {
    "key": "eldoria_purple_33",
    "faction": "Biblioteca da Aurora",
    "motto": "Conhecer é defender",
    "aura": "aura-eldoria-33",
    "name": "Miren Aureliar",
    "type": "suporte",
    "rarity": "purple",
    "portrait": "eldoria-purple-33"
  },
  {
    "key": "eldoria_purple_34",
    "faction": "Patrulha Celeste",
    "motto": "Vejo antes da aurora",
    "aura": "aura-eldoria-34",
    "name": "Keldra Pratocéu",
    "type": "arqueiro",
    "rarity": "purple",
    "portrait": "eldoria-purple-34"
  },
  {
    "key": "eldoria_purple_35",
    "faction": "Portões Rúnicos",
    "motto": "A ordem protege",
    "aura": "aura-eldoria-35",
    "name": "Eryon Coraçãoruna",
    "type": "infantaria",
    "rarity": "purple",
    "portrait": "eldoria-purple-35"
  },
  {
    "key": "eldoria_purple_36",
    "faction": "Fonte da Montanha",
    "motto": "A memória cura",
    "aura": "aura-eldoria-36",
    "name": "Thalia Neromanto",
    "type": "suporte",
    "rarity": "purple",
    "portrait": "eldoria-purple-36"
  },
  {
    "key": "eldoria_gold_37",
    "faction": "Coroa de Eldoria",
    "motto": "A luz nos une",
    "aura": "aura-eldoria-37",
    "name": "Aurelion Auriforte",
    "type": "infantaria",
    "rarity": "gold",
    "portrait": "eldoria-gold-37"
  },
  {
    "key": "eldoria_gold_38",
    "faction": "Templo Radiante",
    "motto": "O sol pertence a todos",
    "aura": "aura-eldoria-38",
    "name": "Zerya Coroasolar",
    "type": "suporte",
    "rarity": "gold",
    "portrait": "eldoria-gold-38"
  },
  {
    "key": "eldoria_gold_39",
    "faction": "Trono Astral",
    "motto": "Meu aço é promessa",
    "aura": "aura-eldoria-39",
    "name": "Vhaldrin Espadaestelar",
    "type": "infantaria",
    "rarity": "gold",
    "portrait": "eldoria-gold-39"
  },
  {
    "key": "eldoria_gold_40",
    "faction": "Jardim Celeste",
    "motto": "Todo horizonte chama",
    "aura": "aura-eldoria-40",
    "name": "Iskaria Alvorada",
    "type": "arqueiro",
    "rarity": "gold",
    "portrait": "eldoria-gold-40"
  },
  {
    "key": "eldoria_gold_41",
    "faction": "Estepes Reais",
    "motto": "A honra guia",
    "aura": "aura-eldoria-41",
    "name": "Tyren Valcar",
    "type": "cavalaria",
    "rarity": "gold",
    "portrait": "eldoria-gold-41"
  },
  {
    "key": "eldoria_gold_42",
    "faction": "Ninho das Chamas",
    "motto": "Renascer é vencer",
    "aura": "aura-eldoria-42",
    "name": "Maeritha Fênixmar",
    "type": "suporte",
    "rarity": "gold",
    "portrait": "eldoria-gold-42"
  },
  {
    "key": "eldoria_gold_43",
    "faction": "Salões Radiantes",
    "motto": "Vigio o infinito",
    "aura": "aura-eldoria-43",
    "name": "Caldor Lendaurora",
    "type": "infantaria",
    "rarity": "gold",
    "portrait": "eldoria-gold-43"
  },
  {
    "key": "eldoria_gold_44",
    "faction": "Observatório Solar",
    "motto": "A visão é eterna",
    "aura": "aura-eldoria-44",
    "name": "Lysandra Coronalume",
    "type": "arqueiro",
    "rarity": "gold",
    "portrait": "eldoria-gold-44"
  },
  {
    "key": "eldoria_gold_45",
    "faction": "Céu das Torres",
    "motto": "O trovão é justiça",
    "aura": "aura-eldoria-45",
    "name": "Fenrion Tormenta",
    "type": "cavalaria",
    "rarity": "gold",
    "portrait": "eldoria-gold-45"
  },
  {
    "key": "eldoria_gold_46",
    "faction": "Palácio dos Ventos",
    "motto": "Nenhuma estrela cai",
    "aura": "aura-eldoria-46",
    "name": "Orarya Tronoalto",
    "type": "suporte",
    "rarity": "gold",
    "portrait": "eldoria-gold-46"
  },
  {
    "key": "eldoria_gold_47",
    "faction": "Jardins Eternos",
    "motto": "Florescemos em guerra",
    "aura": "aura-eldoria-47",
    "name": "Saryndra Infinitaflor",
    "type": "suporte",
    "rarity": "gold",
    "portrait": "eldoria-gold-47"
  }
]);
const HERO_METADATA=Object.freeze([
  {
    "key": "eldoria_white_01",
    "name": "Brann Corvapedra",
    "title": "Escudo de Vento",
    "rarity": "white",
    "type": "infantaria",
    "portrait": "eldoria-white-01",
    "stats": {
      "hp": 775,
      "attack": 127,
      "defense": 158,
      "speed": 37
    },
    "skill": "Dom de Guarda de Corvos",
    "skillDesc": "Comando de infantaria na defesa de Guarda de Corvos",
    "skillPower": 1.42
  },
  {
    "key": "eldoria_white_02",
    "name": "Ina Rosaforte",
    "title": "Lança da Colina",
    "rarity": "white",
    "type": "cavalaria",
    "portrait": "eldoria-white-02",
    "stats": {
      "hp": 780,
      "attack": 179,
      "defense": 121,
      "speed": 58
    },
    "skill": "Dom de Campos Rosados",
    "skillDesc": "Comando de cavalaria na defesa de Campos Rosados",
    "skillPower": 1.54
  },
  {
    "key": "eldoria_white_03",
    "name": "Taren Bosquedouro",
    "title": "Vigia da Fronteira",
    "rarity": "white",
    "type": "arqueiro",
    "portrait": "eldoria-white-03",
    "stats": {
      "hp": 705,
      "attack": 221,
      "defense": 104,
      "speed": 51
    },
    "skill": "Dom de Mata do Ouro",
    "skillDesc": "Comando de arqueiro na defesa de Mata do Ouro",
    "skillPower": 1.66
  },
  {
    "key": "eldoria_white_04",
    "name": "Milla Valtim",
    "title": "Tecelã de Curativos",
    "rarity": "white",
    "type": "suporte",
    "portrait": "eldoria-white-04",
    "stats": {
      "hp": 890,
      "attack": 133,
      "defense": 120,
      "speed": 45
    },
    "skill": "Dom de Vale do Cedro",
    "skillDesc": "Comando de suporte na defesa de Vale do Cedro",
    "skillPower": 1.78
  },
  {
    "key": "eldoria_white_05",
    "name": "Orin Pedrafria",
    "title": "Escudeiro das Rochas",
    "rarity": "white",
    "type": "infantaria",
    "portrait": "eldoria-white-05",
    "stats": {
      "hp": 710,
      "attack": 175,
      "defense": 158,
      "speed": 41
    },
    "skill": "Dom de Círculo de Gelo",
    "skillDesc": "Comando de infantaria na defesa de Círculo de Gelo",
    "skillPower": 1.9
  },
  {
    "key": "eldoria_white_06",
    "name": "Sela Campolume",
    "title": "Cavaleira das Campinas",
    "rarity": "white",
    "type": "cavalaria",
    "portrait": "eldoria-white-06",
    "stats": {
      "hp": 715,
      "attack": 227,
      "defense": 121,
      "speed": 56
    },
    "skill": "Dom de Planícies Claras",
    "skillDesc": "Comando de cavalaria na defesa de Planícies Claras",
    "skillPower": 1.3
  },
  {
    "key": "eldoria_white_07",
    "name": "Fenric Arcoledo",
    "title": "Arco do Poente",
    "rarity": "white",
    "type": "arqueiro",
    "portrait": "eldoria-white-07",
    "stats": {
      "hp": 640,
      "attack": 185,
      "defense": 104,
      "speed": 49
    },
    "skill": "Dom de Torres do Poente",
    "skillDesc": "Comando de arqueiro na defesa de Torres do Poente",
    "skillPower": 1.42
  },
  {
    "key": "eldoria_white_08",
    "name": "Nara Ambravia",
    "title": "Guardião do Bálsamo",
    "rarity": "white",
    "type": "suporte",
    "portrait": "eldoria-white-08",
    "stats": {
      "hp": 825,
      "attack": 97,
      "defense": 120,
      "speed": 43
    },
    "skill": "Dom de Círculo Âmbar",
    "skillDesc": "Comando de suporte na defesa de Círculo Âmbar",
    "skillPower": 1.54
  },
  {
    "key": "eldoria_white_09",
    "name": "Alden Ponteluz",
    "title": "Defensor da Ponte",
    "rarity": "white",
    "type": "infantaria",
    "portrait": "eldoria-white-09",
    "stats": {
      "hp": 970,
      "attack": 139,
      "defense": 158,
      "speed": 39
    },
    "skill": "Dom de Ponte da Aurora",
    "skillDesc": "Comando de infantaria na defesa de Ponte da Aurora",
    "skillPower": 1.66
  },
  {
    "key": "eldoria_white_10",
    "name": "Tessa Grangarda",
    "title": "Lança da Guarda",
    "rarity": "white",
    "type": "cavalaria",
    "portrait": "eldoria-white-10",
    "stats": {
      "hp": 650,
      "attack": 191,
      "defense": 121,
      "speed": 60
    },
    "skill": "Dom de Forte do Trigo",
    "skillDesc": "Comando de cavalaria na defesa de Forte do Trigo",
    "skillPower": 1.78
  },
  {
    "key": "eldoria_white_11",
    "name": "Rurik Vinhamar",
    "title": "Sentinela do Vinhedo",
    "rarity": "white",
    "type": "infantaria",
    "portrait": "eldoria-white-11",
    "stats": {
      "hp": 775,
      "attack": 163,
      "defense": 194,
      "speed": 41
    },
    "skill": "Dom de Montes Vinhedos",
    "skillDesc": "Comando de infantaria na defesa de Montes Vinhedos",
    "skillPower": 1.9
  },
  {
    "key": "eldoria_white_12",
    "name": "Elin Corvassol",
    "title": "Arqueira do Sol Baixo",
    "rarity": "white",
    "type": "arqueiro",
    "portrait": "eldoria-white-12",
    "stats": {
      "hp": 640,
      "attack": 245,
      "defense": 50,
      "speed": 48
    },
    "skill": "Dom de Bosque dos Corvos",
    "skillDesc": "Comando de arqueiro na defesa de Bosque dos Corvos",
    "skillPower": 1.3
  },
  {
    "key": "eldoria_white_13",
    "name": "Ciro Palhaforte",
    "title": "Escudo da Colheita",
    "rarity": "white",
    "type": "infantaria",
    "portrait": "eldoria-white-13",
    "stats": {
      "hp": 905,
      "attack": 187,
      "defense": 158,
      "speed": 37
    },
    "skill": "Dom de Campos da Colheita",
    "skillDesc": "Comando de infantaria na defesa de Campos da Colheita",
    "skillPower": 1.42
  },
  {
    "key": "eldoria_white_14",
    "name": "Vina Cristalina",
    "title": "Voz das Fontes",
    "rarity": "white",
    "type": "suporte",
    "portrait": "eldoria-white-14",
    "stats": {
      "hp": 890,
      "attack": 85,
      "defense": 156,
      "speed": 43
    },
    "skill": "Dom de Fontes do Cristal",
    "skillDesc": "Comando de suporte na defesa de Fontes do Cristal",
    "skillPower": 1.54
  },
  {
    "key": "eldoria_blue_15",
    "name": "Ivar Ferronévoa",
    "title": "Capitão do Norte",
    "rarity": "blue",
    "type": "infantaria",
    "portrait": "eldoria-blue-15",
    "stats": {
      "hp": 1720,
      "attack": 267,
      "defense": 319,
      "speed": 48
    },
    "skill": "Dom de Muralha Boreal",
    "skillDesc": "Comando de infantaria na defesa de Muralha Boreal",
    "skillPower": 2.66
  },
  {
    "key": "eldoria_blue_16",
    "name": "Lyss Tecevento",
    "title": "Mestra das Brisas",
    "rarity": "blue",
    "type": "arqueiro",
    "portrait": "eldoria-blue-16",
    "stats": {
      "hp": 1585,
      "attack": 349,
      "defense": 175,
      "speed": 61
    },
    "skill": "Dom de Torre do Vento",
    "skillDesc": "Comando de arqueiro na defesa de Torre do Vento",
    "skillPower": 2.78
  },
  {
    "key": "eldoria_blue_17",
    "name": "Corvin Lumealto",
    "title": "Cavaleiro da Baliza",
    "rarity": "blue",
    "type": "cavalaria",
    "portrait": "eldoria-blue-17",
    "stats": {
      "hp": 1790,
      "attack": 331,
      "defense": 228,
      "speed": 70
    },
    "skill": "Dom de Faróis Altos",
    "skillDesc": "Comando de cavalaria na defesa de Faróis Altos",
    "skillPower": 2.9
  },
  {
    "key": "eldoria_blue_18",
    "name": "Adria Talhapedra",
    "title": "Forjadora de Escudos",
    "rarity": "blue",
    "type": "infantaria",
    "portrait": "eldoria-blue-18",
    "stats": {
      "hp": 1915,
      "attack": 303,
      "defense": 301,
      "speed": 45
    },
    "skill": "Dom de Forjas de Arven",
    "skillDesc": "Comando de infantaria na defesa de Forjas de Arven",
    "skillPower": 2.3
  },
  {
    "key": "eldoria_blue_19",
    "name": "Beren Escamaluz",
    "title": "Lança da Montanha",
    "rarity": "blue",
    "type": "cavalaria",
    "portrait": "eldoria-blue-19",
    "stats": {
      "hp": 1920,
      "attack": 355,
      "defense": 264,
      "speed": 66
    },
    "skill": "Dom de Cordilheira Vhal",
    "skillDesc": "Comando de cavalaria na defesa de Cordilheira Vhal",
    "skillPower": 2.42
  },
  {
    "key": "eldoria_blue_20",
    "name": "Veyla Marebrava",
    "title": "Vigia das Ondas",
    "rarity": "blue",
    "type": "arqueiro",
    "portrait": "eldoria-blue-20",
    "stats": {
      "hp": 1520,
      "attack": 397,
      "defense": 175,
      "speed": 59
    },
    "skill": "Dom de Costa das Âncoras",
    "skillDesc": "Comando de arqueiro na defesa de Costa das Âncoras",
    "skillPower": 2.54
  },
  {
    "key": "eldoria_blue_21",
    "name": "Garric Ventroura",
    "title": "Guarda da Rota",
    "rarity": "blue",
    "type": "infantaria",
    "portrait": "eldoria-blue-21",
    "stats": {
      "hp": 1785,
      "attack": 255,
      "defense": 283,
      "speed": 48
    },
    "skill": "Dom de Estradas Rubras",
    "skillDesc": "Comando de infantaria na defesa de Estradas Rubras",
    "skillPower": 2.66
  },
  {
    "key": "eldoria_blue_22",
    "name": "Isen Roscaelo",
    "title": "Maga das Estepes",
    "rarity": "blue",
    "type": "suporte",
    "portrait": "eldoria-blue-22",
    "stats": {
      "hp": 1770,
      "attack": 237,
      "defense": 281,
      "speed": 54
    },
    "skill": "Dom de Prado Estelar",
    "skillDesc": "Comando de suporte na defesa de Prado Estelar",
    "skillPower": 2.78
  },
  {
    "key": "eldoria_blue_23",
    "name": "Selene Cinderval",
    "title": "Curandeira do Vento",
    "rarity": "blue",
    "type": "suporte",
    "portrait": "eldoria-blue-23",
    "stats": {
      "hp": 1835,
      "attack": 249,
      "defense": 299,
      "speed": 55
    },
    "skill": "Dom de Jardins Cinzentos",
    "skillDesc": "Comando de suporte na defesa de Jardins Cinzentos",
    "skillPower": 2.9
  },
  {
    "key": "eldoria_blue_24",
    "name": "Tork Brumamar",
    "title": "Saqueador Convertido",
    "rarity": "blue",
    "type": "cavalaria",
    "portrait": "eldoria-blue-24",
    "stats": {
      "hp": 1920,
      "attack": 331,
      "defense": 210,
      "speed": 65
    },
    "skill": "Dom de Mar da Bruma",
    "skillDesc": "Comando de cavalaria na defesa de Mar da Bruma",
    "skillPower": 2.3
  },
  {
    "key": "eldoria_blue_25",
    "name": "Naia Cristalflo",
    "title": "Arqueira das Águas",
    "rarity": "blue",
    "type": "arqueiro",
    "portrait": "eldoria-blue-25",
    "stats": {
      "hp": 1520,
      "attack": 373,
      "defense": 193,
      "speed": 58
    },
    "skill": "Dom de Rio das Safiras",
    "skillDesc": "Comando de arqueiro na defesa de Rio das Safiras",
    "skillPower": 2.42
  },
  {
    "key": "eldoria_blue_26",
    "name": "Aeron Falcorruna",
    "title": "Vigia dos Glifos",
    "rarity": "blue",
    "type": "arqueiro",
    "portrait": "eldoria-blue-26",
    "stats": {
      "hp": 1585,
      "attack": 385,
      "defense": 211,
      "speed": 59
    },
    "skill": "Dom de Mirante das Runas",
    "skillDesc": "Comando de arqueiro na defesa de Mirante das Runas",
    "skillPower": 2.54
  },
  {
    "key": "eldoria_blue_27",
    "name": "Livra Vesper",
    "title": "Sacerdotisa do Eclipse",
    "rarity": "blue",
    "type": "suporte",
    "portrait": "eldoria-blue-27",
    "stats": {
      "hp": 1770,
      "attack": 297,
      "defense": 299,
      "speed": 53
    },
    "skill": "Dom de Santuário Vesper",
    "skillDesc": "Comando de suporte na defesa de Santuário Vesper",
    "skillPower": 2.66
  },
  {
    "key": "eldoria_purple_28",
    "name": "Eldrin Setearcos",
    "title": "Comandante dos Sete Arcos",
    "rarity": "purple",
    "type": "arqueiro",
    "portrait": "eldoria-purple-28",
    "stats": {
      "hp": 4355,
      "attack": 785,
      "defense": 545,
      "speed": 71
    },
    "skill": "Dom de Fortaleza Alada",
    "skillDesc": "Comando de arqueiro na defesa de Fortaleza Alada",
    "skillPower": 4.98
  },
  {
    "key": "eldoria_purple_29",
    "name": "Aelira Valnox",
    "title": "Sentinela das Estrelas",
    "rarity": "purple",
    "type": "suporte",
    "portrait": "eldoria-purple-29",
    "stats": {
      "hp": 4540,
      "attack": 697,
      "defense": 633,
      "speed": 65
    },
    "skill": "Dom de Vale Celeste",
    "skillDesc": "Comando de suporte na defesa de Vale Celeste",
    "skillPower": 5.1
  },
  {
    "key": "eldoria_purple_30",
    "name": "Vardek Solferro",
    "title": "Senhor das Forjas",
    "rarity": "purple",
    "type": "infantaria",
    "portrait": "eldoria-purple-30",
    "stats": {
      "hp": 4360,
      "attack": 739,
      "defense": 671,
      "speed": 55
    },
    "skill": "Dom de Coração da Montanha",
    "skillDesc": "Comando de infantaria na defesa de Coração da Montanha",
    "skillPower": 4.5
  },
  {
    "key": "eldoria_purple_31",
    "name": "Sylena Dragonave",
    "title": "Dama das Asas",
    "rarity": "purple",
    "type": "cavalaria",
    "portrait": "eldoria-purple-31",
    "stats": {
      "hp": 4365,
      "attack": 791,
      "defense": 634,
      "speed": 76
    },
    "skill": "Dom de Escarpas dos Dragões",
    "skillDesc": "Comando de cavalaria na defesa de Escarpas dos Dragões",
    "skillPower": 4.62
  },
  {
    "key": "eldoria_purple_32",
    "name": "Draven Corsal",
    "title": "Guardião das Marés",
    "rarity": "purple",
    "type": "infantaria",
    "portrait": "eldoria-purple-32",
    "stats": {
      "hp": 4490,
      "attack": 763,
      "defense": 635,
      "speed": 57
    },
    "skill": "Dom de Trono do Estuário",
    "skillDesc": "Comando de infantaria na defesa de Trono do Estuário",
    "skillPower": 4.74
  },
  {
    "key": "eldoria_purple_33",
    "name": "Miren Aureliar",
    "title": "Voz das Runas",
    "rarity": "purple",
    "type": "suporte",
    "portrait": "eldoria-purple-33",
    "stats": {
      "hp": 4475,
      "attack": 745,
      "defense": 633,
      "speed": 63
    },
    "skill": "Dom de Biblioteca da Aurora",
    "skillDesc": "Comando de suporte na defesa de Biblioteca da Aurora",
    "skillPower": 4.86
  },
  {
    "key": "eldoria_purple_34",
    "name": "Keldra Pratocéu",
    "title": "Arqueira do Firmamento",
    "rarity": "purple",
    "type": "arqueiro",
    "portrait": "eldoria-purple-34",
    "stats": {
      "hp": 4420,
      "attack": 857,
      "defense": 581,
      "speed": 71
    },
    "skill": "Dom de Patrulha Celeste",
    "skillDesc": "Comando de arqueiro na defesa de Patrulha Celeste",
    "skillPower": 4.98
  },
  {
    "key": "eldoria_purple_35",
    "name": "Eryon Coraçãoruna",
    "title": "Custódio do Selo",
    "rarity": "purple",
    "type": "infantaria",
    "portrait": "eldoria-purple-35",
    "stats": {
      "hp": 4360,
      "attack": 715,
      "defense": 689,
      "speed": 60
    },
    "skill": "Dom de Portões Rúnicos",
    "skillDesc": "Comando de infantaria na defesa de Portões Rúnicos",
    "skillPower": 5.1
  },
  {
    "key": "eldoria_purple_36",
    "name": "Thalia Neromanto",
    "title": "Guardião das Fontes",
    "rarity": "purple",
    "type": "suporte",
    "portrait": "eldoria-purple-36",
    "stats": {
      "hp": 4345,
      "attack": 697,
      "defense": 615,
      "speed": 60
    },
    "skill": "Dom de Fonte da Montanha",
    "skillDesc": "Comando de suporte na defesa de Fonte da Montanha",
    "skillPower": 4.5
  },
  {
    "key": "eldoria_gold_37",
    "name": "Aurelion Auriforte",
    "title": "Rei da Primeira Aurora",
    "rarity": "gold",
    "type": "infantaria",
    "portrait": "eldoria-gold-37",
    "stats": {
      "hp": 7490,
      "attack": 1199,
      "defense": 1043,
      "speed": 71
    },
    "skill": "Dom de Coroa de Eldoria",
    "skillDesc": "Comando de infantaria na defesa de Coroa de Eldoria",
    "skillPower": 6.12
  },
  {
    "key": "eldoria_gold_38",
    "name": "Zerya Coroasolar",
    "title": "Imperatriz da Alvorada",
    "rarity": "gold",
    "type": "suporte",
    "portrait": "eldoria-gold-38",
    "stats": {
      "hp": 7475,
      "attack": 1181,
      "defense": 1041,
      "speed": 77
    },
    "skill": "Dom de Templo Radiante",
    "skillDesc": "Comando de suporte na defesa de Templo Radiante",
    "skillPower": 6.24
  },
  {
    "key": "eldoria_gold_39",
    "name": "Vhaldrin Espadaestelar",
    "title": "General das Estrelas",
    "rarity": "gold",
    "type": "infantaria",
    "portrait": "eldoria-gold-39",
    "stats": {
      "hp": 7620,
      "attack": 1223,
      "defense": 1079,
      "speed": 73
    },
    "skill": "Dom de Trono Astral",
    "skillDesc": "Comando de infantaria na defesa de Trono Astral",
    "skillPower": 6.36
  },
  {
    "key": "eldoria_gold_40",
    "name": "Iskaria Alvorada",
    "title": "Senhora dos Mil Ventos",
    "rarity": "gold",
    "type": "arqueiro",
    "portrait": "eldoria-gold-40",
    "stats": {
      "hp": 7160,
      "attack": 1305,
      "defense": 935,
      "speed": 86
    },
    "skill": "Dom de Jardim Celeste",
    "skillDesc": "Comando de arqueiro na defesa de Jardim Celeste",
    "skillPower": 6.48
  },
  {
    "key": "eldoria_gold_41",
    "name": "Tyren Valcar",
    "title": "Cavaleiro da Coroa",
    "rarity": "gold",
    "type": "cavalaria",
    "portrait": "eldoria-gold-41",
    "stats": {
      "hp": 7365,
      "attack": 1287,
      "defense": 988,
      "speed": 95
    },
    "skill": "Dom de Estepes Reais",
    "skillDesc": "Comando de cavalaria na defesa de Estepes Reais",
    "skillPower": 6.6
  },
  {
    "key": "eldoria_gold_42",
    "name": "Maeritha Fênixmar",
    "title": "Guardião da Fênix",
    "rarity": "gold",
    "type": "suporte",
    "portrait": "eldoria-gold-42",
    "stats": {
      "hp": 7410,
      "attack": 1145,
      "defense": 1041,
      "speed": 75
    },
    "skill": "Dom de Ninho das Chamas",
    "skillDesc": "Comando de suporte na defesa de Ninho das Chamas",
    "skillPower": 6
  },
  {
    "key": "eldoria_gold_43",
    "name": "Caldor Lendaurora",
    "title": "Mestre das Lâminas",
    "rarity": "gold",
    "type": "infantaria",
    "portrait": "eldoria-gold-43",
    "stats": {
      "hp": 7555,
      "attack": 1187,
      "defense": 1079,
      "speed": 71
    },
    "skill": "Dom de Salões Radiantes",
    "skillDesc": "Comando de infantaria na defesa de Salões Radiantes",
    "skillPower": 6.12
  },
  {
    "key": "eldoria_gold_44",
    "name": "Lysandra Coronalume",
    "title": "Vigia do Sol Duplo",
    "rarity": "gold",
    "type": "arqueiro",
    "portrait": "eldoria-gold-44",
    "stats": {
      "hp": 7420,
      "attack": 1269,
      "defense": 935,
      "speed": 84
    },
    "skill": "Dom de Observatório Solar",
    "skillDesc": "Comando de arqueiro na defesa de Observatório Solar",
    "skillPower": 6.24
  },
  {
    "key": "eldoria_gold_45",
    "name": "Fenrion Tormenta",
    "title": "Lança da Tempestade",
    "rarity": "gold",
    "type": "cavalaria",
    "portrait": "eldoria-gold-45",
    "stats": {
      "hp": 7300,
      "attack": 1251,
      "defense": 988,
      "speed": 93
    },
    "skill": "Dom de Céu das Torres",
    "skillDesc": "Comando de cavalaria na defesa de Céu das Torres",
    "skillPower": 6.36
  },
  {
    "key": "eldoria_gold_46",
    "name": "Orarya Tronoalto",
    "title": "Protetora do Firmamento",
    "rarity": "gold",
    "type": "suporte",
    "portrait": "eldoria-gold-46",
    "stats": {
      "hp": 7345,
      "attack": 1193,
      "defense": 1041,
      "speed": 79
    },
    "skill": "Dom de Palácio dos Ventos",
    "skillDesc": "Comando de suporte na defesa de Palácio dos Ventos",
    "skillPower": 6.48
  },
  {
    "key": "eldoria_gold_47",
    "name": "Saryndra Infinitaflor",
    "title": "Dama da Rosa Dourada",
    "rarity": "gold",
    "type": "suporte",
    "portrait": "eldoria-gold-47",
    "stats": {
      "hp": 7410,
      "attack": 1205,
      "defense": 1059,
      "speed": 80
    },
    "skill": "Dom de Jardins Eternos",
    "skillDesc": "Comando de suporte na defesa de Jardins Eternos",
    "skillPower": 6.6
  }
]);
export const EXPANSION_HERO_TEMPLATES=Object.freeze(Object.fromEntries(HERO_METADATA.map(({key,...rest})=>[key,Object.freeze(rest)])));
export const EXPANSION_HERO_IDENTITIES=Object.freeze(Object.fromEntries(EXPANSION_DATA.map(hero=>[hero.key,Object.freeze({
 faction:hero.faction,
 aura:hero.aura,
 aura_label:"Insígnia de "+hero.name,
 lore:hero.name+" protege "+hero.faction+" e conduz os "+({infantaria:"defensores",arqueiro:"batedores",cavalaria:"cavaleiros",suporte:"aliados"}[hero.type])+" do reino de Eldoria.",
 motto:hero.motto
})])));
export const EXPANSION_HERO_PORTRAITS=Object.freeze(EXPANSION_DATA.map(hero=>hero.portrait));
