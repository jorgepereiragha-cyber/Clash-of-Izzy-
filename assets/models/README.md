# Modelos 3D do Clash of Izzy

Coloque aqui modelos **.glb** otimizados. O diretório raiz do projeto já é publicado como asset estático pelo Wrangler; portanto, os arquivos ficam acessíveis em `/assets/models/nome-do-modelo.glb`.

O carregador da arena usa a mesma versão Three.js já usada pelo jogo (0.187.0), com suporte opcional a:
- Draco para geometria comprimida;
- KTX2/Basis para texturas comprimidas;
- animações glTF por AnimationMixer.

Exemplo no console do navegador, depois que a arena terminar de carregar:

```js
const castle = await window.COI_ASSETS.addModel(
  'castle',
  '/assets/models/castle.glb',
  { position: [0, 0, 0], scale: 1, animation: 'Idle' }
);
```

A API retorna uma instância com `root`, `play(nomeDaAnimacao)` e `dispose()`.
Não adicione arquivos GLB fictícios: o carregador só busca modelos quando um arquivo real for fornecido.
