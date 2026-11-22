# Marchas avançadas: filas simultâneas e formações rápidas

Essa atualização **complementa** a capacidade de marcha autoritativa que já estava na branch main. Não cria outra fórmula, não muda atributos dos heróis e não altera o banco D1.

## Filas simultâneas
Uma expedição ocupa uma fila enquanto `marches.status='marching'`. A abertura de filas segue a progressão do reino:

| Condição | Número de filas |
|---|---:|
| Inicial | 1 |
| Castelo nível 5 | 2 |
| Castelo nível 15 | 3 |
| Tecnologia militar nível 5, além de castelo 15 | 4 |
| Tecnologia militar nível 15, além de castelo 15 | 5 |

No total, máximo de **cinco filas**. O Worker calcula o limite a partir do nível real do castelo e da pesquisa militar. A quantidade ativa é lida como subconsulta do próprio SELECT de estado do reino, sem adicionar um 16º statement ao lote de leitura da D1. No envio de tropas, o bloqueio por filas ocupadas faz parte da atualização condicional e transacional que debita as tropas.

## Preparações rápidas da marcha
Os botões são somente atalhos do cliente; o servidor continua conferindo a quantidade disponível e a capacidade total:
- Coleta: selecionar até 50 soldados, começando pelas tropas leves.
- Equilibrada: dividir a formação por tipos disponíveis e distribuir sobras até o teto.
- Preencher: selecionar até o limite da marcha com tropas disponíveis.
- Limpar: remover as tropas selecionadas da composição.

Cada tropa individual fica limitada ao máximo que a API aceita (10.000 por tipo), sem sacrificar segurança. A formação continua editável manualmente antes do envio.

## Segurança e implantação
- Não altera Pix, Mercado Pago, credenciais, usuários, reinos, tropas armazenadas ou a assinatura Android.
- A capacidade de tropas de uma marcha continua definida unicamente pelo módulo existente `march-capacity.js`.
- Não requer migration D1 adicional. Precisa do Worker com o novo `march-slots.js` e dos assets `world.html`, `world-map.js` publicados pelo deploy oficial.
- Testar em D1 Preview, CI e Android real com uma, duas e cinco marchas, incluindo concorrência e devolução de tropas após o retorno.
- A liberação comercial do APK permanece sujeita às verificações de backend, segredos, pagamentos, OAuth e release assinada.

**Observação:** esta atualização não significa que o APK já esteja ativo. O GitHub Releases continua sendo a fonte de distribuição verificada.
