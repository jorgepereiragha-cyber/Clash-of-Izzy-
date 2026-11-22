// Paid gems only. Each tier can be bought at most once per rolling 24-hour period,
// counting settled (approved) orders per authenticated player.
export const DAILY_PACKAGES = Object.freeze([
  Object.freeze({name:"Pacote Inicial de Eldoria",priceBRL:3.99,gems:35}),
  Object.freeze({name:"Pacote Diário de Eldoria",priceBRL:9.99,gems:100}),
  Object.freeze({name:"Pacote Premium Diário de Eldoria",priceBRL:49.99,gems:600})
]);
const names = new Set(DAILY_PACKAGES.map(item => item.name));
export const DAILY_PACKAGE_COOLDOWN_HOURS = 24;
export function isDailyPackage(name){return typeof name==="string" && names.has(name);}
