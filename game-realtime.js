// Hub de tempo real por região usando Durable Objects e WebSocket Hibernation.
// O Worker autenticado é o único gateway: ele valida tickets e assina publicações.
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
function positiveIds(values){
  return [...new Set((Array.isArray(values)?values:[])
    .map(value=>Number(value))
    .filter(value=>Number.isSafeInteger(value)&&value>0))];
}
export class GameRealtimeHub {
  constructor(state,env){
    this.state=state;
    this.env=env;
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/connect"){
      if(request.method!=="GET"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket"){
        return json({error:"Upgrade WebSocket obrigatório."},426);
      }
      if(!this.env.SESSION_SECRET||request.headers.get("X-Realtime-Gateway")!==this.env.SESSION_SECRET){
        return json({error:"Gateway de tempo real inválido."},403);
      }
      const playerId=String(request.headers.get("X-Realtime-Player")||"");
      const kingdomId=Number(request.headers.get("X-Realtime-Kingdom"));
      const region=Number(request.headers.get("X-Realtime-Region"));
      if(!playerId||!Number.isSafeInteger(kingdomId)||kingdomId<1||!Number.isSafeInteger(region)||region<1){
        return json({error:"Identidade de conexão inválida."},401);
      }
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.state.acceptWebSocket(server);
      server.serializeAttachment({playerId,kingdomId,region,connectedAt:Date.now()});
      return new Response(null,{status:101,webSocket:client});
    }
    if(url.pathname==="/publish"){
      if(request.method!=="POST")return json({error:"Método não permitido."},405);
      if(!this.env.SESSION_SECRET||request.headers.get("X-Realtime-Gateway")!==this.env.SESSION_SECRET){
        return json({error:"Gateway de publicação inválido."},403);
      }
      let payload;
      try{payload=await request.json();}catch{return json({error:"Evento inválido."},400);}
      const kingdomIds=positiveIds(payload?.kingdomIds);
      if(!kingdomIds.length)return json({error:"Nenhum reino destinatário informado."},400);
      const message=JSON.stringify({
        type:"state_changed",
        kingdomIds,
        reason:String(payload?.reason||"gameplay_update").slice(0,64),
        at:Date.now()
      });
      const targets=new Set(kingdomIds);
      let sent=0,closed=0;
      for(const socket of this.state.getWebSockets()){
        let attachment;
        try{attachment=socket.deserializeAttachment();}catch{attachment=null;}
        if(!attachment||!targets.has(Number(attachment.kingdomId)))continue;
        try{
          if(socket.readyState===WebSocket.OPEN){socket.send(message);sent++;}
        }catch{
          try{socket.close(1011,"Falha ao enviar atualização.");}catch{}
          closed++;
        }
      }
      return json({success:true,sent,closed});
    }
    return json({error:"Rota do hub não encontrada."},404);
  }
  webSocketMessage(socket,message){
    // Clientes só podem enviar heartbeat; comandos de jogo continuam no Worker autenticado.
    if(message==="ping"){
      try{socket.send("pong");}catch{}
      return;
    }
    try{socket.close(1008,"Use as rotas autenticadas do jogo para enviar ações.");}catch{}
  }
  webSocketClose(socket,code,reason){
    try{socket.close(code,reason);}catch{}
  }
}
