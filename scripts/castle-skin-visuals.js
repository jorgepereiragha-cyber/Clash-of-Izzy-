export const castleSkinPalettes = Object.freeze({
    1:Object.freeze({wall:"#c7a86f",roof:"#9b6627",stone:"#ead5a3",accent:"#f1d078",banner:"#8d401f",seal:"#f6dc92"}),
    2:Object.freeze({wall:"#d2d0c5",roof:"#264d77",stone:"#f1ead4",accent:"#e4bd68",banner:"#17385f",seal:"#dcecf5"}),
    3:Object.freeze({wall:"#887767",roof:"#5a3828",stone:"#b69b75",accent:"#c6a15d",banner:"#5a2724",seal:"#d8b776"}),
    4:Object.freeze({wall:"#aaa2c8",roof:"#5a4b8c",stone:"#d8cbed",accent:"#e2caef",banner:"#342d6f",seal:"#e8d7f4"}),
    5:Object.freeze({wall:"#9fb8ca",roof:"#3e6b91",stone:"#d9e8ee",accent:"#c2e1ec",banner:"#264869",seal:"#edf8ff"}),
    6:Object.freeze({wall:"#d29b65",roof:"#9e3d27",stone:"#f2c68a",accent:"#f5cf63",banner:"#7c241f",seal:"#ffe3a1"})
});

export function castleCityArtId(skinId) {
  const id = Number(skinId);
  return Object.hasOwn(castleSkinPalettes, id) ? "castle-" + id : "castle";
}
