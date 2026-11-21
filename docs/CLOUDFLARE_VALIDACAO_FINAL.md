# Auditoria remota e gates de produção

A rotina **Cloudflare Remote Audit (read-only)** é executada ao mesclar alterações de infraestrutura na `main`. Ela faz apenas GET em URLs HTTPS da Cloudflare e em endpoints públicos do jogo; não executa deploy, migrations, restore ou compras.

Itens verificados: saúde do Worker e D1, limites de autenticação, token da API, identidade distinta dos D1 de produção e Preview, existência do Time Travel. A leitura de assinatura Workers Paid via API de Billing é opcional; erro de permissão significa **não verificado**, nunca confirmação.

O fluxo de deploy de produção agora exige simultaneamente `confirm_paid_plan=true`, `confirm_production=true` e branch `main`, além da aprovação de ambiente `production`. A auditoria remota é repetida antes de qualquer escrita no D1. A confirmação do plano pago só deve ser marcada após verificar assinatura e limites em **Cloudflare Dashboard > Billing**.

O D1 Preview continua exigindo confirmação de que seus dados são descartáveis antes da aplicação remota de migrations. Essa confirmação não pode ser deduzida da configuração GitHub.

Nenhum dos novos arquivos ativa assinatura, executa migração ou publica o jogo automaticamente. Depois dos testes de staging, realizar testes de carga e Android físico antes da distribuição ampla.
