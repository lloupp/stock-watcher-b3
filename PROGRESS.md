# Stock Watcher B3 — Plano de Desenvolvimento Incremental

Este arquivo controla o progresso do desenvolvimento automatizado via cron job.
Cada fase é executada em uma execução do cron, com commit e push ao final.

## Status: Fase 3 concluída — próxima: Fase 4

## Fases

### Fase 1 — Layout e UI Base [CONCLUÍDO]
- Header com logo e título
- Seção de busca de ativos (input + botão)
- Grid de cards de ações (layout responsivo)
- Footer com info da API
- CSS completo: cards, tipografia, cores, responsividade
- Commit: "feat: layout e UI base"
- Concluído em 2026-07-31 — commit 9ecf2c6: header sticky com logo + status de mercado, busca com filtro client-side, grid responsivo (auto-fill), cards com ticker/nome/setor/preço/variação/volume/market cap, skeleton loading, footer créditos brapi.dev, modal base, CSS tema escuro completo com breakpoints mobile. API brapi.dev validada via curl (HTTP 200).

### Fase 2 — Cliente da API brapi.dev [CONCLUÍDO]
- Implementar js/api.js: fetchQuote(ticker), fetchAvailable(), fetchMultiple(tickers)
- Tratamento de erros e loading states
- Cache simples em memória (evitar requests duplicadas)
- Commit: "feat: cliente da API brapi.dev"
- Concluído em 2026-07-31 — commit 8f98864: fetchQuote/fetchMultiple/fetchAvailable/normalizeQuote prontos. fetchMultiple faz batching de 3 tickers (limite sem token) com fallback automático para requisições individuais e mapeamento de erro por-ticker via Map (não aborta o lote). Cache em memória com TTL 60s (cache hit confirmado em teste: 1ms na 2ª chamada). Suporte opcional a token via localStorage (brapi_token) — exportado setToken/hasToken, buildQuery injeta ?token= em todos os endpoints. app.js importa api.js e expõe window.SW para debug no console. README atualizado com doc de token e API de debug. Limitação real da API brapi.dev sem token documentada empiricamente: ~3-4 tickers distintos por IP. Testes: curl HTTP 200, node --check OK em todos os JS, JSON válido, teste de integração real confirmou cache e fallback.

### Fase 3 — Cards de Ações com Dados Reais [CONCLUÍDO]
- Renderizar cards com dados da API (preço, variação, volume, market cap)
- Cores: verde para alta, vermelho para baixa
- Logo da empresa (logourl da API)
- Loading spinner nos cards
- Auto-refresh a cada 60s
- Commit: "feat: cards de ações com dados reais"
- Concluído em 2026-07-31 — commit b42bb26: renderCard injeta preço (formatCurrency), variação (formatPercent com +/%), volume (formatVolume B/M/K) e market cap (formatMarketCap R$ T/B/M) da API via state.quotes. Cores: is-gain (verde) / is-loss (vermelho) / is-flat (cinza) aplicadas tanto no badge de variação quanto na borda lateral do card (::before). Logo da empresa via <img src=logourl> com fallback automático para a 1ª letra do ticker em caso de erro de carga. Spinner discreto no canto superior direito do card (classe is-loading no primeiro fetch). refreshQuotes() chama fetchMultiple com batching de 3 e popula state.quotes Map; updateCardsWithData() atualiza DOM sem reconstruir os cards (perf em refreshes). Auto-refresh a cada 60s via setInterval + clearCache (força nova requisição ignorando cache TTL). Indicador de refresh no header (status-dot vira spinner accent). Modal detalhado expandido: preço grande, variação com absoluto, grid 2x2 com abertura/fech.anterior/máx/mín/volume/mcap/faixa 52sem/P/L, botão de fechar injetado via delegação. utils.js ampliado com formatMarketCap + changeClass + null-safety em formatVolume para evitar NaN em cotações incompletas. CSS: @keyframes spin/spin-fast, .card.is-loading::after spinner, .card__logo img sizing, modal grid/hint/close. Testes: node --check OK em todos os 5 JS, JSON válido, testes unitários de utils.js (formatação, null-safety, escalas de mcap, classes de variação) todos passaram, curl confirmou API retornando logourl real (https://icons.brapi.dev/icons/VALE3.svg HTTP 200) e dados completos (price/change%/volume/mcap) para lotes de 3 tickers. Limitação real sem token persiste (IP esgotou o limite gratuito após testes das fases 1-3) — app lida graciosamente com erro mostrando placeholders "—" e spinner.

### Fase 4 — Watchlist com localStorage [PENDENTE]
- Botão de adicionar/remover da watchlist
- Persistência em localStorage
- Carregar watchlist ao abrir o app
- Editar watchlist (remover ativos)
- Commit: "feat: watchlist com localStorage"

### Fase 5 — Gráficos de Candlestick [PENDENTE]
- Implementar js/charts.js: min chart em Canvas
- Gráfico de linha com histórico de preço (se API suportar)
- Gráfico sparkline nos cards
- Modal com gráfico detalhado ao clicar no card
- Commit: "feat: gráficos em canvas"

### Fase 6 — Busca e Filtros [PENDENTE]
- Busca de ativos por nome ou ticker
- Filtro por setor
- Filtro por variação (gainers/losers)
- Ordenação (por preço, variação, volume, nome)
- Commit: "feat: busca e filtros"

### Fase 7 — Polimento e Extras [PENDENTE]
- Animações de transição nos cards
- Indicador de mercado aberto/fechado
- Toast notifications para ações
- Modal de detalhes do ativo (P/E, 52-week range, etc)
- Validação: abrir no navegador, testar todas as features
- Atualizar README com截图 e instruções
- Commit: "feat: polimento e extras"

### Fase 8 — Deploy no GitHub Pages [PENDENTE]
- Configurar GitHub Pages (gh-pages branch ou settings)
- Verificar que o app funciona na URL pública
- Adicionar badge de URL no README
- Commit: "deploy: GitHub Pages"

## Regras do cron
1. Ler este arquivo para saber qual fase executar
2. Implementar a fase completa
3. Testar (abrir o HTML, verificar sintaxe JS, validar JSON)
4. Commit + push
5. Atualizar o status desta checklist
6. Reportar o que foi feito
