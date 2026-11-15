# Retenção inicial e abertura progressiva de reinos

## Jornada inicial implementada
O Centro de Comando apresenta seis marcos contextuais calculados exclusivamente a partir do estado retornado pelo servidor:
1. melhorar uma construção;
2. alcançar 40 tropas;
3. concluir a primeira pesquisa;
4. participar da primeira batalha PvE;
5. entrar ou criar uma aliança;
6. registrar a primeira pista do Arquivo Velado.

O guia não cria recompensas paralelas, não grava progresso duplicado no navegador e não usa contagens regressivas. Cada marco deriva de construções, tropas, pesquisas, relatórios, aliança e do progresso narrativo já existente. Os botões levam o jogador à aba correspondente. A conclusão não é perdida quando fecha o jogo.

## Política de abertura de reinos
A política central define 1.000 jogadores válidos como mínimo obrigatório antes de considerar um novo reino público. Mesmo após 1.000, a abertura depende de evidência de capacidade/demanda (capacidade operacional atingida ou fila sustentada), para evitar dividir uma comunidade que ainda cabe no reino atual.

**Importante:** a implementação atual não possui um registro de mundos/reinos públicos independentes; a tabela kingdoms representa a cidade individual de cada jogador. Portanto, não bloquear ensureKingdom() nem impedir a criação do castelo individual. Isso impediria novos jogadores de entrar no jogo. realm-policy.js e seus testes registram a regra pronta para ser conectada quando o gerenciador de mundos for criado. Não há nova tabela nem migração até existir esse modelo.

## Operação e métricas
- Medir D1, D7 e D30 por coorte de primeiro login.
- Medir conclusão de cada marco, tempo até primeira melhoria, primeira pesquisa, primeira batalha e primeira aliança.
- Separar contas válidas de contas duplicadas/bots antes de contar os 1.000.
- Monitorar jogadores ativos simultâneos, latência, erros, fila de espera e custo por jogador.
- Não usar notificações de culpa, perda de sequência ou pay-to-win para forçar retorno.
- Rever cadência de conteúdo com dados próprios; benchmarks externos são referência, não promessa de resultado.

## Limites
O guia inicial é funcional na interface e depende do estado existente do servidor. A política de abertura está implementada e testada como módulo de domínio, mas não está conectada a um seletor de mundos, pois esse sistema ainda não existe. Nenhuma nova instância ou reino foi aberto.
