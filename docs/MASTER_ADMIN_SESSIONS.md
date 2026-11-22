# Sessões administrativas — revogação no servidor

O token Master expira em 60 minutos. Cada login emite um `jti` aleatório de 32 caracteres e o Worker verifica se o identificador está revogado no D1, inclusive na rota `/api/admin/health`. Tokens administrativos antigos sem `jti` deixam de funcionar e exigem novo login.

O botão Sair envia `POST /api/admin/logout` com o token. Após revogação no servidor, tentativas de reutilizar o token retornam HTTP 401. Falhas de rede ainda limpam a sessão local, mas a UI informa explicitamente que a revogação remota não pôde ser confirmada. O job agendado apaga somente identificadores revogados já expirados.

A migração `0046_admin_session_revocations.sql` é aditiva e **não toca em contas ou sessões de jogadores**. Aplicar somente após homologação D1 Preview e pelo deploy protegido. Nenhum secret é gravado no banco: apenas o identificador aleatório, data de expiração e data de revogação.

Este código não foi implantado; requer teste de login/logout com duas abas e token expirado, testes automatizados e plano de rollback sem apagar os registros de revogação.
