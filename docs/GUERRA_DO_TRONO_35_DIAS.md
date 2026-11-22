# Clash of Izzy — Guerra do Trono: regras originais com referência de gênero 4X

O evento usa as três fases contemporâneas de jogos de disputa de trono (Preparação, Disputa e Recuperação), sem copiar recursos visuais, nomes ou elementos exclusivos de Clash of Kings.

## Trono central em cada mapa
Cada mapa aberto tem uma construção original Trono Imperial em X=0, Z=0, visível na interface tática e no mapa 3D. Não é um ponto de coleta ou castelo. Ataques por marcha comum e reivindicações de aliança não podem atingir o trono.

O escudo de cada trono começa no instante em que o respectivo mapa é aberto e dura **35 dias inteiros**. Portanto, mapas 2 e 3 terão seus próprios 35 dias de proteção, ainda que o mapa 1 já esteja guerreando.

## Agenda automática (UTC, por mapa)
- Dia 0 até dia 34: **Escudo do Trono**, impossível atacá-lo.
- Dia 34 até dia 35: **Preparação**, o escudo continua ativo; as alianças podem reunir tropas.
- Dia 35, por oito horas: **Disputa**, o primeiro evento da Guerra do Trono.
- Após essas oito horas: **Recuperação** até o próximo ciclo.
- A partir daí, nova disputa a cada 7 dias, por oito horas, precedida do período de recuperação. Cronometragem e fases calculadas no Worker a partir de realm_openings.unlocked_at; o relógio do aparelho não concede permissões.

## Regras de disputa — primeira edição jogável
1. Apenas reinos com **Castelo nível 10 ou superior**, pertencentes a uma **aliança do mapa**, podem assaltar o trono.
2. Ataque por composição de **200 a 10.000 soldados** de nível 1. Força calculada por tipo de tropa, nunca por dados enviados pelo cliente.
3. A defesa inicial é de uma guarnição neutra. Depois de uma vitória, a força de quem ocupa o trono define a resistência dos cercos seguintes.
4. Uma vitória coloca a aliança no trono; vitória de outra aliança reinicia a contagem de ocupação.
5. **30 minutos de ocupação ininterrupta dentro das oito horas de disputa** coroam o rei e a aliança. Após a coroação, novos cercos da mesma edição são bloqueados.
6. Cada ataque sofre baixas: aproximadamente 12% das tropas lançadas em caso de vitória e 24% na derrota; estas baixas são debitadas no D1. Ataques repetidos pelo mesmo reino exigem intervalo de cinco minutos.
7. Um identificador único por ataque, conferência de tropas e atualização condicional de revisão do trono são aplicados na mesma transação D1 para impedir replay, tropas negativas e capturas simultâneas incorretas.
8. O vencedor fica registrado. O próximo evento não apaga a coroação anterior até que exista novo vencedor.
9. Evento não oferece gemas, Pix, dinheiro ou bônus ocultos nesta fase. Premiá-lo futuramente dependerá de balanceamento e testes antifraude.

## Segurança e integridade
- Tabelas novas: realm_thrones e throne_assaults na migration 0035.
- Política de abertura dos mapas pela migration 0034 permanece: um mapa aberto inicialmente; Mapa 2 aos 700 reinos registrados; Mapa 3 aos 1.000.
- Escudo, fases, registros de guerra e coroação são validados no servidor, não apenas na interface.
- O trono é representado como território reservado com chave royal_throne_ID, porque o banco legado limita territory_kind aos valores resource e castle. A API publica a classificação visual throne sem reconstruir a tabela.
- A presença e a batalha no Trono **não habilitam PvP geral entre castelos**, que continua sendo outra etapa do jogo.
- Heróis e dragões já existentes não são alterados por esta migration, e a guerra não concede buffs de rei automaticamente antes da auditoria de balanceamento.
- As alianças ainda não têm guerras conjuntas por rally PvP ao Trono nesta primeira edição. O evento já permite ataques individuais em nome da aliança, ocupação e coroação; reforços/rallies multi-jogador e ministérios reais serão etapas posteriores.
- Não divulgar “jogo ativo” sem D1 0035 remota, Worker pronto, APK comercial disponível e testes em dispositivo físico.

## Verificações para ativação
- CI do GitHub aprovada para o commit final, incluindo migrações em D1 local/preview e suíte de interface.
- No GitHub, executar deploy-cloudflare.yml de produção com plano pago, proteção de ambiente e backup Time Travel, incluindo migrations 0034 e 0035.
- Conferir GET /api/health com schema pronto e sem tabelas faltando.
- Conferir GET /api/throne/status?realm=1: shieldUntil exato, phase=shield/preparation/contest/recovery; não permitir ataque durante proteção.
- Simular em staging a passagem das fases e as regras de ataque, consumo de tropas, duas alianças rivais e coroação 30 min; verificar ausência de compras/recursos alterados.
- Confirmar que o APK Android comercial pode ser instalado pelo portal; itens e pagamentos precisam dos demais requisitos comerciais já documentados.

Referência de mecânica: atualizações oficiais de Clash of Kings no App Store (versões recentes), que usam Preparação, Disputa e Recuperação. A duração do escudo de 35 dias, a janela de oito horas e o tempo de ocupação de 30 minutos são **regras próprias escolhidas para o Clash of Izzy**.
