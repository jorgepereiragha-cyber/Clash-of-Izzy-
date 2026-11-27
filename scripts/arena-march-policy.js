// Mirror the current server's non-PvP world march eligibility for the arena.
// The server remains authoritative; this function does not authorize an order.
export function arenaMarchAvailability(territory,kingdomId){
 const disabled={attack:false,gather:false,scout:false};
 if(!territory||territory.territory_kind==="castle"||territory.territory_kind==="throne"||
    String(territory.territory_key||"").startsWith("royal_throne_"))return disabled;
 const neutral=!territory.owner_kingdom_id;
 const own=Boolean(kingdomId)&&Number(territory.owner_kingdom_id)===Number(kingdomId);
 return {attack:neutral,gather:(neutral||own)&&["food","wood","stone","iron"].includes(territory.resource_type),scout:neutral||own};
}
