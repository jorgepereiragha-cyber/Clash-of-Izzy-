# Homologação do beta — jogo, arte e capacidade

Escopo: beta fechado, sem deploy, D1 remoto, cobrança ou publicação de APK.

## Evidências e critérios

- CI de isolamento e CI de gameplay no SHA candidato; cada alteração posterior invalida a aprovação anterior.
- Reino: validar construção, capacidade, recursos, duas sessões independentes e persistência de progresso. No Android físico, verificar toques, rotação, zoom, desempenho sustentado e recuperação de rede/WebGL.
- Skins: equipar apenas itens possuídos, persistir no reino/mapa/arena, validar bônus e resgate único da coleção; comparar a aparência de cada modelo e registrar captura real. Descrições de skins não comprovam modelos 3D.
- Tropas e dragões: conferir treinamento, filas, combate, inventário e exclusividade do dragão equipado. Verificar animações e silhuetas em aparelhos reais.
- Catálogo: conferir preços, gemas, recursos, limite diário, idempotência e flags. Pacotes Master e de progressão permanecem bloqueados; nenhuma compra real no beta. Preços P4–P8 são propostas até aprovação comercial.
- APK: compilação de teste não é release. Validar assinatura persistente, certificado, checksum, instalação e atualização em aparelho real; distribuir somente após homologação do backend.

## Cobertura artística atual

O manifesto `assets/3d/manifest.json` contém dois modelos de edifícios (torre/muralha), dois props (trebuchet/árvore) e uma unidade (arqueiro), todos CC0. A cena usa também geometria procedural e texturas compartilhadas. Ainda não há cobertura GLB dedicada comprovada para todos os edifícios, tipos de tropas, skins, heróis e dragões. Não declarar arte premium completa com base apenas no número de itens do catálogo.

Próximos incrementos: castelo e silhuetas por estágio, kit coerente de edifícios, infantaria/cavalaria/cerco, skins e dragões; usar arte própria ou licenciada, registrar origem e licença, manter LOD e fallback e medir custo de GPU, tamanho e tempo de carregamento.

## Capacidade — meta de 1.000 jogadores

O teste existente de 1.000 GETs usa transporte simulado e não demonstra 1.000 jogadores simultâneos. Não executar contra produção ou beta sem autorização, orçamento e escopo isolado. Após ativação, criar contas sintéticas em ambiente descartável; iniciar com 10/50/100 e aumentar para 250/500/1.000 usuários simultâneos somente após aprovação de cada etapa. Simular leitura de estado, filas, marchas e ações de batalha com distribuição realista. Registrar latências p50/p95/p99, falhas, 429/5xx, integridade, consumo D1/Workers/Durable Objects e custos. Interromper em regressão de dados, erro sustentado, custo acima do orçamento ou saturação. Definir metas e janela de carga antes de executar. Nenhuma capacidade certificada até haver resultado real.

## Ativação

Erro Cloudflare 10067 precisa de resolução na conta correta (assinatura/limite de namespaces). Confirmar assinatura antes de novo pagamento. Após CI aprovada e deploy protegido, exigir health 200, convite obrigatório e revogação, testes online e Android físico; não liberar pagamentos reais.
