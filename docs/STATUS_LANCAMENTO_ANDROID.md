# Clash of Izzy — status de lançamento Android

## Situação operacional mais recente — 22/11/2026

A auditoria histórica de 21/11 abaixo descreve uma situação **anterior** ao deploy de produção. O estado confirmado após a atualização é:

- **Backend em produção:** ativo, com migrações D1 até `0035_throne_war.sql`, contrato `eldoria-android-v1`, esquema e sessão verificados e smoke test aprovado. [Deploy oficial #45018496723](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45018496723).
- **Recuperação:** bookmark D1 pré-migração capturado e arquivado no artifact do deploy. Não restaurar sem avaliar perda de mudanças posteriores.
- **Portal:** publicado e respondendo HTTP 200 na auditoria de 22/11.
- **Catálogo:** oito pacotes disponíveis e com preços/gemas esperados; seis skins expostas. **Pacote Master não aparece** enquanto a flag de habilitação não estiver configurada.
- **Recebimentos reais:** Mercado Pago ainda não habilitado; `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` ausentes nas configurações do Worker. Pix Nubank ainda não habilitado; `NUBANK_PIX_KEY`, `NUBANK_PIX_ENABLED` e `NUBANK_PIX_RECEIVER_VERIFIED` ausentes. Não definir flags de confirmação sem conferir titularidade, credenciais, pedidos, conciliação e reembolso.
- **Outras flags:** `MASTER_PACK_ENABLED` e `GOOGLE_WEB_CLIENT_ID` ausentes na auditoria. O backend de conta via senha permanece uma opção independente.
- **APK:** o candidato Android interno assinado passou na CI, mas **não há release comercial oficial** com APK e SHA-256 (GitHub Releases HTTP 404 na auditoria). O portal não deve prometer download comercial até existir uma release real e validada.
- **Fonte dos diagnósticos:** [auditoria automática #45018890376](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45018890376) — leitura da API pública e somente dos nomes/tipos de bindings, sem divulgar valores.
- **Limite da verificação:** API com status de habilitação não substitui teste bancário ponta a ponta; executar pedido, pagamento, confirmação oficial, entrega única e estorno antes de vender.

A relação abaixo é preservada como histórico e **não representa o estado atual do banco**.

**Auditoria: 21 de novembro de 2026 (horário de Brasília).** Os logs de CI e Cloudflare usam UTC e podem aparecer com a data 22/11/2026.

## Objetivo final

- **Site:** propaganda da marca, recursos do jogo e download de APK Android assinado, sem botão para jogar pelo navegador.
- **App:** castelo, inventário, 70 identidades de heróis (65 invocáveis + 5 sazonais), 9 dragões (3 azuis/3 roxos/3 dourados), progressão do castelo 1–30 e VIP do Castelo 1–7; mapa mundial, alianças, eventos, loja e correio.
- **Cloudflare:** servidor/D1 autoritativos, identidade de usuário, transações, combate e multiplayer.
- **Pagamentos:** Mercado Pago somente com confirmação do provedor; Nubank Pix somente com conciliação manual e flags de segurança; Pacote Master permanece desativado até validação comercial.

## Evidências

| Item | Estado verificado |
| --- | --- |
| Novo portal promocional isolado | Publicado em `clash-of-izzy-portal.jorgepereiragha.workers.dev`. A verificação HTTP encontrou 200 no site/estilos e 404 em `/kingdom.html` e `/api/health` |
| Endereço original | Foi substituída sua página inicial por propaganda e download; o backend antigo de jogo foi preservado, sem migrações D1 (Actions [#44972824508](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44972824508)) |
| Código mais recente | Integrado em `main`: catálogos, telas, regras de Eldoria, correções da navegação e raridade dourada, contrato de release Android |
| Banco D1 produção | Auditoria remota encontrou **28 linhas em `players`**, **23 reinos**, **0 contas cadastradas**, **0 pedidos** e **0 ordens Mercado Pago** |
| Migrações aplicadas | A última aplicada é `0025_kingdom_world_queues_defense_audit.sql`. Estão pendentes `0026` a `0030`; nenhuma das 3 tabelas de `0030` existe no banco remoto |
| Assinatura Workers Paid | **Não comprovada pela API**. A consulta de Billing devolveu HTTP 403, embora as leituras de Worker, D1, Time Travel e API token estivessem OK |
| APK oficial | Não há GitHub Release com APK assinado e checksum. APK debug existente é apenas para testes e não deve ser anunciado como instalador comercial |
| Acesso exclusivo pelo APK | Ainda **não garantido no servidor antigo**: caminhos de jogo continuam alcançáveis por URLs diretas. Esconder links não atesta a identidade do app |

Consultas SQL realizadas com `SELECT`, sem alteração de dados: [#44973415643](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44973415643).

## Verificações antes de publicar a versão completa do jogo

1. **Backup D1:** registrar bookmark Time Travel da produção e arquivá-lo como artifact protegido. O restauro é uma operação com perda de alterações posteriores; deve ser um plano de recuperação, não uma etapa de teste.
2. **Conservar registros legados:** não apagar os 28 jogadores ou 23 reinos apenas porque não existe conta cadastrada. Confirmar que os registros são de teste; migrations são idempotentes, mas a `0026` reposiciona castelos no mapa compartilhado.
3. **Staging:** aplicar e testar o esquema `0026`–`0030` primeiro em D1 Preview **somente se sua descartabilidade for confirmada**, com testes de integridade, combate, inventário e transações.
4. **Workers Paid e orçamento:** verificar a assinatura no Dashboard, definir alertas e limites de gastos, e conceder permissão de leitura de Billing a um token apropriado se a confirmação automática for desejada. HTTP 403 não equivale a plano gratuito, nem comprova plano pago.
5. **Deploy de produção:** usar o workflow protegido `.github/workflows/deploy-cloudflare.yml` (branch `main`, aprovações, bookmark, migrações D1 remotas e smoke test) após os pré-requisitos. Não usar o hotfix promocional como substituto desse deploy.
6. **Verificação da API:** o endpoint `/api/health` deve responder 200 com `ok=true`, `status=ready`, checks de banco/sessão/schema verdadeiros, `missingTables=[]` e `androidApiContract="eldoria-android-v1"`. O APK oficial agora exige esse contrato duas vezes no workflow de release.
7. **Assinatura APK:** configurar keystore permanente, secrets e variável `ANDROID_RELEASE_CERT_SHA256`, testar Android real, atualizações, cadastro e pagamentos em ambiente controlado; executar `.github/workflows/publicar-apk-android.yml` na `main` com confirmação explícita. Não distribuir builds debug como oficiais.
8. **Exclusividade do app:** definir atestação compatível com **APK instalado fora da Play Store**. Não considerar `User-Agent`/headers customizados como autenticação. Play Integrity pode indicar instalação não reconhecida pela Play Store; evitar bloquear usuários legítimos por isso.

## Atenção operacional

O cliente Android atual utiliza **WebView**, não renderização 3D nativa. O jogo usa assets WebGL e APIs remotas; no Android o app é a interface de execução. A publicação de um APK sem o backend atualizado resultaria em falha de funcionamento. O portal só habilita o download quando detectar uma release pública com `clash-of-izzy-android.apk` e `clash-of-izzy-android.apk.sha256`.

Nenhum dado bancário, chave Pix, segredo, token ou senha deve constar de documentação ou arquivos públicos.

**Estado do lançamento comercial:** código pronto para integração e validação; publicação integral, suporte ao cliente e transações reais **ainda não liberados**.

## Homologação do D1 Preview

A auditoria identificou somente `_cf_KV`, tabela interna reservada da Cloudflare (não pertence ao jogo). O fluxo isolado de migrações ignora apenas `_cf_KV` e `d1_migrations` vazio ao verificar se a base está pronta, mas bloqueia outros esquemas ou registros. Fonte: https://developers.cloudflare.com/d1/best-practices/import-export-data/ .
