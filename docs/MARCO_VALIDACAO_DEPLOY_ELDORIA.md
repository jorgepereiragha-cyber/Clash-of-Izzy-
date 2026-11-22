# Marco de liberação — Clash of Izzy / Eldoria

Esta alteração não contém credenciais nem realiza alterações diretas no servidor. O commit com marcador `[READY-ELDORIA-RELEASE]` permite executar a **auditoria de disparo único** (`.github/workflows/liberar-eldoria-prod-apos-ci.yml`) após a CI desta revisão passar em `main`.

## Evidências verificadas antes do marco

- GitHub main: código completo com 70 identidades de heróis, 9 dragões, castelo 30 + VIP 7 e portal promocional separado.
- D1 Preview `6674c0ac-3636-4e57-bff8-23cf60ab9637`: migrações até `0030_dragons_master_mailbox.sql` aplicadas e 9 tabelas-chave verificadas, execução [#44974385689](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44974385689).
- D1 produção `7e63af59-d9ff-4159-a9cf-b02e35b92605`: última migração confirmada `0025`, 28 registros de players, 23 reinos, 0 contas, 0 compras e 0 ordens no momento da auditoria.
- Android build e emulador: testes aprovados nas execuções [#44974640935](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44974640935) e [#44974640900](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44974640900).
- Site: já apresenta divulgação e link futuro de APK; não há GitHub Release Android oficial.
- Billing Workers Paid: proprietário declarou usar Cloudflare pago; a API Billing retornou HTTP 403 por falta de permissão Billing Read. Esta declaração não substitui comprovação automática de custos.

## Política do disparo único

A rotina só solicita o workflow de deploy original após:
1. CI da `main` verde para o commit marcado.
2. Banco Preview confirmado com migração `0030`.
3. Banco de produção ainda na `0025` e contagens exatamente iguais às auditadas.
4. Bookmark do Time Travel acessível.
5. Verificação dos UUIDs separados.

O workflow original `deploy-cloudflare.yml` executa **os testes, o backup por bookmark, aplica as migrações D1 e publica o Worker**, respeitando o ambiente protegido `production`. A rota de saúde deve retornar `androidApiContract=eldoria-android-v1` após o deploy.

## Não autorizado por este marco

- Apagar ou resetar os 28 players e os 23 reinos legados.
- Ativar pagamento real, Mercado Pago ou Nubank sem conciliação.
- Criar um APK comercial assinado sem as chaves permanentes, que ainda não estão configuradas.
- Declarar que URLs diretas do jogo estão bloqueadas fora do APK sem atestação.
- Alegar que o lançamento comercial está concluído sem validação real de backend e instalação.

A migração `0026` altera as coordenadas dos castelos para o reino único. O bookmark de produção deve ser salvo **antes** das migrations, para recuperação controlada em caso de falha.
