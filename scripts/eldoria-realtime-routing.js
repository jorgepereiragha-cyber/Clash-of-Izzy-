// Shard routing for presence-only Durable Objects. No gameplay state is stored here.
// Eight 200-connection rooms provide a theoretical 1600-slot ceiling; not a load-test result.
export const ELDORIA_ROOM_SHARDS = 8;
const PLAYER_ID = /^izzy_[a-f0-9]{32}$/;

export function shardForPlayerId(playerId) {
  if (typeof playerId !== "string" || !PLAYER_ID.test(playerId)) {
    throw new Error("Identidade do jogador inválida para realtime.");
  }
  return parseInt(playerId.slice(-8), 16) % ELDORIA_ROOM_SHARDS;
}

export function roomNameForShard(shard) {
  if (shard === null) return "eldoria"; // Older clients remain on the original room.
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= ELDORIA_ROOM_SHARDS) {
    throw new Error("Sala realtime fora do limite.");
  }
  return "eldoria-shard-" + shard;
}

export function parseRealtimeShard(raw) {
  if (raw === null) return null;
  if (typeof raw !== "string" || !/^[0-7]$/.test(raw)) {
    throw new Error("Número de sala realtime inválido.");
  }
  return Number(raw);
}
