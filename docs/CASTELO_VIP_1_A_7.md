# Castelo nível 30 → VIP 1 a VIP 7 (Clash of Izzy)

## Resultado da auditoria
O código anterior tinha `kingdoms.prestige INTEGER 0..7`, progressão com sete custos em gemas e bônus de produção de 10% por prestígio, **mas cada ascensão reiniciava o nível do castelo para 1**. Também existem `vip_packages` comerciais, uma tabela separada, que não é a progressão do castelo.

**Novo funcionamento (sem cópia de assets ou nomes comerciais do Clash of Kings):**
- Construções normais: Castelo 1 até 30; edifícios vinculados ao limite do castelo continuam até nível 30.
- Após castelo 30: VIP do Castelo 1 até VIP 7. O castelo e sua linha de construção permanecem em nível 30.
- Persistência: `kingdoms.prestige` é reutilizado como nível VIP, com sua restrição D1 existente de 0..7. Não há nova coluna ou migração necessária; usuários que já tinham prestígio mantém seus níveis. Se um usuário antigo já reiniciou castelo 1..29, ele mantém o nível e precisa chegar novamente ao 30 para a próxima evolução, evitando migração destrutiva ou alteração de filas pendentes.
- O catálogo `vip_packages` vende gemas; comprar um desses pacotes não aumenta automaticamente o nível VIP do castelo.
- O servidor exige que o `expectedVipLevel` seja o VIP atualmente salvo. Repetir a mesma solicitação falha com 409 e não debita gemas novamente.
- Atualizações de prestígio, débito de gemas e histórico ocorrem num batch transacional D1, com checagem de propriedade e progressão feita pelo Worker. Nenhum contador VIP pode ser enviado pelo cliente para conceder vantagens.
- Combate: acréscimos do VIP alimentam um único motor de batalha para missões PvE e de território, limitados ao teto global de 30% já usado pelo jogo; produção reaproveita o multiplicador do prestígio existente.

| Nível do castelo | Próxima evolução | Gemas | Produção (total acumulado) | Ataque | Defesa |
|---|---|---:|---:|---:|---:|
| 30 | VIP 1 | 1.000 | +10% | +0,5% | +1% |
| 30 · VIP 1 | VIP 2 | 2.500 | +20% | +1% | +2% |
| 30 · VIP 2 | VIP 3 | 5.000 | +30% | +1,5% | +3% |
| 30 · VIP 3 | VIP 4 | 10.000 | +40% | +2% | +4% |
| 30 · VIP 4 | VIP 5 | 20.000 | +50% | +2,5% | +5% |
| 30 · VIP 5 | VIP 6 | 40.000 | +60% | +3% | +6% |
| 30 · VIP 6 | VIP 7 | 80.000 | +70% | +3,5% | +7% |

Os valores de gemas são os do prestígio pré-existente; nenhum preço em dinheiro real foi inserido. A fonte do saldo de gemas permanece o servidor, e a entrega de gemas por pacotes pagos segue a verificação do provedor.

**Validação para lançamento:** testes de duplicação e de sete evoluções seguidas, comparação do motor de combate, renderização mobile, verificação do build APK e QA em celular físico. Esta implementação está na PR #152, que continua em draft; não publica em produção automaticamente.
