# Atlas de entidades Eldoria — integração incremental

O manifesto 3D mantém version=2 e as coleções models, props, units, files e scannedMaterials. entityArt usa chaves canônicas e referências aos símbolos reais; não declara GLB, KTX2, WebP ou animações inexistentes. Os nove dragões compartilham o GLB existente quando disponível; o atlas inclui emblemas distintos, não retratos finais nem animação 2D. Os 70 retratos SVG existentes são reutilizados. A arte nova é vetorial decorativa original.

O renderer WebGL e o HUD compartilham a promessa de carregamento do manifesto; o módulo DOM/2D não depende de Three.js. low/balanced/high continuam sendo os perfis canônicos; medium é alias. Ausência de arte retorna null, preservando o fallback procedural. O cache de imagens é limitado a 48 entradas e erros são descartados para permitir nova tentativa.

Escopo desta etapa: manifesto, resolução dos assets, HUD de recursos, coleção de dragões. Os ícones de edifícios continuam usando o atlas já existente; os retratos/tropas estão indexados, mas seus menus e o Canvas da cidade ainda não foram migrados. Não há compressão nova, arquivos de tier, sprites animados, nem alteração no D1, pagamentos ou deploy.

Próximas etapas: imagens WebP próprias por tier, animações reais por unidade, metadados de sprite sheets, KTX2 validados e integração visual dos demais menus, com testes Android físico e capturas comparativas.

## Segunda etapa — Canvas e menus

O Canvas desenha os símbolos do atlas existente após decodificação local do SVG, com um único cache de 48 imagens. O desenho é síncrono durante o repaint e os carregamentos assíncronos só solicitam um novo frame do estado atual. A imagem é posicionada no ícone do botão e substitui sua exibição quando disponível; a arte procedural e os botões existentes permanecem como fallback. Skins equipadas continuam no caminho antigo para não perder a personalização. O modo leve continua sem importar o motor 3D.

O índice passa a incluir os sete símbolos reais da academia. O menu de equipamentos resolve retratos por hero_key, mantendo o símbolo legado como fallback. O recrutamento mostra a unidade selecionada e o painel de designação de heróis mostra seu retrato. Os testes usam o manifesto real e chaves reais, sem inventar arquivos WebP ou IDs hero_01. Não foram produzidos novos GLB/KTX2 ou sprites animados nesta etapa.

## Estruturas especiais

O ninho de dragões e o altar de convocação agora têm símbolos vetoriais locais originais no atlas de edifícios e entradas canônicas no manifesto. O editor de ocupação 50×50 desenha a arte sobre os footprints persistidos e a prévia de posicionamento, com fallback das letras N/A e sem alterar a autorização de movimentos. Usa o mesmo cache de imagens; não importa Three.js. A geometria procedural 3D existente permanece intacta. O teste Chromium verifica as duas estruturas salvas e gera uma captura. Esta etapa não produz GLB adicionais nem altera D1.
