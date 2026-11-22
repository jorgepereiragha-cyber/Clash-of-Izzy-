# Clash of Izzy — Plano Mestre Visual e Checklist de Ativação Comercial
**Revisão: 22/11/2026.** Projeto Android + Cloudflare Workers/D1 + portal de download. Documento de engenharia e direção de arte, não confirmação de lançamento.

## Diagnóstico comprovado
- São 70 símbolos SVG de retrato no diretório de heróis, com identidades próprias: 65 heróis convocáveis e 5 sazonais. O catálogo também define 9 dragões (3 azuis, 3 roxos, 3 dourados).
- Há forja, equipamento persistente, progresso por raridade, relíquias com marcos de conjunto, skins de castelo, mochila, economia e reino compartilhado.
- Auditoria pública mais recente antes da atualização visual: GitHub Actions 44996440670 em 22/11/2026. Resultado: cinco pacotes VIP antigos encontrados, seis skins públicas, três novos pacotes diários ausentes do catálogo remoto, meios Mercado Pago e Nubank Pix não confirmados, API de saúde Android HTTP 503 por ausência de google_account_links e google_auth_challenges, portal HTTP 200 e ausência de APK comercial em Releases.
- O código das migrações 0031, 0032 e 0033 foi integrado ao GitHub. Integração no código não equivale a aplicação no D1 de produção; a ativação exige o workflow protegido.
- Objetivo: experiência medieval-fantástica original de qualidade, com boa leitura em celular e distribuição comercial rastreável, sem copiar arte ou propriedade intelectual de Clash of Kings.

## PARTE I — Plano Mestre de Qualidade Visual

### 1. Identidade de marca
- Azul-real e ouro envelhecido como assinatura do reino. Base de fundo #081527, painel #13273d, azul #123c7a, dourado #f1c467, texto #f8f1df e texto secundário #c3d2e3.
- Contraste de títulos e informações; nomes e títulos com estilo épico serifado, números e recursos com tipografia sans-serif e algarismos tabulares.
- Cartões com uma luz discreta, bordas metálicas, sombras leves. Evitar néon excessivo, animações contínuas em listas e gradientes que dificultem a leitura.
- Raridade sempre identificável por texto + contorno + cor. Alvos de toque com pelo menos 44 px e indicador de foco visível. Respeitar redução de movimento.

### 2. Heróis — 70 fichas de identidade
- Branco/comum: aço, couro e equipamento simples; destaque sóbrio.
- Azul/raro: heráldica azul, armas trabalhadas, aura discreta.
- Roxo/épico: armaduras especiais, entalhes e efeitos de classe; contorno violeta.
- Dourado/lendário: silhueta excepcional, ornamentos autorais, brasão, assinatura dourada. Não vender poder visual como bônus que o servidor não aplica.
- Para cada herói: preservar identificador imutável, nome, facção, retrato exclusivo, classe, arma, atributo atual, habilidade, passivos, estrelas, fragmentos e biografia.
- Projeto de arte posterior: fichas individuais com silhueta, vista frontal e traseira, armas, materiais, paleta, retrato 320x480 e miniatura otimizada. Validar 70 IDs distintos e correspondência de cada herói ao sprite canônico.
- Evitar adicionar dezenas de arquivos pesados ao carregamento inicial; priorizar visualização progressiva sem comprometer o tempo de abertura do app.

### 3. Dragões — 9 espécies
- Azuis: brasa, névoa e gelo. Roxos: tempestade, terra e sombra. Dourados: solar, astral e imperial.
- Cada dragão precisa de silhueta, cabeça, asas, postura, elemento e moldura diferenciados. Prévia deve exibir o bônus efetivo calculado pelo servidor e requisitos reais.
- Uma única criatura equipada concede bônus, conforme mecânica persistida. Os três dourados do Master não são oferta ativa quando a chave MASTER_PACK_ENABLED não está explicitamente habilitada.
- Animações e partículas somente em prévias dedicadas, com limite de custo e opção de movimento reduzido.

### 4. Skins, equipamentos e forja
- Equipamentos em cinco slots: arma, elmo, armadura, botas e acessório. Raridades comum, raro, épico e lendário com formas e etiquetas distintas.
- Cada card deve mostrar nível, atributos autoritativos, pré-requisitos, custos, estado de equipamento e feedback para erros.
- Skins de castelo devem ser reconhecíveis no mapa compartilhado; bônus limitados pelo Worker, não pelo CSS.
- Relíquias e conjuntos precisam mostrar contagem de peças, marcos de bônus e estados não adquirido / adquirido / equipado.
- Skins puramente cosméticas (como as do panteão nórdico) não devem prometer aumento de ATQ/DEF.
- Seis skins pagas iniciais podem continuar sendo oferecidas enquanto as demais são validadas. A existência de itens cadastrados não garante catálogo comercial apto.

### 5. Castelo, mundo 3D e desempenho
- Melhorar hierarquia da câmera, iluminação de área, textura dos materiais, sombras distantes e oclusão.
- Aplicar LOD/instancing e reduzir draw calls com medição real; no Android, equilibrar qualidade, memória, aquecimento e consumo de bateria.
- Metas a medir, não resultados prometidos: mínimo de 30 FPS em aparelho de entrada e alvo de 60 FPS em intermediário sob cenas representativas. Registrar hardware, condições e intervalos.
- Manter visual de alta qualidade sem introduzir uma segunda passagem WebGL apenas para brilhos de inventário.

### 6. Mercado, loja, economia e UX
- Produtos com nome legível, preço BRL, gemas e estado de entrega; não criar urgência ou “mais vendido” sem dados verdadeiros.
- Diários: R$3,99 = 35 gemas, R$9,99 = 100 gemas, R$49,99 = 600 gemas. Uma aquisição aprovada por pacote a cada 24h, conforme a regra planejada. Testar concorrência, confirmação tardia e replay de webhook.
- VIP Bronze/Prata/Ouro/Diamante/Lendário e Master devem ser separados de progressão VIP 1–7 do castelo.
- Recrutamento mostra chances reais e não inventa garantia. Ao renderizar o mercado, Roxo é Épico e Dourado é Lendário.
- Testar layouts em 360, 390, 430 e 768 px; teclado, toque, leitor de tela, estados vazios, falhas de rede e reconexão.

### 7. Alterações de código preparadas nesta etapa
- Camada CSS leve e autocontida em styles/visual-polish.css: hierarquia visual por raridade, molduras, contraste, botões, feedback de foco, cards de herói, equipamento, relíquias, skins e mercado.
- Referências de estilo adicionadas em equipment-ui.html, market.html e arena.html.
- Correção do rótulo de raridade do mercado em market.js (Roxo · Épico / Dourado · Lendário).
- Contratos testes/visual-polish.test.js para arte, nomenclatura, acessibilidade e integridade das telas.
- Não foram substituídos 70 retratos por pintura nova, introduzidas animações 3D extras ou alterados os bônus de combate; estas são entregas artísticas futuras, sujeitas a validação.

## PARTE II — Checklist Técnico de Ativação

### Gate A — preparação e teste do código
- [ ] CI completa do commit que será implantado: migrações locais, CI de gameplay/D1, validação dos recursos, Playwright, Worker dry-run.
- [ ] Confirmar que a branch de trabalho está na main e que nenhum segredo ou chave privada foi adicionado ao repositório.
- [ ] Validar Preview D1 isolado de produção e migrations até 0033.
- [ ] Confirmar plano Workers Paid e limites de gasto diretamente no Dashboard: uma resposta Billing 403 significa não verificado.
- [ ] Exigir backup/time-travel do D1 de produção e retenção do registro de restauração antes de qualquer alteração remota.

### Gate B — backend Cloudflare
- [ ] Executar exclusivamente o workflow oficial de Deploy Clash of Izzy to Cloudflare, na branch main, com confirmações verdadeiras e ambiente production aprovado.
- [ ] Pré-migração: permitir somente google_account_links e google_auth_challenges ausentes, quando D1 e SESSION_SECRET estiverem íntegros. Outros erros 503 devem barrar o deploy.
- [ ] Aplicar migrations pendentes, incluindo 0031, 0032 e 0033 quando ainda ausentes; publicar Worker e validar saúde estritamente após a publicação.
- [ ] GET /api/health: HTTP 200, status ready, checks database/session/schema verdadeiros, missingTables vazio, contrato eldoria-android-v1.
- [ ] GET /api/store/catalog: validar nomes, preços e gemas dos três diários; cinco VIP antigos; Master apenas com MASTER_PACK_ENABLED=true; limites de skins corretos.
- [ ] Provar criação de reino, reinício da sessão, inventário, equipamentos, chat, eventos e progressão sem perda de dados.

### Gate C — dinheiro e segurança
- [ ] GET /api/store/payment-methods: estados esperados para Mercado Pago e Nubank Pix. Não anunciar como habilitado o que retornar falso.
- [ ] Configurar MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET somente em segredos da plataforma. Testar assinatura de webhook, idempotência e valor em centavos.
- [ ] Verificar identificação do recebedor Pix no banco, um identificador bancário por transação e entrega só após conciliação verificável. Screenshot de transferência não autoriza entrega automática.
- [ ] Comprar produto de teste em conta de teste e conferir exatamente um crédito de gemas, inclusive com webhook duplicado e repetição de pedido.
- [ ] Testar pagamento rejeitado, estorno, concorrência de dois dispositivos, cooldown de 24h, pedido pendente e tentativa de duplicidade. Sem dados do teste, não declarar comercialização ativa.
- [ ] Validar compra Master uma só vez por reino e concessão única de recursos e dragões.
- [ ] Revisar termos, privacidade, reembolso, suporte, classificação etária e requisitos de cobrança de bens digitais.

### Gate D — Google e recuperação de conta
- [ ] Configurar Client ID tipo Web e Client ID tipo Android no Google Cloud Console, usando package com.clashofizzy.android e SHA-1 do certificado comercial.
- [ ] Definir GOOGLE_WEB_CLIENT_ID no Worker; não armazenar tokens Google no navegador ou banco.
- [ ] Testar vínculo de reino existente, recuperação em outro aparelho, colisões, nonce expirado/consumido, logout e impossibilidade de assumir reino apenas pelo e-mail.
- [ ] Manter o login alternativo funcional quando OAuth ainda não estiver configurado.

### Gate E — APK Android oficial
- [ ] Diagnóstico das credenciais de assinatura validado, keystore preservada offline e fingerprint SHA-256 confirmado.
- [ ] Testar aplicativo em pelo menos dois Android físicos: inicialização, login, reinício, batalha, inventário, câmera, reconexão e atualização.
- [ ] Incrementar versionCode preservando applicationId com.clashofizzy.android e certificado permanente. Nenhuma build debug deve ser tratada como release.
- [ ] Executar workflow Publicar APK Android oficial em main após Gates A–D. Exigir verificação do backend antes e depois, apksigner, hash e release não rascunho.
- [ ] GitHub Releases deve exibir clash-of-izzy-android.apk e clash-of-izzy-android.apk.sha256, anexados à mesma versão estável.
- [ ] Testar download e instalação de HTTPS no aparelho, conferir checksum e instalação por cima da versão anterior sem perda de dados.

### Gate F — portal, divulgação e monitoramento
- [ ] Portal https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html retorna HTTP 200, mas serve apenas marketing e download.
- [ ] O botão Baixar APK deve habilitar automaticamente somente quando o GitHub publicar uma release estável com APK e checksum verificados. Não substituir esse controle por URL inventada.
- [ ] Observar erros 5xx, latência, consumo do D1/Workers, falhas de pagamento, reconexão e métricas de FPS; testar até 1.000 jogadores simulados com limites declarados.
- [ ] Em falha, suspender novas compras/publicação antes de recuperação. Restaurar D1 pode apagar transações e progresso posteriores, portanto exige reconciliação cuidadosa.
- [ ] Só iniciar campanha “instale agora” e tráfego pago depois da instalação real e das transações testadas.

## Referências e links operacionais
- GitHub CI: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions
- Deploy Cloudflare: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/deploy-cloudflare.yml
- Publicação Android: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/publicar-apk-android.yml
- Releases: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases
- Portal: https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html
- Desempenho: https://web.dev/articles/optimize-lcp
- Assinatura: https://developer.android.com/studio/publish/app-signing.html
- Verificação Android para distribuição externa: https://developer.android.com/developer-verification/guides

**Definição de pronto:** Gates A–F comprovados com artefatos, logs não sensíveis, testes reais e release pública. Portal ativo ou pull request aprovada isoladamente não comprovam lançamento comercial.
