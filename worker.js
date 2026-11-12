const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
const BUILDINGS = {
  castle:{label:"Castelo",wood:300,stone:200,food:0,iron:0},
  barracks:{label:"Quartel",wood:180,stone:90,food:0,iron:0},
  farm:{label:"Fazenda",wood:120,stone:50,food:0,iron:0},
  quarry:{label:"Pedreira",wood:150,stone:60,food:0,iron:0},
  lumber_mill:{label:"Serraria",wood:150,stone:60,food:0,iron:0},
  iron_mine:{label:"Mina de ferro",wood:180,stone:100,food:0,iron:0},
  market:{label:"Mercado",wood:160,stone:80,food:0,iron:0},
  academy:{label:"Academia",wood:220,stone:160,food:0,iron:0},
  wall:{label:"Muralha",wood:250,stone:250,food:0,iron:0},
  hospital:{label:"Hospital",wood:200,stone:120,food:0,iron:0},
  watchtower:{label:"Torre de vigia",wood:180,stone:140,food:0,iron:0},
  stable:{label:"Estábulo",wood:220,stone:130,food:0,iron:0},
  archery_range:{label:"Campo de arqueiros",wood:190,stone:110,food:0,iron:0},
  siege_workshop:{label:"Oficina de cerco",wood:300,stone:220,food:0,iron:20},
  embassy:{label:"Embaixada",wood:220,stone:180,food:0,iron:0},
  warehouse:{label:"Armazém",wood:170,stone:100,food:0,iron:0}
};
const UNITS = {
  militia:{label:"Milícia",food:12,wood:2,iron:0,power:2},
  swordsman:{label:"Espadachim",food:22,wood:4,iron:3,power:5},
  spearman:{label:"Lanceiro",food:18,wood:5,iron:2,power:4},
  archer:{label:"Arqueiro",food:20,wood:7,iron:1,power:5},
  cavalry:{label:"Cavalaria",food:35,wood:8,iron:8,power:9},
  knight:{label:"Cavaleiro",food:50,wood:10,iron:15,power:14},
  crossbowman:{label:"Besteiro",food:28,wood:9,iron:5,power:7},
  catapult:{label:"Catapulta",food:70,wood:45,iron:20,power:22},
  ram:{label:"Aríete",food:60,wood:55,iron:18,power:20},
  trebuchet:{label:"Trabuco",food:90,wood:75,iron:30,power:30}
};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors}})}
function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function sign(payload,secret){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const body=b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));
  return body+"."+b64url(sig);
}
async function verify(token,secret){
  try{
    const [body,signature]=token.split(".");
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const bytes=Uint8Array.from(atob(signature.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(body)))return false;
    const payload=JSON.parse(atob(body.replace(/-/g,"+").replace(/_/g,"/")));
    return payload.exp>Math.floor(Date.now()/1000)?payload:false;
  }catch{return false}
}
async function readBody(request){try{return await request.json()}catch{return {}}}
async function gameIdentity(request,env){
  const header=request.headers.get("Authorization")||"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  const p=env.SESSION_SECRET?await verify(token,env.SESSION_SECRET):false;
  return p&&p.scope==="game"&&p.sub?String(p.sub):null;
}
async function ensureKingdom(env,playerId){
  let p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  if(!p){
    await env.DB.prepare("INSERT OR IGNORE INTO players(player_id,name,gems) VALUES(?,?,?)").bind(playerId,"Lorde de Eldoria",50).run();
    p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  }
  let k=await env.DB.prepare("SELECT id FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!k){
    const created=await env.DB.prepare("INSERT INTO kingdoms(player_id,kingdom_name,food,wood,stone,iron,gold,last_production_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(p.id,"Reino de Eldoria",5000,5000,3000,1000,1000,new Date().toISOString()).run();
    const id=created.meta.last_row_id;
    const buildingRows=Object.keys(BUILDINGS).map((key,i)=>env.DB.prepare("INSERT OR IGNORE INTO kingdom_buildings(kingdom_id,building_type,level,position_x,position_z) VALUES(?,?,1,?,?)").bind(id,key,((i%4)-1.5)*7,Math.floor(i/4)*7-7));
    const unitRows=Object.keys(UNITS).map((key)=>env.DB.prepare("INSERT OR IGNORE INTO army_units(kingdom_id,unit_type,tier,quantity) VALUES(?,?,1,?)").bind(id,key,key==="militia"?30:0));
    await env.DB.batch([
      ...buildingRows,...unitRows,
      env.DB.prepare("INSERT OR IGNORE INTO heroes(kingdom_id,hero_key,hero_name,rarity) VALUES(?,?,?,?)").bind(id,"kael_sunwarden","Kael, Guardião do Sol","rare"),
      env.DB.prepare("INSERT OR IGNORE INTO dragons(kingdom_id,dragon_key,dragon_name) VALUES(?,?,?)").bind(id,"ember_wyrm","Brasa")
    ]);
    k={id};
  }
  return k.id;
}
async function applyProduction(env,kingdomId){
  const row=await env.DB.prepare("SELECT * FROM kingdoms WHERE id=?").bind(kingdomId).first();
  if(!row)return;
  const now=Date.now(),last=Date.parse(row.last_production_at||row.updated_at||new Date(now).toISOString());
  const elapsed=Math.max(0,Math.min(7*24*3600,Math.floor((now-(Number.isFinite(last)?last:now))/1000)));
  if(elapsed<1)return;
  const b=await env.DB.prepare("SELECT building_type,level FROM kingdom_buildings WHERE kingdom_id=?").bind(kingdomId).all();
  const levels=Object.fromEntries((b.results||[]).map(x=>[x.building_type,x.level]));
  const perHour={
    wood:8*(levels.lumber_mill||1),
    stone:6*(levels.quarry||1),
    food:12*(levels.farm||1),
    iron:2*(levels.iron_mine||1),
    gold:1.5*(levels.market||1)
  };
  const gains=Object.fromEntries(Object.entries(perHour).map(([key,rate])=>[key,Math.floor(rate*elapsed/3600)]));
  await env.DB.batch([
    env.DB.prepare("UPDATE kingdoms SET food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,gold=gold+?,last_production_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(gains.food,gains.wood,gains.stone,gains.iron,gains.gold,new Date(now).toISOString(),kingdomId),
    ...Object.entries(gains).filter(([,amount])=>amount>0).map(([resource,amount])=>env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) VALUES(?,?,?,?)").bind(kingdomId,resource,amount,"produção automática"))
  ]);
}
async function gameState(env,playerId){
  const p=await env.DB.prepare("SELECT id,player_id,name,gems FROM players WHERE player_id=?").bind(playerId).first();
  if(!p)return null;
  const kingdom=await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!kingdom)return null;
  await applyProduction(env,kingdom.id);
  const [fresh,buildings,troops,heroes,dragon,research]=await Promise.all([
    env.DB.prepare("SELECT * FROM kingdoms WHERE id=?").bind(kingdom.id).first(),
    env.DB.prepare("SELECT building_type,level,position_x,position_z FROM kingdom_buildings WHERE kingdom_id=? ORDER BY id").bind(kingdom.id).all(),
    env.DB.prepare("SELECT unit_type,tier,quantity,wounded FROM army_units WHERE kingdom_id=? ORDER BY tier,unit_type").bind(kingdom.id).all(),
    env.DB.prepare("SELECT hero_key,hero_name,level,experience,rarity,assigned_to FROM heroes WHERE kingdom_id=?").bind(kingdom.id).all(),
    env.DB.prepare("SELECT dragon_key,dragon_name,level,experience,bond FROM dragons WHERE kingdom_id=?").bind(kingdom.id).first(),
    env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=?").bind(kingdom.id).all()
  ]);
  const totalTroops=(troops.results||[]).reduce((n,u)=>n+u.quantity,0);
  return {player:{player_id:p.player_id,name:p.name,gems:p.gems},kingdom:fresh,buildings:buildings.results||[],troops:troops.results||[],heroes:heroes.results||[],dragon,research:research.results||[],totalTroops};
}
async function gameAction(env,playerId,body){
  const p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  if(!p)return json({error:"Jogador não encontrado."},404);
  const k=await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!k)return json({error:"Reino não encontrado."},404);
  await applyProduction(env,k.id);
  const type=String(body.type||"");
  if(type==="upgrade"){
    const key=String(body.building||"");
    if(!BUILDINGS[key])return json({error:"Edifício inválido."},400);
    const b=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type=?").bind(k.id,key).first();
    if(!b)return json({error:"Edifício não encontrado."},404);
    if(b.level>=30)return json({error:"Edifício já está no nível máximo."},409);
    if(key!=="castle"){
      const castle=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='castle'").bind(k.id).first();
      if(b.level>=castle.level)return json({error:"O nível do edifício não pode superar o castelo."},409);
    }
    const factor=b.level;
    const base=BUILDINGS[key];
    const cost={wood:Math.ceil(base.wood*factor),stone:Math.ceil(base.stone*factor),food:Math.ceil(base.food*factor),iron:Math.ceil(base.iron*factor)};
    const debit=await env.DB.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,food=food-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wood>=? AND stone>=? AND food>=? AND iron>=?")
      .bind(cost.wood,cost.stone,cost.food,cost.iron,k.id,cost.wood,cost.stone,cost.food,cost.iron).run();
    if(!debit.meta.changes)return json({error:"Recursos insuficientes para melhorar."},409);
    await env.DB.prepare("UPDATE kingdom_buildings SET level=level+1,upgraded_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND building_type=?").bind(k.id,key).run();
    await env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(k.id,"building_upgraded",JSON.stringify({building:key,level:b.level+1,cost})).run();
  }else if(type==="train"){
    const unit=String(body.unit||"militia"),quantity=Math.max(1,Math.min(100,Math.floor(Number(body.quantity)||10)));
    const spec=UNITS[unit];if(!spec)return json({error:"Tipo de tropa inválido."},400);
    const cost={food:spec.food*quantity,wood:spec.wood*quantity,iron:spec.iron*quantity};
    const debit=await env.DB.prepare("UPDATE kingdoms SET food=food-?,wood=wood-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND food>=? AND wood>=? AND iron>=?")
      .bind(cost.food,cost.wood,cost.iron,k.id,cost.food,cost.wood,cost.iron).run();
    if(!debit.meta.changes)return json({error:"Recursos insuficientes para treinar essas tropas."},409);
    await env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) VALUES(?,?,1,?) ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(k.id,unit,quantity).run();
    await env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(k.id,"troops_trained",JSON.stringify({unit,quantity,cost})).run();
  }else if(type==="research"){
    const key=String(body.research||"economy");
    const allowed={economy:{wood:250,stone:120,iron:0},military:{wood:300,stone:180,iron:40},construction:{wood:350,stone:250,iron:0},defense:{wood:220,stone:300,iron:25}};
    if(!allowed[key])return json({error:"Pesquisa inválida."},400);
    const current=await env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key=?").bind(k.id,key).first();
    const level=current?.level||0;if(level>=30)return json({error:"Pesquisa no nível máximo."},409);
    const c=allowed[key],factor=level+1,cost={wood:c.wood*factor,stone:c.stone*factor,iron:c.iron*factor};
    const debit=await env.DB.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,iron=iron-? WHERE id=? AND wood>=? AND stone>=? AND iron>=?")
      .bind(cost.wood,cost.stone,cost.iron,k.id,cost.wood,cost.stone,cost.iron).run();
    if(!debit.meta.changes)return json({error:"Recursos insuficientes para pesquisar."},409);
    await env.DB.prepare("INSERT INTO research(kingdom_id,research_key,level) VALUES(?,?,1) ON CONFLICT(kingdom_id,research_key) DO UPDATE SET level=level+1").bind(k.id,key).run();
  }else if(type==="rename"){
    const name=String(body.name||"").trim().slice(0,32);if(name.length<3)return json({error:"O nome deve ter de 3 a 32 caracteres."},400);
    await env.DB.prepare("UPDATE kingdoms SET kingdom_name=? WHERE id=?").bind(name,k.id).run();
  }else{return json({error:"Ação de jogo desconhecida."},400)}
  return json({success:true,state:await gameState(env,playerId)});
}
export default {
 async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  const url=new URL(request.url);
  if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
  if(url.pathname==="/api/admin/health"&&request.method==="GET")return json({hasDB:Boolean(env.DB),hasADMIN_EMAIL:Boolean(env.ADMIN_EMAIL),hasADMIN_PASSWORD:Boolean(env.ADMIN_PASSWORD),hasSESSION_SECRET:Boolean(env.SESSION_SECRET)});
  if(!env.DB)return json({error:"Banco D1 não vinculado ao Worker."},503);
  if(url.pathname==="/api/game/start"&&request.method==="POST"){
    if(!env.SESSION_SECRET)return json({error:"SESSION_SECRET não configurado no Worker."},503);
    try{
      const playerId="izzy_"+crypto.randomUUID().replace(/-/g,"");
      await ensureKingdom(env,playerId);
      const token=await sign({sub:playerId,scope:"game",exp:Math.floor(Date.now()/1000)+60*60*24*30},env.SESSION_SECRET);
      return json({token,state:await gameState(env,playerId)},201);
    }catch(e){return json({error:"Não foi possível fundar o reino. Aplique as migrações D1 0001, 0002 e 0003.",detail:String(e?.message||e)},503)}
  }
  const isGamePath=url.pathname.startsWith("/api/game/");
  if(isGamePath){
    const playerId=await gameIdentity(request,env);
    if(!playerId)return json({error:"Sessão do jogador inválida."},401);
    try{
      if(url.pathname==="/api/game/state"&&request.method==="GET"){
        const state=await gameState(env,playerId);return state?json({state}):json({error:"Reino não encontrado."},404);
      }
      if(url.pathname==="/api/game/action"&&request.method==="POST")return await gameAction(env,playerId,await readBody(request));
      return json({error:"Rota de jogo não encontrada."},404);
    }catch(e){return json({error:"Falha ao processar o jogo. Verifique se todas as migrações D1 foram aplicadas.",detail:String(e?.message||e)},500)}
  }
  if(request.method!=="POST")return json({error:"Método não permitido."},405);
  const body=await readBody(request);
  if(url.pathname==="/api/admin/login"){
    if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({error:"Configure ADMIN_EMAIL, ADMIN_PASSWORD e SESSION_SECRET nos segredos do Worker."},503);
    if(String(body.email||"").trim().toLowerCase()!==String(env.ADMIN_EMAIL).trim().toLowerCase()||body.password!==env.ADMIN_PASSWORD)return json({error:"E-mail ou senha incorretos."},401);
    const token=await sign({sub:"admin",scope:"admin",exp:Math.floor(Date.now()/1000)+28800},env.SESSION_SECRET);return json({token,expiresIn:28800});
  }
  const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
  const payload=env.SESSION_SECRET?await verify(token,env.SESSION_SECRET):false;
  if(!payload||payload.scope!=="admin")return json({error:"Sessão administrativa inválida ou expirada."},401);
  try{
    if(url.pathname==="/api/admin/player-search"){
      const id=String(body.playerId||"").trim();if(!id)return json({error:"Informe o ID do jogador."},400);
      const player=await env.DB.prepare("SELECT id,player_id,name,gems,created_at FROM players WHERE player_id=?").bind(id).first();
      return player?json({player}):json({error:"Jogador não encontrado no banco."},404);
    }
    if(url.pathname==="/api/admin/gems"){
      const id=String(body.playerId||"").trim(),amount=Number(body.amount);
      if(!id||!Number.isSafeInteger(amount)||amount<=0||amount>100000000)return json({error:"ID ou quantidade de gemas inválida."},400);
      const result=await env.DB.prepare("UPDATE players SET gems=gems+? WHERE player_id=?").bind(amount,id).run();
      if(!result.meta.changes)return json({error:"Jogador não encontrado."},404);
      const player=await env.DB.prepare("SELECT player_id,gems FROM players WHERE player_id=?").bind(id).first();return json({success:true,player});
    }
    if(url.pathname==="/api/admin/unlock-skin"){
      const id=String(body.playerId||"").trim(),name=String(body.skin||"").trim();if(!id||!name)return json({error:"Informe o ID do jogador e a skin."},400);
      const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(id).first();if(!player)return json({error:"Jogador não encontrado."},404);
      const skin=await env.DB.prepare("SELECT id FROM skins WHERE name=?").bind(name).first();if(!skin)return json({error:"Skin não cadastrada no catálogo."},404);
      await env.DB.prepare("INSERT OR IGNORE INTO player_skins(player_id,skin_id) VALUES(?,?)").bind(player.id,skin.id).run();return json({success:true,message:"Skin liberada para o jogador."});
    }
    if(url.pathname==="/api/admin/vip-packages"){
      const name=String(body.name||"").trim(),price=Number(body.price),gems=Number(body.gems);
      if(!name||!Number.isFinite(price)||price<=0||!Number.isSafeInteger(gems)||gems<0)return json({error:"Dados do pacote VIP inválidos."},400);
      await env.DB.prepare("INSERT INTO vip_packages(name,price_brl,gems) VALUES(?,?,?)").bind(name,price,gems).run();return json({success:true,message:"Pacote VIP cadastrado."});
    }
    if(url.pathname==="/api/admin/skins"){
      const name=String(body.name||"").trim(),price=Number(body.price);if(!name||!Number.isFinite(price)||price<50||price>1000)return json({error:"Informe nome e preço entre R$ 50 e R$ 1.000."},400);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM skins").first();if(count.total>=200)return json({error:"Limite de 200 skins atingido."},409);
      await env.DB.prepare("INSERT INTO skins(name,price_brl) VALUES(?,?)").bind(name,price).run();return json({success:true,message:"Skin cadastrada no catálogo."});
    }
    return json({error:"Rota administrativa não encontrada."},404);
  }catch(e){return json({error:"Erro interno ao processar a solicitação.",detail:String(e?.message||e)},500)}
 }
};
