# Forja Real — equipamentos e ciência

## Regras de progressão
- Cinco espaços independentes: arma, elmo, armadura, botas e acessório.
- Níveis de equipamento: 1 a 20.
- Atributos percentuais aditivos; somente peças equipadas entram no cálculo.
- Limites totais: ataque 30%, defesa 30%, vida 25%, velocidade de marcha 20% e crítico 15%.
- Custos de forja e evolução são calculados no Worker e debitados no D1. O cliente não concede itens nem altera moedas.
- O simulador de combate recebe os bônus de ataque, defesa e vida calculados no servidor. Ataques de marcha em território também usam os bônus.

## Ciência da evolução
- Metalurgia Rúnica: +0,75% ataque por nível.
- Runas de Proteção: +0,75% defesa por nível.
- Forja Vital: +0,50% vida por nível.
- Passos de Asgard: +0,50% velocidade de marcha por nível.
- Cada trilha vai até nível 10. O nível de Academia exigido aumenta a cada três níveis da pesquisa.
- A pesquisa usa a tabela `research` já existente; não cria uma segunda fonte de verdade.

## Skins do Panteão Nórdico
- Odin — Pai de Todos
- Thor — Senhor do Trovão
- Freyja — Brilho de Fólkvangr
- Loki — Véu da Trapaça
- Týr — Juramento de Fenrir

As cinco skins são cosméticas, não concedem atributos e são compradas com gemas. A aparência 3D no personagem exige os modelos GLB finais e integração ao rig/material do personagem; a galeria atual não finge que esses modelos já estão no jogo.

## Integração e migrações
A migration `0012_equipment_progression.sql` cria apenas o inventário de equipamentos do reino e os espaços equipados. A ciência reutiliza `research`. A migration deve ser aplicada pelo pipeline de deploy depois de conciliar as migrations 0008–0011 das PRs anteriores.
