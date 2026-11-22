# Master Blueprint — reconciliacao segura antes do lancamento (2026-11-22)

## Contexto e limites
Esta branch e empilhada sobre a PR #233, que depende da #229, que depende da #223. **Nao fazer merge/deploy de producao enquanto as PRs de origem estiverem Draft ou sem homologacao final.** Nenhuma credencial, migracao remota, preco ou pedido historico foi alterado nesta branch.

## Polimento visual incorporado
- `scripts/castle-visual-upgrades.js` adiciona trono decorativo a partir do nivel 20, asas de baixa geometria a partir do nivel 25 e realces dourados a partir do nivel 30.
- Ornamentos pertencem a um grupo proprio, sem clonar nem modificar as texturas, as skins adquiridas e os materiais compartilhados de castelos/GLBs.
- `clearCastleVisualUpgrades` libera geometrias e materiais **apenas do grupo adicionado**, mesmo quando o motor troca os modelos. Fallback WebGL existente continua valido.
- O nivel e obtido do edifício do castelo do estado real, nao de `state.player.vip_level` (coluna inexistente no contrato 4X); VIP legado e independente, faixa 1–7.
- O **Trono Imperial no mapa mundial com escudo de 35 dias** ja esta em `throne-war.js`, `world-map-3d.js` e na migracao 0035. O trono decorativo sobre o castelo NAO modifica a guerra no mapa, o tempo de protecao ou regras de alianças.
- Os ornamentos sao puramente visuais, sem buff, privilegio ou nova entrega comercial; manter controle de performance no APK Android fisico.

## PWA
- `sw.js` existe na raiz do repositorio (nao `public/sw.js`); cache v53. O novo modulo grafico esta na lista de recursos.
- Manter **cache.addAll atomico para a shell**. Falha de asset essencial impede instalar a nova versao, preservando a versao ativa anterior. Substituir por `Promise.allSettled` incondicional permitiria ativar um shell parcialmente quebrado.
- Se o navegador ja esta offline e nenhuma pagina esta em cache, a navegacao recebe HTML de emergencia com HTTP 503, em vez de uma resposta `undefined` que falha em `respondWith`.
- Recurso estatico offline sem cache recebe erro de rede, NAO HTML servido como JavaScript/GLB.
- Nunca cachear APIs, autenticacao, respostas privadas, URLs com query, pagamentos ou dados do D1.
- O shell offline nao representa jogo sincronizado: login, combate, saldo e pagamento continuam exigindo rede.

## Herois / progressao
- NAO substituir `hero-assignments-4x.js` pelo snippet do Blueprint: tabela `heroes` usa `kingdom_id` e `hero_key` e a alocacao escreve `assigned_to` sob validacao no servidor.
- Os buffs existentes em `millHeroMultiplier` e `towerHeroMultiplier` limitam a producao em 15% e a defesa em 20%. Nao criar segundo caminho de creditos/buffs.

## Catalogo e pagamentos
- NAO criar `0043_fix_vip_catalog.sql` com `INSERT OR REPLACE`: pode apagar/recriar IDs legados e violar integridade referencial; `vip_packages` nao possui `wood,food,stone,iron,gold,required_level`.
- `0042` usa `INSERT OR IGNORE`; revisar a correspondencia exata `vip_packages(name,price_brl,gems)` versus `level-packs.js` no D1 Preview antes da liberacao.
- Precos diferentes P4–P8 enviados no Blueprint nao estao aprovados no codigo e nao devem entrar em producao por migracao automatica. Qualquer revisao exige nova aprovacao comercial, tests de contrato, anuncios atualizados e conciliacao de pedidos pendentes.
- `mercadopago-orders.js` ja usa assinatura HMAC, consulta ao provedor, `D1.batch` e `level_pack_claims`. Nunca realizar UPDATE simples sem a condicao idempotente de `changes()`.
- `GAME_4X_SYSTEMS_ENABLED` e **global**, nao suporta ativacao apenas para admin. As flags dos pacotes permitem allowlist `LEVEL_PACKS_TEST_PLAYER_IDS`, mas nao representam allowlist de todos os sistemas 4X.

## Gates
1. CI no SHA exato, tests Node, smoke de cache, bundle do Worker e APK de teste.
2. D1 Preview remoto com 0042, verificação de catalogo e ID de reino, concorrencia/replay do webhook.
3. Mercado Pago Sandbox **real** com chaves guardadas fora do repositorio, pagamentos pendentes, aprovados, recusados e disputas.
4. Android **fisico**, FPS/draw calls, queda de WebGL, retorno de background e funcionamento em rede fraca.
5. Backup D1 producao e **teste de restauracao em banco separado**; migrar producao so apos os gates, mantendo flags desligadas.
6. Revisar/mergear na ordem #223 -> #229 -> #233 -> esta PR, respeitando novos SHAs e CI; monitorar canary antes de abrir ao publico.

Documentos de referencia: `docs/LEVEL_PACKS_P1_P8_RELEASE.md`, `docs/4X_PREFLIGHT_PRODUCAO.md`, `docs/GUERRA_DO_TRONO_35_DIAS.md` e issue #234.
