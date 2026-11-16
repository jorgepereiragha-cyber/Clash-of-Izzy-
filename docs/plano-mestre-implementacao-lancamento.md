# Plano mestre único — Clash of Izzy

Atualizado em 15/11/2026. Este é o documento normativo para consolidar todas as propostas enviadas em conversa. Ele substitui snippets isolados como instruções de implementação, mas não substitui o código, as migrações ou o histórico técnico do repositório.

## Princípio principal: uma única fonte de verdade

- O estado real é o repositório `jorgepereiragha-cyber/Clash-of-Izzy-` e as migrações D1 aplicadas.
- Uma proposta enviada pelo usuário entra como requisito e passa por comparação com o código antes de virar patch.
- Não aplicar um novo `schema.sql` sobre produção. D1 é alterado somente com nova migração numerada, compatível com os dados existentes.
- Não criar cópias de jogadores, reinos, tropas, heróis, inventário, batalhas, compras, eventos, mapa ou service worker.
- O servidor é a autoridade para economia, inventário, progressão, filas, marchas, combate, compras e recompensas.
- Nenhuma escrita real em D1 remoto, pagamento, envio de e-mail, domínio ou ação administrativa é realizada por seed/teste.

## Fontes oficiais por domínio

| Domínio | Fonte oficial | Não criar em paralelo |
|---|---|---|
| Jogador | `players` — `id` inteiro, `player_id` string, `name`, `gems` | username/email/password schema inventado |
| Reino e recursos | `kingdoms` — FK para `players.id`; food, wood, stone, iron, gold, power, protection | segunda tabela de reino/saldo |
| Edifícios | `kingdom_buildings` | `buildings` ligada ao player |
| Tropas | `army_units` — kingdom_id, unit_type, tier, quantity, wounded | `armies.troop_data` JSON duplicado |
| Heróis | `heroes` + `hero_inventory` | nova tabela de heróis com identidade duplicada |
| Equipamentos | `kingdom_equipment` + `hero_equipment` | `hero_items` alternativo |
| Pesquisa | `research` | uma nova árvore de pesquisa paralela |
| Alianças | `alliances`, `alliance_members`, `alliance_invites`, `alliance_chat`, `alliance_wars`, `alliance_war_battles` | guildas/membros com IDs concorrentes |
| Territórios | `world_territories` — coordenadas x/z, terrain e owner_kingdom_id | `map_x/map_y` em kingdoms |
| Marchas | `marches` — target_territory_id, units_json, started_at, arrives_at, resolution_token | nova tabela marches com start_x/start_y inexistentes |
| Batalhas | `battle_reports` | tabela `battles` duplicada |
| Economia auditável | `resource_ledger` | saldo paralelo sem trilha |
| Anjo da Morte | `world_events`, `world_event_participants`, `world_event_attacks`, `world_event_rewards` | `world_boss_event`, `boss_attacks`, `player_boss_energy` |
| Compras | `vip_packages`, `skins`, `purchase_requests`, `player_skins`, `players.gems` | `gem_packages`, `transactions`, `purchase_history` |
| PWA e cidade 3D | `manifest.json`, `sw.js`, `offline.html`, `navigation.js`, `scripts/kingdom-3d.js`, `world-map-3d.js` | outro renderer, mapa ou service worker |

## Estado consolidado: implementado, parcial e pendente

### Reino e dados
- **Implementado:** Cloudflare Worker + D1, migrações versionadas 0001–0016, reinos, economia, construções fixas, tropas em linhas normalizadas, heróis, equipamentos, pesquisa, inventário, filas persistentes e ledger.
- **Parcial:** edifícios centrais mantêm posições estruturais; sistema de decoração livre ainda precisa de catálogo, colocação, edição, colisão e persistência por reino.
- **Regra da decoração:** futura tabela de instâncias deve referenciar `kingdoms.id`, coordenadas de grid inteiras e rotação normalizada; o catálogo controla dimensão, asset, custo e nível. Validação de colisão e débito condicional ocorrem no Worker. Integrar na cena Three.js existente, sem um segundo renderer. Ainda não declarar a Etapa 1 completa.

### Mapa 3D
- **Implementado:** mapa estratégico Three.js, territórios, pan/zoom, cena isométrica e representações de marchas com timestamps para interpolação no cliente.
- **Parcial:** a sincronização visual usa os dados reais retornados pelo Worker, mas não existe stream SSE/WebSocket de presença/marchas em tempo real nem feed global de deltas.
- **Regra:** usar `world_territories.x/z` e `marches.started_at/arrives_at/target_territory_id/units_json`. Não introduzir endpoint que leia colunas inexistentes. Durable Objects + WebSockets são opção para coordenação em tempo real futura; D1 permanece fonte durável.
- **Sem promessa de desempenho:** 60 FPS, 99% menos requisições e 10 mil jogadores concorrentes exigem benchmark em dispositivos e testes de carga.

### Anjo da Morte
- **Implementado:** evento semanal persistente no D1, calendário de sexta-feira 18:00 até segunda-feira 00:00 em `America/Sao_Paulo`, HP base de 12 bilhões, ataques, perdas próprias do evento, pontuação/ranking e recompensas com proteção de unicidade.
- **Parcial:** a fórmula atual de score não equivale ao ranking relativo (% de dano sobre poder do reino) da proposta mais recente. Runas diárias 10/10 não devem ser adicionadas por tabela paralela; precisam ser desenhadas sobre a participação já existente, com reset por data e consumo atômico.
- **Regra:** request_id idempotente por evento/reino; atualizar HP global, registrar ataque, consumir recurso diário e atualizar ranking de forma consistente. Não usar `Promise.all` para escritas que precisam ser atômicas. Recompensas devem ter marcação `paid_at` e crédito exatamente uma vez. A fila Cloudflare só será adotada se o binding e o consumidor forem realmente configurados e testados.

### Combate PvP
- **Implementado:** simulação PvE autoritativa, tokens para concorrência, relatórios persistentes, bônus de pesquisa/equipamento/herói e resolução de marchas contra territórios neutros.
- **Não implementado:** ataques entre dois reinos, defesa de cidade, perdas permanentes de tropas em PvP, loot de recursos entre jogadores, reforços/rally, escudos anti-PvP e relatórios de batalha entre reinos.
- **Regra:** não copiar a fórmula proposta de `militia/longbow/knight` como catálogo novo; ela não corresponde às unidades reais do Worker. Antes de ativar PvP, modelar estados de tropas enviadas/retorno, proteção, alvo, terreno `world_territories.terrain`, herói ativo, muralha, reforços, idempotência e compensação de falhas. Relatório em `battle_reports`; mudanças de recursos com ledger e lote D1. A interface é apenas cliente de intenção.

### Loja e Mercado Pago
- **Implementado:** catálogo existente `vip_packages`/ `skins`, pedidos em `purchase_requests`, chave de idempotência e aprovação manual pelo painel Master. Novos pedidos usam link do Mercado Pago.
- **Ainda não implementado:** preferência dinâmica por pacote, webhook assinado validado ponta a ponta e entrega automática de gemas.
- **Proposta de 3 pacotes:** pode ser considerada para atualizar `vip_packages` atual, não criar `gem_packages`. Primeiro definir preços e gemas oficiais no catálogo já existente.
- **Não ativar 300% de primeira compra sem decisão econômica explícita e controle antifraude.** Metadata do navegador/checkout nunca é autoridade para quantia de gemas. O valor vem do produto imutável capturado no pedido no servidor e a notificação precisa de assinatura verificada + ID de pagamento único + operação atômica. Não declarar webhook seguro enquanto não existir e passar testes reais.

### PWA
- **Existente na base:** `manifest.json`, ícones SVG 192/512, modo standalone, `sw.js`, cache do shell, página `offline.html`, registro do Service Worker e cache de arquivos estáticos.
- **Mudança proposta nesta branch:** instalar via botão compartilhado quando o navegador emitir `beforeinstallprompt`; aviso offline; atalhos reais para Reino, Mapa e Eventos; cache versionado v14. A instalação continua dependendo do suporte do navegador e da escolha do usuário.
- **API:** `/api/*` permanece network-only. Nunca servir resposta privada de reino, token, compra ou combate a partir de cache offline.
- **Push:** não existe ainda subscription VAPID, armazenamento por identidade, endpoint autenticado ou envio de push no Worker. Não chamar notificações push de ativas e não pedir permissão automaticamente. Implementar só após configurar chaves, consentimento explícito, validação de endpoint, remoção de subscriptions expiradas e limites de envio.
- **Offline:** oferece somente shell/UI de contingência; ações do jogo exigem servidor. Não sincronizar mutações em background sem protocolo de conflito/idempotência.
- **iOS:** instalação é guiada pelo navegador/compartilhar; o evento `beforeinstallprompt` não existe em todos os navegadores.

## Ambiente de teste e seed

O seed oficial desta entrega fica em `scripts/seed-local.sql` e usa somente os nomes reais do schema. Ele cria 10 jogadores marcados `TESTE`, reinos, edifícios, tropas válidas, heróis que existem no catálogo, nicknames, alianças, territórios, marchas concluídas e relatórios fictícios.

Comandos seguros:
```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm test
npm run check
npm run assets:validate
npm run dev
```

**Nunca executar esse seed no banco remoto/produção.** Não são contas de login reais e não simulam pagamentos. O seed não cria histórico de compra, crédito de gemas de pagamento ou evento Anjo da Morte ativo. A loja e o evento possuem dados e ciclos próprios. Não há script `db:seed:remote`.

## Testes automatizados e manuais

### O que o CI deve verificar
- Migrações D1 locais em ordem, incluindo aplicação em banco descartável.
- Testes de regras e integração Worker/D1.
- Bundle Worker `npm run check`, sintaxe do service worker e validação dos assets.
- Manifest: ícones existentes, start URL, shortcuts que apontam para telas reais.
- Service worker: API fora do cache, shell e offline fallback presentes, arquivos de precache existentes.
- Seed: apenas schema oficial, sem tabelas duplicadas, compras falsas ou alterações no saldo de produção.
- Smoke test pós-deploy: apenas GET/read-only; nunca criar jogadores, compras ou alterar o banco de produção.

### Dispositivos físicos ainda precisam de execução humana
Matriz sugerida: Samsung Galaxy A14 ou equivalente de entrada; aparelho Android intermediário atual; Android de alta capacidade; iPhone compacto e padrão; iPad/tablet; Chrome Desktop. Registrar modelo exato, sistema, navegador, conexão, qualidade do jogo e versão/commit.

Em cada aparelho: instalar PWA, reabrir, navegar entre Reino/Mapa/Eventos, perder e restaurar rede, conferir cache/offline, rolar e tocar controles, abrir loja sem pagar, observar memória/aquecimento e capturar falhas. Em Android de entrada, medir frame time e estabilidade sem exigir 60 FPS como promessa. Testar pagamentos só em sandbox e sem creditar contas reais.

### Lighthouse / qualidade
- Medir separadamente `/`, `/kingdom.html`, `/world.html`, `/events.html` e `/alliance.html`.
- Executar em mobile emulação e desktop, registrar versão do Lighthouse, URL, commit, rede e score detalhado.
- Corrigir oportunidades comprovadas: LCP, CLS, JS, fontes, imagens, acessibilidade, contraste e navegação por teclado.
- Não usar comandos de compressão que sobrescrevem GLB original sem cópia e comparação visual. Compressão Draco/KTX2 exige compatibilidade do loader e validação no celular.
- Não definir score >90 como concluído sem relatório real. A meta é alvo, não medição existente.

## Analytics e privacidade

A proposta de gravar player_id, sessão, timestamp de cada ação e dados de batalha em uma tabela de eventos não será copiada diretamente. Antes de analytics persistente é necessário definir finalidade, consentimento quando aplicável, minimização, retenção, anonimização e controle de acesso. Para o alpha, começar com métricas operacionais agregadas e eventos essenciais sem payload livre, sem tokens, IP bruto, e-mail ou dados de conta. Métricas de compra só vêm de pagamento confirmado pelo backend. Não adicionar um endpoint de tracking aberto a spam.

KPIs sugeridos para acompanhar, não metas prometidas: jogadores ativos diários/semanais, retenção D1/D7/D30 por coorte, duração da sessão, falhas por versão/dispositivo, frame time, criação de reino, conclusão de fila, participação em evento e taxa de erro da loja. Usar grupos agregados e volume mínimo para reduzir identificação.

## Lançamento alpha — critérios e plano

Não executar campanha, convites ou anúncios automaticamente. Preparação recomendada:
1. **Alpha fechado pequeno:** grupo convidado e suporte/feedback; limitar entrada até comprovar estabilidade, moderação e recuperação de dados.
2. **Correções:** corrigir problemas que afetam login, perda de progresso, economia, pagamentos, combate e segurança antes de ampliar.
3. **Alpha aberto:** ampliar de forma gradual com monitoramento, limites operacionais e rollback.
4. **Beta:** só após dados de retenção, performance e integridade, mais termos/privacidade/suporte e política de monetização aprovados.

### Gates antes de aceitar jogadores externos
- Login e sessão, proteção contra abuso e recuperação de conta testados.
- Nenhuma perda/dobra de recursos em testes concorrentes; migração e backup/restore ensaiados.
- Pagamento real desativado até assinatura, idempotência e reconciliação do Mercado Pago validadas.
- PvP entre reinos não anunciado até implementação ponta a ponta; o escopo PvE atual deve ser descrito corretamente.
- Evento e recompensas validados com contas de teste e ciclo de reset.
- PWA instalado em Android real; comportamento iOS documentado.
- Teste de carga progressivo antes de divulgar capacidade simultânea.
- Domínio customizado só é configurado quando controle DNS e conta Cloudflare forem confirmados.
- Política de privacidade, termos, moderação, suporte, custos e canais de reporte publicados.

## Decisões pendentes para futuras propostas

| Tema | Decisão já tomada | Próxima alteração legítima |
|---|---|---|
| Decorações | Sistema híbrido; edifícios âncora + decorações livres | migração incremental + Worker + UI na cena de cidade |
| Ranking Anjo da Morte | preservar tabela/ataques/recompensas atuais | validar score relativo, runas e reset atômico |
| PvP | não habilitar com o protótipo enviado | contrato de batalha entre reinos e transações |
| Loja | catálogo `vip_packages` atual e aprovação Master | atualizar catálogo existente e implantar webhook real |
| Push | não ativo | VAPID, subscriptions, endpoint autenticado e consentimento |
| Analytics | não persistir eventos individuais ainda | política de privacidade e métricas agregadas |
| Lançamento | sem data/capacidade declarada | fechar gates com evidência de teste |

**Regra para todas as próximas entregas:** antes de editar, ler schema, rotas, testes e migrações existentes; antes de publicar, executar CI e revisar diff; antes de declarar sucesso, obter resultado do teste correspondente.
