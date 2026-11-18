# Preparação Android e Google Play — Clash of Izzy

Objetivo: publicar uma edição Android oficial sem criar um segundo jogo, outro reino ou outro backend. O app abre a PWA existente em tela cheia por Trusted Web Activity (TWA), mantendo Eldoria e os serviços atuais como fonte única da verdade.

## Arquitetura
- Cliente: PWA atual (HTML/CSS/JavaScript + Three.js), com interface adaptada a toque e telas Android.
- Pacote Android: TWA gerada com Bubblewrap ou ferramenta Android equivalente, distribuída como Android App Bundle (AAB).
- Verificação: Digital Asset Links em /.well-known/assetlinks.json, vinculando domínio, pacote e certificado de assinatura.
- Backend: Cloudflare Workers + D1 existentes; um único reino compartilhado Eldoria.
- Atualizações: conteúdo web evolui pelo domínio; mudanças no invólucro Android, permissões e configuração TWA exigem nova versão AAB e revisão.

TWA não transforma automaticamente o jogo em cliente nativo. O conteúdo continua vindo do domínio verificado. Testar inicialização, login convidado, retorno do app, navegação, rede e offline.

## Estado identificado
- manifest.json já define standalone, pt-BR, ícones SVG 192/512 e atalhos Reino/Mapa.
- sw.js já implementa cache do shell, fallback offline e validação do manifesto Three.js local.
- kingdom.html, world.html e arena.html compõem a experiência de jogo.
- Three.js local está configurado; o manifesto 3D registra modelos e licenças CC0 de pacotes Kenney.
- scripts/kingdom-quality.js já seleciona perfis low, balanced e high.
- Ainda não foi identificado/validado: projeto Android TWA/Gradle, AAB assinado, assetlinks.json de produção, pacote definitivo, testes Play Console e aprovação.

## Requisitos antes do envio
1. Criar/confirmar conta Google Play Console e concluir verificação de identidade e pagamento da taxa exibida pela Google.
2. Reservar identificador Android definitivo, por exemplo com.clashofizzy.game somente após verificar disponibilidade. Não mudar após publicar.
3. Preparar nome, ícone adaptativo, gráficos de loja, screenshots reais Android, descrição, categoria e classificação indicativa.
4. Gerar TWA/AAB com assinatura protegida; guardar chave de upload e credenciais fora do repositório.
5. Publicar assetlinks.json com SHA-256 do certificado correto e confirmar a verificação do domínio.
6. Preparar política de privacidade pública, Data safety, classificação de conteúdo, público-alvo, anúncios (se houver) e contato de suporte.
7. Validar acessibilidade, navegação por gestos, telas pequenas, rotação, pausa/retomada, falhas de rede, atualização PWA e consumo de bateria.
8. Fazer testes internos e fechados. Contas pessoais criadas após 13/11/2023 podem estar sujeitas a pelo menos 12 testadores inscritos continuamente por 14 dias antes de solicitar acesso à produção; confirmar o requisito mostrado na conta.
9. Enviar AAB para revisão somente após checklist técnico, jurídico e de pagamentos concluído.

## API Android e política da loja
A documentação Google Play indica que, a partir de 31/08/2026, novos apps e atualizações devem mirar Android 16 / API 36 ou superior, salvo extensões/exceções publicadas pela Google. Revalidar no momento do envio.

## Pagamentos e moedas virtuais
Gemas, skins, VIP, acelerações e outros bens digitais vendidos dentro de um app distribuído pela Play Store normalmente devem usar Google Play Billing, salvo programa/região/exceção aplicável e formalmente habilitado. Não inserir checkout Mercado Pago ou redirecionamento externo dentro do app Android antes de confirmar elegibilidade e cumprir os termos aplicáveis. Não armazenar número de cartão, validade ou CVV no jogo.

## Texturas, visual e desempenho
- Preservar Three.js local, KTX2/Draco/Meshopt quando disponíveis e modelos com licença registrada.
- Manter três perfis de renderização e limitar pixel ratio/orçamento de pixels em celulares.
- Preferir KTX2/Basis, mipmaps e compressão; evitar texturas 4K em telas pequenas sem necessidade.
- Usar mapas PBR coerentes (base color, normal, roughness/metalness) e tamanhos por importância/LOD; medir memória e FPS antes de aumentar resolução.
- Sombras, pós-processamento, partículas, água e efeitos volumétricos devem ser graduais e desligáveis em aparelhos modestos.
- Suspender animações/renderização quando a tela estiver oculta; respeitar prefers-reduced-motion.
- Manter fallback 2D/estático quando WebGL não estiver disponível ou perder contexto.
- Não adicionar bibliotecas CDN ao caminho crítico; manter dependências locais e cache versionado.
- Medir em Android real: FPS, tempo de abertura, memória, tamanho AAB, carregamento, falhas WebGL e consumo térmico.

## Critérios de aceite
- TWA abre o reino diretamente em tela cheia após verificar domínio e certificado.
- O mesmo jogador e reino são usados no navegador e no Android.
- Nenhum segredo, chave privada, token de servidor ou credencial fica no app/repositório.
- Login convidado, recuperação de sessão, sincronização e retorno do app passam nos testes.
- Aparelhos de entrada continuam utilizáveis com qualidade reduzida.
- Compras digitais seguem a política de faturamento vigente.
- AAB, política de privacidade, Data safety, classificação e screenshots correspondem à versão testada.

## Não executar sem validação
- Não aplicar migrações nem alterar D1 de produção para preparar a Play Store.
- Não publicar AAB, mudar domínio, pacote, certificado ou secrets sem revisão.
- Não substituir backend por Firebase/servidor separado: isso duplicaria sistemas e fragmentaria Eldoria.
- Não apagar histórico de compras ou jogadores ao substituir fluxos comerciais.