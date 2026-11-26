# Atlas de entidades Eldoria — integração incremental

O manifesto 3D mantém version=2 e as coleções models, props, units, files e scannedMaterials. entityArt usa chaves canônicas e referências aos símbolos reais; não declara GLB, KTX2, WebP ou animações inexistentes. Os nove dragões compartilham o GLB existente quando disponível; o atlas inclui emblemas distintos, não retratos finais nem animação 2D. Os 70 retratos SVG existentes são reutilizados. A arte nova é vetorial decorativa original.

O renderer WebGL e o HUD compartilham a promessa de carregamento do manifesto; o módulo DOM/2D não depende de Three.js. low/balanced/high continuam sendo os perfis canônicos; medium é alias. Ausência de arte retorna null, preservando o fallback procedural. O cache de imagens é limitado a 48 entradas e erros são descartados para permitir nova tentativa.

Escopo desta etapa: manifesto, resolução dos assets, HUD de recursos, coleção de dragões. Os ícones de edifícios continuam usando o atlas já existente; os retratos/tropas estão indexados, mas seus menus e o Canvas da cidade ainda não foram migrados. Não há compressão nova, arquivos de tier, sprites animados, nem alteração no D1, pagamentos ou deploy.

Próximas etapas: imagens WebP próprias por tier, animações reais por unidade, metadados de sprite sheets, KTX2 validados e integração visual dos demais menus, com testes Android físico e capturas comparativas.
