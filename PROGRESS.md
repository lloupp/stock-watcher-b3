# Stock Watcher B3 — Plano de Desenvolvimento Incremental

Este arquivo controla o progresso do desenvolvimento automatizado via cron job.
Cada fase é executada em uma execução do cron, com commit e push ao final.

## Status: Fase 2 concluída — próxima: Fase 3

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

### Fase 3 — Cards de Ações com Dados Reais [PENDENTE]
- Renderizar cards com dados da API (preço, variação, volume, market cap)
- Cores: verde para alta, vermelho para baixa
- Logo da empresa (logourl da API)
- Loading spinner nos cards
- Auto-refresh a cada 60s
- Commit: "feat: cards de ações com dados reais"

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
