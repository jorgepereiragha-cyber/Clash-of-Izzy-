# Clash of Izzy — padrão profissional de estratégia, inspirado nas mecânicas de CoK
Revisão de engenharia: 22 de novembro de 2026.

**Não copiar marcas, arte, mapas, textos protegidos, código-fonte ou bases de dados do Clash of Kings.** A meta é oferecer uma experiência de estratégia medieval-fantástica comparável, com identidades, progressão, UI e conteúdo próprios.

## 1. Catálogo e regras existentes no projeto
| Sistema | Existe no código | Status comercial verificado |
|---|---|---|
| Castelo e prédios até nível 30 | Sim: `kingdoms`, `kingdom_buildings`, produção e filas | Requer migrações D1 e smoke Android |
| Treino e pesquisa militar | Sim: `army_units`, `kingdom_queues`, `research` | Não confirmado em produção |
| Heróis e equipamentos | Sim: 70 retratos, catálogo e `hero_inventory` | Não confirmado em produção |
| Dragões | Sim: nove catálogos e propriedade | Não confirmado em produção |
| Marchas e coleta no mapa | Sim: `marches` e `world_territories` | Não confirmado em produção |
| Nós de recursos, rally de aliança | Sim: `resource_nodes`, `rallies`, `rally_reinforcements` | Não confirmado em produção |
| Eventos PvE/boss | Sim: Anjo da Morte, Valhalla/Caçada Selvagem | Não equivale a monstros caminhando no mapa |
| Reinos 1/2/3 | Sim: migração 0034, abertura em 700/1.000 reinos | Ainda depende do deploy |
| Guerra do Trono | Sim: migração 0035 e escudo 35 dias por mundo | Ainda depende do deploy |
| Mercado Pago e Pix Nubank | Código de pedidos e conciliação | Configuração de produção ausente na última auditoria |
| APK Android / distribuição | Workflows e portal público | APK estável ainda não confirmado em Releases |

## 2. Capacidade de marcha — nova padronização
- Fórmula de base do Clash of Izzy: `400 + 2.000 × nível do castelo + 200 × nível da academia`.
- Multiplicador de percentual: `1 + (1,5 × nível de pesquisa militar + bônus do herói) / 100`.
- Bônus do herói escolhido automaticamente do elenco do reino: branco = 0%, azul = 4%, roxo = 8%, dourado = 14%, além de `0,15 × nível` e `1 × estrelas`, quando o herói existir.
- Capacidade final é limitada a 200.000 soldados por marcha; nível de castelo 1 sem bonificações permite 2.400.
- Os números são **parâmetros próprios do Clash of Izzy**, não alegados como fórmulas oficiais do CoK.
- Valor calculado no Worker, nunca pelo navegador; aplica-se a marchas normais, rallys, ocupações de recursos e assalto ao Trono. A UI mostra usado/total.
- O limite total do quartel continua diferente do limite por expedição. Não aumentar o exército treinável apenas porque um comandante possui herói lendário.

## 3. Regras operacionais existentes e salvaguardas
**Marcha:** selecionar alvo válido no mesmo mapa, tropas disponíveis, tipo de ação `gather/scout/attack` e tempo de chegada calculado pelo servidor; debitar unidades em transação D1 com bloqueio de falta de tropas. Marchas comuns não podem atacar Trono ou castelo se o PvP de castelo ainda estiver bloqueado.

**Aliança:** rally exige filiação, tropas reais, nó neutro livre, reserva e debito atômico; a quantidade enviada por cada comandante obedece à sua própria capacidade. Cooldown e concorrência devem ser cobertos por testes de duas requisições simultâneas. Um rally não representa automaticamente batalha PvP de aliança.

**Recursos:** fazendas, serrarias, pedreiras e minas do castelo; nós externos do mapa; avanço de produção e coleta calculados pelo Worker. Verificar regeneração, ocupação exclusiva, impossibilidade de recurso negativo, antiduplo-recebimento e devolução das tropas.

**Monstros:** Boss Anjo da Morte e Caçada Selvagem têm implementação separada. **Monstros neutros permanentes no mapa**, com níveis, resistência, energia para atacar, tempo de reaparecimento e recompensas auditadas, ainda precisam ser implementados e homologados antes de serem anunciados como ativos.

**Trono:** trono central de cada mundo protegido por 35 dias a partir de seu desbloqueio. A referência atualizada do CoK (setembro de 2026) descreve Preparação, Disputa e Recuperação e conquista em 2h30 de ocupação contínua, incorporada nesta revisão do Clash of Izzy. Os demais valores de fase, prêmios e requisitos são parâmetros próprios e precisam de balanceamento/QA.

## 4. Matriz de qualidade antes de anunciar o jogo
1. **Tropas e marcha:** testar T1–T10, cada classe, formação de 1 / máximo / máximo +1, recrutamento concorrente, recuperação de marchas, velocidade, perdas e relato da batalha. Validar atributos de herói + equipamentos no servidor, com limites de bônus.
2. **Coleta:** testar níveis e tipos de recurso, esgotamento do nó, regeneração, prevenção de duas ocupações, quantidade transportada, retorno de tropas, armazenamento e idempotência.
3. **Monstros:** diferenciar bosses de eventos de monstros no mapa; quando implementados, testar custo de energia, dificuldade por nível, cooldown, recompensa única e reset do spawn.
4. **Aliança e PvP:** testes de 1 a N participantes, capacidade individual, poder combinado, bloqueio entre mapas, invasão e trono.
5. **Economia:** preços em centavos, aprovação real do pagamento, assinatura de webhook, idempotência, reembolsos e limites diários; não entregar gemas por screenshot.
6. **Performance Android e Cloudflare:** teste real em aparelhos modestos, FPS/latência com 100, 300, 700 e 1.000 clientes simulados, monitorar limites pagos e custo. Três mapas lógicos não são três servidores físicos.
7. **Produção:** CI da `main`, backup D1 Time Travel, migrations até 0035, `/api/health` HTTP 200, catálogo e meios de pagamento prontos, OAuth Google, release Android assinada, SHA-256 e portal com download testado.

## 5. Fontes oficiais das mecânicas de referência
- App Store (CoK): https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Galaxy Store (CoK): https://galaxystore.samsung.com/detail/com.hcg.cok.samsung.global?langCd=en

**Critério de pronto:** testes e implementação local não equivalem a ativação comercial. O checklist de lançamento com evidências está em `docs/PLANO_MESTRE_VISUAL_E_ATIVACAO.md`.
