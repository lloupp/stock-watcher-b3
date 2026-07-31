# Stock Watcher B3 — Plano de Desenvolvimento Incremental

Este arquivo controla o progresso do desenvolvimento automatizado via cron job.
Cada fase é executada em uma execução do cron, com commit e push ao final.

## Status: Fase 6 concluída — próxima: Fase 7

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

### Fase 4 — Watchlist com localStorage [CONCLUÍDO]
- Botão de adicionar/remover da watchlist
- Persistência em localStorage
- Carregar watchlist ao abrir o app
- Editar watchlist (remover ativos)
- Commit: "feat: watchlist com localStorage"
- Concluído em 2026-07-31 — commit e64ba34: módulo js/watchlist.js (puro em storage, sem tocar na API/DOM) com load/add/remove/toggle/has/clear/replace/size, normalização uppercase+trim+dedup preservando ordem de inserção, acesso seguro ao localStorage (graceful sem storage SSR/proxy, nunca lança). app.js integra: state.watchlist + state.view ('popular'|'watchlist'); refreshQuotes() busca cotações dos tickers da watchlist além dos defaults; getDisplayedStocks() retorna stocks ou watchlist conforme a view, e tickers guardados não presentes no default-stocks usam metadados do quote + heurística de setor (inferSector) para preencher nome/setor; renderCard() ganhou botão <button class='card__star'> ★/☆ absoluto no canto superior direito com aria-pressed/label/title e classe is-active derivada de hasInWatchlist(); handleWatchlistToggle() alterna + atualiza só a estrela do card (sem re-render) e na view watchlist anima is-leaving (fade+scale 0.18s) antes de re-render; switchView() troca abas Populares/Watchlist (role=tablist ARIA, navegação por setas esquerda/direita), controla visibilidade da toolbar e dispara refreshQuotes(); handleAddToWatchlist() aceita múltiplos tickers (separados por vírgula OU espaço, ex: "PETR4, VALE3, ABEV3") com replaceWatchlist que respeita ordem existente+novos no final; handleClearWatchlist() com window.confirm() antes de limpar; listener storage sincroniza a watchlist entre abas do navegador; empty-state contextual com mensagens específicas (watchlist vazia com dica, busca sem resultado na watchlist, busca geral, erro de carregamento); updateGridMeta() contextualiza título ("Minha watchlist" vs "Ações populares"); window.SW.watchlist expõe a API no console para debug (add/remove/toggle/has/load/size/replace/clear). index.html: tabs (role=tablist/tab/tablist com aria-selected) com badge de count de ativos guardados, toolbar de adicionar+limpar (hidden por padrão, só visível na view watchlist), empty-state com span.empty-title + span.empty-sub para mensagens contextuais. CSS: .main__tabs/.main__tab (segmented control, accent no ativo), .tab-badge (contador), .watchlist-toolbar/.watchlist-add/.watchlist-add__btn/.watchlist-clear (input com ícone ＋ + botão Adicionar + botão Limpar com hover vermelho), .card__star (★ toggle, hover scale 1.12, is-active accent, desloca p/ canto quando card is-loading para não colidir com o spinner), .is-leaving (fade+scale), .empty-title/.empty-sub (subtítulo centralizado), responsividade mobile (tabs compactas, toolbar empilha). README atualizado com documentação da watchlist (3 formas de adicionar: estrela no card, botão Adicionar, console) + API completa window.SW.watchlist. Testes: node --check OK em todos os 4 JS (app, api, utils, watchlist), JSON válido (20 ativos), teste lógico do watchlist.js com mock localStorage passou TODAS as operações (inicia vazio, add normaliza 'vale3'→'VALE3', ignora dup 'PETR4', has() detecta normalizado, toggle adiciona depois remove, remove funciona, replace dedup ['VALE3','ABEV3','VALE3']→['VALE3','ABEV3'], clear zera), API brapi.dev HTTP 200 com PETR4 price=42.84. Limitação real sem token persiste mas a app lida graciosamente (placeholders "—" e spinner) — usuário pode adicionar qualquer ticker à watchlist; se exceder ~3-4/IP a cotação fica pending até reset do limite.

### Fase 5 — Gráficos de Candlestick [CONCLUÍDO]
- Implementar js/charts.js: min chart em Canvas
- Gráfico de linha com histórico de preço (se API suportar)
- Gráfico sparkline nos cards
- Modal com gráfico detalhado ao clicar no card
- Commit: "feat: gráficos em canvas"
- Concluído em 2026-07-31 — commit b6ca332: módulo js/charts.js (Canvas puro, zero dependências, HiDPI-aware via devicePixelRatio). drawSparkline (linha + gradiente sob a curva, cor por tendência verde/vermelho, ponto final destacado, ResizeObserver). drawChart (candlestick ou linha, eixos Y preço/R$ + eixos X datas, grid horizontal 5 linhas, barras de volume coloridas por candle, tooltip OHLCV interativo via hover com linha vertical dashed e caixa arredondada, roundRect helper). getChartPointAt (mapeia mouseX→índice do candle). formatShortDate (dd/mmm em pt-BR). api.js ganhou fetchHistory(ticker, range, interval) usando historicalDataPrice do endpoint /quote com cache dedicado histCache (TTL 5min) + clearHistoryCache. Ranges/intervalos válidos descobertos empiricamente: ranges=[1d,2d,5d,7d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max], intervals=[1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo]. app.js integrado: state.history Map + state.modalChart + state.sparklineObservers. refreshSparklines() busca histórico curto (5d,1d) em batches de 3 após refreshQuotes (não-bloqueante). renderCards() chama teardownSparklineObservers() + drawAllSparklines() para reconstruir. updateCardsWithData() desenha sparkline quando histórico chega. Modal reescrito: openModal gera seção com <canvas> + botões de tipo (📊 candlestick / 📈 linha) e range (5d/1m/3m/6m/1a). initModalChart() instancia state.modalChart, binda controles (click→updateChartControlButtons + chartRender/chartLoad), hover→getChartPointAt→tooltip, ResizeObserver para redimensionamento. chartLoad() busca fetchHistory e atualiza state.history. chartRender() com rAF debouncing. closeModal() desconecta ResizeObserver, cancela rAF e limpa state.modalChart. Auto-refresh (60s) agora também limpa clearHistoryCache. window.SW expõe fetchHistory, clearHistoryCache, drawSparkline, drawChart, refreshSparklines. CSS: .card__spark (36px, opacity transition), .modal__chart-controls (botões pill is-active accent), .modal__chart-wrap (280px fixa, cursor crosshair), .modal__chart-loading overlay, media queries mobile (220px height, grid 1-col). README atualizado com seção 'Gráficos em Canvas (Fase 5)'. Testes: node --check OK em todos os 5 JS, JSON válido (20 ativos), lógica de sparkline (minMax com padding 6%, formatShortDate, tendência) verificada via Node, API brapi.dev confirmada via curl (PETR4 range=5d→4 pontos OHLCV, range=1mo→22 pontos, range=1y confirmado, historicalDataPrice com date/open/high/low/close/volume/adjustedClose).

### Fase 6 — Busca e Filtros [CONCLUÍDO]
- Busca de ativos por nome ou ticker
- Filtro por setor
- Filtro por variação (gainers/losers)
- Ordenação (por preço, variação, volume, nome)
- Commit: "feat: busca e filtros"
- Concluído em 2026-07-31 — commit 698ad52: novo módulo js/filters.js (lógica pura: applyFilters, collectSectors, countVariations, SORT_KEYS, getNumeric — não toca no DOM/estado, recebe Map<ticker,quote> opcional para valores de mercado). Busca por nome/ticker/setor (case-insensitive) já existente foi mantida e integrada aos novos critérios. Filtro por setor via <select> populado dinamicamente conforme a view ativa (collectSectors ordena em pt-BR, exclui "—"). Filtro por variação via chips pill "Todos/Altas/Baixas" com badges de contagem (countVariations), estados gain=verde/loss=vermelho, toggle (clicar novamente no ativo volta para "Todos") e botão desabilita quando count=0. Ordenação via <select> com 7 chaves: padrão, ticker asc, nome asc, preço/variação/volume/market cap desc — ativos sem quote vão para o final em ordenação numérica (null-safety). Botão "Limpar filtros" aparece quando qualquer critério está ativo (busca+filtros). Barra .filters sticky sob o header (top:70px desktop, 64px mobile) com classe is-filtering (borda accent inferior). switchView resetar todos os filtros ao trocar de view (setores mudam entre populares/watchlist). refreshQuotes re-renderiza o grid quando há filtros de variação ou ordenação por valor de mercado ativos (cotações podem mudar membership/ordem). updateEmptyState contextualiza estado vazio por filtros ativos (mensagem "Nenhum ativo corresponde aos filtros ativos"). index.html: seção .filters com groups role=group, chips com data-variation, selects com ícones à esquerda (🏭/↕). CSS: chips pill 18px radius, selects com appearance:none + seta SVG inline (data:image/svg+xml), option background=--bg-card, reset com hover vermelho, responsividade mobile (empilha em 480px, full-width no mobile). window.SW.filters expõe applyFilters/collectSectors/countVariations/SORT_KEYS/reset para debug no console. Testes: 24 testes unitários cobrindo filtros isolados+combinados, ordenação asc/desc completa, null-safety de ativos sem quote em ordenação e em gainers/losers, collectSectors ordenado pt-BR — TODOS PASSANDO. node --check OK em todos os 6 JS. JSON válido. curl confirmou API brapi.dev respondendo para single ticker (HTTP 200, PETR4 preço real 43.18) — limite por IP esgotado para lotes de 3 (HTTP 401, comportamento já documentado e tratado com fallback automático herdado da Fase 2).

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
