# Arquitetura técnica e ferramentas — Clash of Izzy

Atualizado em 15/11/2026. Este documento transforma a pesquisa técnica em decisões de engenharia para o repositório atual.

## Decisão executiva

**Não migrar o projeto inteiro de engine agora.** O repositório já possui cliente Web, Three.js na arena, Cloudflare Workers e D1. A opção de menor risco é evoluir essa base e provar primeiro uma cidade 3D integrada ao estado real do reino. Uma migração para Unity ou Unreal só deve ser aprovada após um protótipo comparativo que demonstre ganho mensurável em qualidade, desempenho, produtividade e distribuição Android.

## Ferramentas recomendadas por função

| Função | Ferramenta | Uso no projeto |
|---|---|---|
| Cliente 3D Web | Three.js | Cidade, câmera isométrica, mapa e cenas de combate |
| Modelagem 3D | Blender | Edifícios, heróis, dragões, cenário e animações |
| Intercâmbio de assets | glTF 2.0 / GLB | Formato padrão de entrega de modelos ao cliente |
| Compressão de modelos | glTF Transform e extensões Draco/Meshopt, após benchmark | Reduzir download e custo de renderização |
| Texturas | KTX2/Basis quando suportado e validado | Reduzir memória e transferência |
| Backend | Cloudflare Workers | API, autenticação, validação e regras do jogo |
| Dados persistentes | Cloudflare D1 | Reinos, inventário, progresso, marchas e histórico |
| Tempo real | Durable Objects + WebSockets | Chat, presença, salas e coordenação de eventos |
| Testes | Node.js test runner + testes de integração D1 | Regressões, regras e concorrência |
| Automação | GitHub Actions + Wrangler | Testar, validar migrações e publicar |
| Controle visual | Figma ou Penpot | Componentes, fluxos e protótipos de interface |
| Versionamento de arte | Git LFS ou armazenamento de assets apropriado | Arquivos grandes, modelos e texturas |

## Arquitetura alvo

1. **Apresentação:** HTML/CSS/JS e Three.js. A tela não decide saldo, recompensa, tempo concluído ou resultado de combate.
2. **Domínio do jogo:** módulos JavaScript sem dependência do DOM para economia, construção, treinamento, pesquisa, combate e progressão.
3. **API:** Worker autentica, valida payloads, aplica limites e encaminha operações.
4. **Persistência:** D1 guarda estado durável, transações e ledger.
5. **Coordenação em tempo real:** Durable Objects são introduzidos por domínio (por exemplo, sala de chat ou evento), não como substitutos indiscriminados do D1.
6. **Operação:** migrações versionadas, testes, observabilidade, backups/exportação e deploy controlado.

## Regras de engenharia obrigatórias

- Servidor é autoridade para recursos, inventário, equipamentos, temporizadores, marcha, combate, compras e recompensas.
- Cliente envia intenção (ex.: `upgrade_building`), nunca o saldo final nem o resultado calculado.
- Toda ação mutável deve validar autenticação, propriedade, autorização, limites, custo, pré-requisitos e idempotência.
- Ações econômicas devem registrar ledger e atualizar saldo de forma atômica.
- Operações concorrentes devem ser testadas com duas requisições simultâneas.
- Datas e durações usam relógio do servidor; cliente apenas exibe contagem regressiva.
- Eventos agendados precisam ser recuperáveis após reinício; não depender de timer em aba aberta.
- Não guardar segredos no código, no cliente ou em commits.
- Toda migração deve ser compatível com dados existentes e ter teste de aplicação local.
- Evitar dependências sem necessidade; fixar versões e revisar changelogs antes de atualizar.

## Estratégia de engine

- **Agora:** manter Three.js e provar cidade 3D Web, pois preserva o investimento atual e permite distribuição por navegador.
- **Unity:** considerar se a prioridade migrar para pipeline mobile nativo, ecossistema de plugins e ferramentas integradas justificar reescrita do cliente.
- **Unreal:** considerar apenas se a direção visual exigir recursos 3D de alto custo e houver orçamento/equipe para pipeline e otimização mobile.
- **Godot:** considerar como alternativa open-source em protótipo isolado, não como migração automática do projeto atual.

Nenhuma engine é universalmente melhor. A decisão deve ser baseada em protótipo com a mesma cena, dispositivo Android de referência, orçamento de memória, FPS, tamanho do download e tempo de desenvolvimento.

## Pipeline de assets 3D

1. Modelar no Blender usando escala, pivô e orientação padronizados.
2. Criar LODs para objetos distantes e colisores simples.
3. Aplicar materiais compartilhados e atlas de textura quando adequado.
4. Exportar GLB com nomes estáveis e animações nomeadas.
5. Validar visualmente e otimizar o arquivo.
6. Carregar com GLTFLoader; liberar geometria, materiais e texturas quando a cena for descartada.
7. Testar em Android real, não apenas no desktop.

## Plano de implementação

### P0 — segurança e integridade
- Migrar equipamentos do estado mutável no navegador para operações server-authoritative.
- Revisar CORS, autenticação, autorização e rate limiting.
- Testar idempotência e concorrência da economia.

### P1 — cidade 3D integrada
- Criar cena única com terreno, castelo, fazenda, serraria, pedreira e quartel.
- Cada objeto visual deve ser dirigido pelo registro de edifício retornado pela API.
- Upgrade concluído no servidor altera nível e aparência após atualização do estado.

### P2 — progressão e mundo
- Filas persistentes de construção, treinamento e pesquisa.
- Mapa com coordenadas, estados de território, recursos e marchas.
- Relatórios de combate reproduzíveis e auditáveis.

### P3 — tempo real e operação
- Durable Objects para chat/presença/eventos que realmente necessitam de coordenação ao vivo.
- Monitoramento de erros, métricas, alertas e procedimentos de recuperação.
- Teste de carga progressivo antes de campanhas de aquisição.

## Critérios de aceite

- Nenhum recurso ou item pode ser criado por alteração exclusiva do cliente.
- Recarregar ou trocar de dispositivo preserva o estado confirmado pelo servidor.
- Duas operações concorrentes não duplicam recompensa nem ultrapassam saldo.
- A mesma identidade visual é usada na cidade, mapa, inventário e alianças.
- Cidade 3D mantém desempenho aceitável no Android de referência e degrada qualidade de forma controlada.
- CI executa testes e dry-run antes de qualquer deploy.
