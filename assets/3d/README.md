# Modelos 3D Kenney — Clash of Izzy

Os GLBs foram incorporados a partir dos pacotes originais Kenney, preservando os caminhos relativos das texturas `Textures/colormap.png` para evitar dependências de CDN de terceiros.

| Pacote | Modelos usados | Licença |
|---|---|---|
| Castle Kit | Torre, muralha e trebuchet | CC0 1.0 |
| Mini Forest | Arqueiro com animações e árvore alta | CC0 1.0 |

Fontes oficiais:
- https://kenney.nl/assets/castle-kit
- https://kenney.nl/assets/mini-forest

As cópias dos arquivos de licença fornecidos com os pacotes estão em `licenses/`. A atribuição a Kenney é opcional, mas a origem permanece registrada no manifesto.

O carregamento é local e opcional. O perfil de qualidade e Data Saver continuam controlando o download; a geometria procedural continua como fallback. Todos os modelos são servidos do próprio jogo em `/assets/3d/`.

## Política de entrada de modelos externos
O validador exige a identificação explícita CC0-1.0 e URL HTTPS válida para cada entrada, inclusive as desativadas. A declaração no manifesto não substitui a verificação humana da origem, licença e arquivo original. Antes de importar, registrar autor, pacote, URL oficial, versão, licença fornecida, hash SHA-256 dos bytes e correspondência com o modelo. Não importar previews, marcas, artes extraídas de jogos ou conteúdo apenas gratuito sem autorização de redistribuição. As fontes candidatas e etapas de validação estão em docs/ASSETS_CC0_SELECTION.md.

O registro de licenças `licenses.json` e a validação de SHA-256 em `npm run assets:licenses` são obrigatórios para GLBs e texturas. CC-BY-4.0 é aceito somente com atribuição, fonte, link de licença e indicação de alterações completas; todos os assets atuais são CC0. Kenney continua provisório. Os créditos do portal e do jogo são gerados pelo mesmo registro.
