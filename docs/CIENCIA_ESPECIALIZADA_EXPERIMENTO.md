# Ciências militares especializadas — experimento offline

Referências de gênero: [Academia de Rise of Kingdoms](https://riseofkingdoms.fandom.com/wiki/Technology), [pesquisa sobre avaliação automatizada de balanceamento RTS](https://ieeexplore.ieee.org/abstract/document/9619032), [transações Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Quatro especializações originais: infantaria, arqueiros, cavalaria e cerco. Hipótese inicial de 0,3 ponto percentual de ataque por nível, máximo 10 níveis / 3 pontos percentuais. Somadas aos bônus universais existentes dentro do teto de 30%; não muda o bônus de mascote. Nenhum custo, requisito VIP, efeito de muralhas ou bônus de rally aprovado nesta etapa. Nenhum endpoint recebe os níveis experimentais, nenhum novo registro é gravado no D1 e o Worker não passa a opção ao simulador. A versão 1 é preservada; o experimento exige rulesVersion=2 e dados explícitos de teste. 

Matriz de testes: quatro classes, três tiers, três tamanhos de exército e níveis 0/5/10 (108 simulações). Verificar isolamento de classe, conservação de tropas, determinismo, teto e ausência de efeitos na versão 1. Não representa PvP real nem comprova taxa de vitória equilibrada. Antes de disponibilizar: simulações de confrontos mistos, telemetria beta, definição de requisitos e custos, persistência autoritativa, validação atômica dos débitos, cobertura de marchas e demais modos e aprovação explícita dos limites.

## Matriz de sensibilidade mista

Adicionada comparação pareada em cinco formações (balanceada e quatro especializadas), três níveis do defensor, quatro sementes fixas, dois níveis de bônus de equipamento (0% e 28%) e seis perfis de pesquisa (controle, quatro especializações isoladas e todas juntas). São 720 simulações adicionais. O teste verifica conservação de tropas, limite de poder e invariância do poder do defensor. A saída TAP registra vitórias e sobreviventes agregados por formação e perfil, com os mesmos parâmetros para controle e tratamento. Não exige igualdade de vitórias nem interpreta resultados PvE como equilíbrio PvP. A metodologia é inspirada em [Metagame Autobalancing for Competitive Multiplayer Games](https://ieee-cog.org/2020/papers/paper_100.pdf). A ativação continua bloqueada até avaliação dos resultados e integração autoritativa.


## Defesa e vitalidade — extensão experimental

Os logs da matriz de 720 simulações registraram 120/120 vitórias no controle de cada perfil. A amostra estava saturada e não permite inferir equilíbrio de vitórias. Adicionamos duas curvas independentes, defesa e vida, cada uma com 0,3 ponto percentual por nível e máximo de 3 pontos percentuais por classe, dentro dos tetos existentes de 30% por atributo. A escolha é uma hipótese de teste, não um bônus aprovado. O simulador continua sem ligação desses parâmetros com o Worker ou a Academia. Mantém o comportamento v1 e o v2 sem perfil experimental.

Nova matriz: cinco composições, sete escalas de tamanho (1 a 64), dois níveis de defensor, quatro sementes e cinco perfis (controle, ataque, defesa, vida e combinado): 1.400 simulações. Exige vitórias e derrotas no controle; registra mudanças de desfecho, sobreviventes e conservação de tropas. Ainda é PvE sintético, não PvP; não mede valor econômico de pesquisa ou efeitos em muralhas e rally. Referência metodológica: https://pure.york.ac.uk/portal/en/publications/metagame-autobalancing-for-competitive-multiplayer-games/ .
