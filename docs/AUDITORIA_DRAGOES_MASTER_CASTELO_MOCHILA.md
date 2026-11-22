# Auditoria integrada — 70 heróis, 9 dragões, bônus, castelo e inventário

## Identidade e balanceamento
- Heróis: 65 invocáveis mais cinco sazonais, total de 70. Cores: 18 brancos, 18 azuis, 23 roxos incluindo sazonais e 11 dourados. Todos têm IDs e retratos SVG distintos; os sazonais são recompensas de evento, não participantes do sorteio padrão.
- Invocação por tentativa independente: 55% branco, 30% azul, 13% roxo e 2% dourado. O sorteio é feito apenas no Worker, com RNG criptográfico. Não existe garantia oculta de dourado no pacote de dez.
- Dragões: três azuis, três roxos e três dourados. Somente um equipado tem bônus de batalha. A coleção não usa `kingdom_pets` e, portanto, não duplica o mascote Dragão Nórdico.
- Bônus de ataque/defesa são calculados pelo servidor: heróis até 20% por atributo, dragão ativo até 5,5%, uma skin de castelo até 2,5% e conjuntos cosméticos até 2,5% em agregado. Bônus totais relevantes ficam limitados pelo motor de combate a 30%. Não somar os três dragões dourados entre si.
- Aulas de evolução do dragão gastam recursos com condição transacional de nível, evitando evoluções simultâneas cobradas duas vezes.

## Pacote Master (oferta preparada, cobrança desabilitada por padrão)
- Valor inicial de cadastro: R$ 399,00 **provisório, sujeito a aprovação comercial**. O produto não é exibido nem vendido até `MASTER_PACK_ENABLED=true` em Worker validado.
- Entrega após pagamento confirmado: 10.000 gemas, 50.000 comida, 50.000 madeira, 40.000 pedra, 20.000 ferro, 15.000 ouro e os três dragões dourados. Somente um dragão equipado.
- Uma concessão por reino, `master_bonus_claims` com `UNIQUE` por reino e pedido, e restrição de compra do produto. Mercado Pago só libera após Order confirmada no provedor; Nubank Pix exige extrato verificado por administrador.
- As recompensas de Master são creditadas diretamente no banco por lote transacional. A carta da caixa postal é apenas confirmação, sem botão de resgate de uma segunda cópia.

## Castelo, caixa postal e mochila
- Castelo: melhorias dependem de recursos, materiais, nível e filas; a aparência é equipável somente após verificar a propriedade da skin.
- Caixa postal: persistida por reino em `kingdom_mailbox` com origem única. Mensagem de boas-vindas concede 1.000 comida + 500 madeira, resgatáveis **uma única vez**, com atualização conjunta da carta e dos recursos.
- Mochila: lista materiais de `inventory_items` e itens de `shop_inventory` com quantidades do servidor. Não confundir inventário com saldo bancário ou cosméticos de propriedade.
- Relatórios de batalha e chat de alianças são módulos distintos da caixa postal, mantidos no histórico original.

## Skins
- 200 skins de castelo com porcentagens individuais em `migrations/0028_skin_combat_attributes.sql`, protegidas por `CHECK` de 0 a 2,5% e conferência de propriedade ao equipar.
- Quatro conjuntos cosméticos de cinco peças cada. Bônus progressivos só se aplicam às peças equipadas, com teto total de 2,5% por atributo de ataque/defesa, 2% vida e 0,75% chance crítica.
- A edição de lançamento oferece inicialmente seis skins pagas no catálogo, embora outras estejam persistidas. Esse limite é comercial e não representa perda de skins já adquiridas.

## Pontos pendentes antes do lançamento
- Validar migração `0030_dragons_master_mailbox.sql` no D1 Preview, nunca primeiro em produção.
- Testes completos em Node, Chromium e emulador Android, depois celular físico e carga real no Cloudflare.
- Configurar assinatura APK permanente e contas de cobrança. Não ativar `MASTER_PACK_ENABLED` nem `NUBANK_PIX_ENABLED` antes da confirmação de titularidade e reconciliação real.
- Revisar os efeitos de pagamento e reembolso antes de permitir compradores externos; a PR continua em draft até comprovar todos os critérios.

## Notas de arquitetura
A experiência dentro do aplicativo ainda utiliza WebView sobre o Worker; esconder o botão de jogar no portal não equivale a restringir o acesso HTTP por navegador. Não declarar lançamento nativo/produção ou escala de 1000 jogadores sem testes reais.
