# Clash of Izzy — preparação Android e Google Play Store

**Revisão:** 18 de novembro de 2026  
**Status:** preparação técnica e documental; não publicado na Play Store.

## 1. Arquitetura escolhida

A edição Android será uma **Trusted Web Activity (TWA)** sobre a PWA existente, gerada com Bubblewrap. A camada Android abre o domínio verificado do jogo em tela cheia; o mundo compartilhado Eldoria, login, economia e persistência continuam no Worker + D1 atuais.

```text
Google Play (Android App Bundle)
        |
        v
TWA / Chrome verificado (Bubblewrap)
        |
        v
PWA Clash of Izzy (/kingdom.html)
        |
        v
Cloudflare Worker + D1 (Eldoria compartilhado)
```

**Não criar um segundo servidor, banco, login ou sistema de economia.** A TWA é a camada de distribuição Android e não substitui o jogo web nem a fonte de verdade D1.

Referências oficiais:
- [Trusted Web Activity — início rápido](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Bubblewrap — projeto e CLI](https://github.com/GoogleChromeLabs/bubblewrap)

## 2. Auditoria da base existente

- PWA já possui `manifest.json`, modo `standalone`, ícones e início em `/kingdom.html`.
- Service Worker mantém cache do shell e dos módulos Three.js same-origin; rotas `/api/*` continuam fora do cache offline.
- Three.js está fixado em `0.187.0`, com loaders Draco, KTX2/Basis e Meshopt locais.
- Cidade 3D tem fallback 2D quando WebGL falha/perde contexto.
- Não existe ainda projeto Android TWA/Gradle, Application ID confirmado, assinatura, Digital Asset Links verificado nem AAB assinado.
- Esta preparação não cria conta Play Console, não publica AAB e não altera o Worker de produção.

## 3. O que será necessário para enviar à loja

1. Conta Google Play Console do proprietário, verificação de identidade e dados de desenvolvedor/pagamentos.
2. Domínio final controlado pelo projeto. Recomenda-se domínio próprio para a marca e continuidade, em vez de depender permanentemente de um endereço técnico.
3. Application ID exclusivo no formato reverso de domínio. `com.clashofizzy.game` é somente uma sugestão para verificar; não está reservado nem confirmado.
4. Android target API **36 ou superior** para novos apps e atualizações enviados desde 31/08/2026.
5. Projeto TWA gerado pelo Bubblewrap, com nome, ícones, cores, orientação, start URL e versão configurados.
6. Chave/certificado de assinatura e Play App Signing. Registrar o SHA-256 do certificado realmente usado para assinar a versão distribuída.
7. Digital Asset Links em `/.well-known/assetlinks.json` no mesmo domínio da PWA, com Application ID e fingerprint reais. Não usar placeholder fictício.
8. Android App Bundle (`.aab`) assinado e testado em aparelho físico.
9. Ficha da loja: nome, descrição curta/longa, categoria Estratégia, ícone de loja, imagem de destaque e capturas reais do jogo.
10. Política de privacidade pública, formulário Data safety, classificação indicativa, contato de suporte e instruções de acesso para revisão quando houver login.

Requisito oficial de API: [target API do Google Play](https://developer.android.com/google/play/requirements/target-sdk?hl=pt-br).

### Teste fechado de contas pessoais

Se a conta for pessoal e tiver sido criada após 13/11/2023, a regra atual exige teste fechado com pelo menos **12 testadores inscritos continuamente por 14 dias** antes de solicitar acesso à produção. Isso depende da categoria/idade da conta; confirmar o requisito no Play Console do proprietário.

Fonte: [requisitos de teste para novas contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt).

### Materiais gráficos da loja

- Capturas precisam mostrar a build real: cidade, mapa, interface e recursos de jogo que estejam disponíveis.
- Preparar imagens em retrato e paisagem para os formatos suportados; imagens de tablet só devem mostrar layout realmente validado em tablet.
- Criar ícone e imagem de destaque segundo as especificações atuais exibidas na Play Console no momento do envio.
- Não usar arte, personagens, logos ou interface copiados de Clash of Kings. A referência é o gênero e o nível de acabamento, mantendo identidade própria do Clash of Izzy.

Guia oficial: [imagens e capturas para a ficha da Play Store](https://support.google.com/googleplay/android-developer/answer/9866151?hl=pt).

## 4. Pagamentos — requisito antes do lançamento Android

Gemas, moedas, skins, VIP, personagens e outros itens usados dentro do jogo são bens digitais. A política do Google Play normalmente exige **Google Play Billing** para vender esses bens em um app distribuído pela Play Store, salvo exceção/programa oficial aplicável e atendido.

Consequências para o projeto:
- Não inserir botão, link, WebView ou redirecionamento para Mercado Pago, Pix ou WhatsApp na edição Play para comprar bens digitais sem enquadramento oficial em exceção/programa aplicável.
- Separar o adaptador de compra por canal: a loja Android usa Play Billing; a edição web mantém o fluxo próprio somente nos canais permitidos.
- Validar no Worker o token/compra confirmado pelo Google antes de conceder gemas, skins ou VIP.
- Manter D1 como fonte de verdade da concessão e da auditoria da compra.
- Nunca armazenar número completo do cartão, validade ou CVV no jogo.

Fonte: [política oficial de pagamentos do Google Play](https://support.google.com/googleplay/android-developer/answer/10281818?hl=pt).

## 5. Qualidade, segurança e privacidade

- Política de privacidade coerente com conta, autenticação, identificadores, telemetria, suporte e fornecedores realmente utilizados.
- Preencher Data safety com base no tráfego e nas práticas reais; não presumir respostas.
- Responder ao questionário de classificação indicativa incluindo chat/interações entre usuários, compras e conteúdo efetivo.
- Fornecer acesso de revisão para telas que exigem login, sem expor credenciais Master ou secrets.
- Manter saldo, inventário, construção, marcha e combate validados no Worker; o cliente não decide concessões ou resultados econômicos.
- Testar retomada de sessão, rede instável, reconexão, offline do shell, rotação, cortes de tela, navegação Android, memória, perda de contexto WebGL e fallback 2D.
- Validar em ao menos um Android de entrada e um intermediário/alto. Chromium automatizado não substitui aparelho real.
- Acompanhar crash, ANR, consumo de memória, temperatura, tempo de quadro e estabilidade antes de ampliar a distribuição.

## 6. Comandos Bubblewrap — somente depois de definir domínio, ID e assinatura

Ambiente Node.js 18+ (requisito do Bubblewrap CLI atual):

```bash
npm install --global @bubblewrap/cli
```

Inicializar apontando para o manifesto real do domínio definitivo:

```bash
bubblewrap init --manifest https://SEU-DOMINIO/manifest.json --directory android-twa
```

Após configurar Application ID, assinatura, ícones, versão e target SDK conforme o assistente atual:

```bash
cd android-twa
bubblewrap build
```

O build e o AAB resultante devem ser verificados no ambiente real. Não executar esses comandos com domínio, ID ou chaves inventados.

## 7. Sequência de conclusão

| Ordem | Entrega | Critério de aceite |
|---|---|---|
| 1 | Abrir a PWA atualizada no Preview | Sem erro em Android físico |
| 2 | Definir domínio e Application ID | Domínio sob controle e ID exclusivo |
| 3 | Gerar TWA/Bubblewrap | Projeto Android reproduzível |
| 4 | Assinatura + Digital Asset Links | Verificação da TWA aprovada |
| 5 | Pagamentos compatíveis com a Play | Compra e concessão server-side testadas |
| 6 | Ficha, privacidade e Data safety | Declarações revisadas pelo proprietário |
| 7 | AAB em teste interno/fechado | Instalação, login, jogo e compra testados |
| 8 | Acesso à produção e lançamento gradual | Todos os gates da Play Console atendidos |

## 8. Bloqueios externos ainda necessários

- Acesso/verificação da conta Play Console.
- Domínio definitivo e Application ID confirmado.
- Certificado/assinatura e fingerprint Play App Signing.
- Digital Asset Links com valores reais.
- Integração Google Play Billing no catálogo e Worker.
- Política de privacidade, Data safety e respostas do proprietário.
- Teste físico Android, grupo de teste fechado (quando aplicável) e revisão da Play.

**Segurança:** esta preparação não publica Worker, não altera secrets, não executa migrações remotas, não modifica D1 de produção e não envia AAB à loja.
