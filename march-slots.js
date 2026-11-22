// Limite autoritativo de filas de marcha. Independente da capacidade de tropas.
function level(value,min,max){
 const x=Number(value);
 return Number.isSafeInteger(x)?Math.max(min,Math.min(max,x)):min;
}
export function marchSlots({castleLevel=1,militaryLevel=0,active=0}={}){
 const castle=level(castleLevel,1,30);
 const research=level(militaryLevel,0,30);
 const current=level(active,0,1000000000);
 const max=Math.min(5,1+(castle>=5?1:0)+(castle>=15?1:0)+(research>=5?1:0)+(research>=15?1:0));
 return {max,active:current,available:Math.max(0,max-current)};
}
