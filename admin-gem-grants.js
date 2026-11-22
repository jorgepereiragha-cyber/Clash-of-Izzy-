// Authoritative Master-only grant implementation; caller MUST verify admin session.
const json=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export const MAX_ADMIN_GEM_GRANT=1_000_000;
export const MAX_PLAYER_GEMS=9_000_000_000_000;

export function validateAdminGemGrant(body={}){
  const playerId=String(body.playerId||"").trim();
  const amount=body.amount;
  const reason=String(body.reason||"").trim();
  const requestKey=String(body.request_key||"").trim();
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey) ||
     !/^[a-zA-Z0-9_-]{1,80}$/.test(playerId) ||
     !Number.isSafeInteger(amount) || amount<1 || amount>MAX_ADMIN_GEM_GRANT ||
     reason.length<8 || reason.length>200)
    return null;
  return {playerId,amount,reason,requestKey};
}

export async function grantAdminGems(env,body,actor){
  if(actor?.scope!=="admin"||actor?.sub!=="admin")
    return json({error:"Sessão administrativa inválida ou expirada."},401);
  if(!env?.DB) return json({error:"Banco indisponível."},503);
  const input=validateAdminGemGrant(body);
  if(!input) return json({error:"Informe playerId, quantidade inteira de 1 a 1.000.000, motivo (8–200 caracteres) e request_key válido."},400);
  const player=await env.DB.prepare("SELECT id,player_id,gems FROM players WHERE player_id=?")
    .bind(input.playerId).first();
  if(!player)return json({error:"Jogador não encontrado."},404);

  // D1.batch executa no mesmo contexto transacional: so quem grava a chave pode creditar.
  // Condicao de limite no INSERT evita ledger sem credito por extrapolacao de saldo.
  const results=await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO admin_gem_grants(request_key,player_id,amount,reason) "+
      "SELECT ?,id,?,? FROM players WHERE id=? AND gems<=?"
    ).bind(input.requestKey,input.amount,input.reason,player.id,MAX_PLAYER_GEMS-input.amount),
    env.DB.prepare(
      "UPDATE players SET gems=gems+? WHERE id=? AND changes()>0"
    ).bind(input.amount,player.id)
  ]);

  if(!results[0]?.meta?.changes){
    const previous=await env.DB.prepare(
      "SELECT player_id,amount,reason FROM admin_gem_grants WHERE request_key=?"
    ).bind(input.requestKey).first();
    if(previous &&
       Number(previous.player_id)===Number(player.id) &&
       Number(previous.amount)===input.amount &&
       previous.reason===input.reason){
      const current=await env.DB.prepare("SELECT player_id,gems FROM players WHERE id=?")
        .bind(player.id).first();
      return json({success:true,reused:true,player:current});
    }
    return json({error:previous?"Chave já vinculada a outro crédito.":"Limite de saldo atingido; nenhuma gema concedida."},409);
  }
  if(!results[1]?.meta?.changes){
    // O caso indica inconsistencia; nao repetir com outra chave ate reconciliar.
    console.error("admin_gem_ledger_without_credit");
    return json({error:"Crédito exige conciliação administrativa."},503);
  }
  const current=await env.DB.prepare("SELECT player_id,gems FROM players WHERE id=?")
    .bind(player.id).first();
  return json({success:true,reused:false,player:current});
}
