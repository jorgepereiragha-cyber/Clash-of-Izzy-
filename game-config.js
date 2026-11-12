// Configuração de combate e construções do Clash of Izzy.
// Adaptado do protótipo Python para o cliente Web (Three.js).
export const GAME_SCREEN = Object.freeze({ width:1200, height:800, fps:60 });
export const GAME_GRID = Object.freeze({ cols:24, rows:16, cellSize:40 });

export const BUILDING_DEFS = Object.freeze({
  town_hall:{name:"Castelo de Eldoria",width:3,height:3,hp:1000,color:0xb48250,cost:{wood:0,stone:0},buildTime:0},
  gold_mine:{name:"Mina de ouro",width:2,height:2,hp:300,color:0xffd700,cost:{wood:50,stone:0},buildTime:5,produces:"gold",productionRate:10,productionInterval:3},
  elixir_collector:{name:"Coletor de elixir",width:2,height:2,hp:300,color:0xc800ff,cost:{wood:50,stone:0},buildTime:5,produces:"elixir",productionRate:10,productionInterval:3},
  cannon:{name:"Canhão",width:2,height:2,hp:500,color:0x787878,cost:{wood:100,stone:50},buildTime:8,damage:25,range:5,attackSpeed:1},
  wall:{name:"Muralha",width:1,height:1,hp:400,color:0x503c28,cost:{wood:20,stone:0},buildTime:2}
});
export const UNIT_DEFS = Object.freeze({
  barbarian:{name:"Bárbaro",hp:100,damage:15,attackSpeed:1,speed:2,range:1,color:0xff6432,cost:{elixir:25},size:1},
  archer:{name:"Arqueiro",hp:60,damage:12,attackSpeed:1.2,speed:2.5,range:3,color:0x32c832,cost:{elixir:40},size:1}
});
export const GAME_COLORS = Object.freeze({
  background:0x1e1e23,gridLine:0x323237,gold:0xffd700,elixir:0xc800ff,
  hpBarBackground:0x3c0000,hpBarForeground:0x00c800,hpBarDamage:0xc80000,
  uiPanel:0x282832,uiButton:0x3c3c50,uiButtonHover:0x505064,
  text:0xdcdcdc,white:0xffffff,black:0x000000
});
