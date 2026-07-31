# 📈 Stock Watcher B3

Dashboard web para acompanhar ações da B3 em tempo real. 100% client-side, sem backend.

## Recursos

- ⏱️ **Cotações em tempo real** via [brapi.dev](https://brapi.dev) (API gratuita, sem token)
- 📊 **Gráficos de candlestick** em Canvas puro
- ⭐ **Watchlist personalizável** salva no navegador (localStorage)
- 📈 **Variação diária** com cores (verde/vermelho)
- 🔍 **Busca de ativos** disponíveis na B3
- 📱 **Responsivo** — funciona no celular, tablet e desktop
- 🌙 **Tema escuro** nativo
- 💾 **Offline-first** — funciona sem internet (dados em cache)

## Tech Stack

- HTML5 + CSS3 (tema escuro, sem frameworks)
- JavaScript vanilla (sem build, sem dependências)
- [brapi.dev](https://brapi.dev) API (gratuita, sem auth)
- Canvas API para gráficos
- localStorage para persistência

## Estrutura

```
stock-watcher-b3/
├── index.html           — página principal
├── css/
│   └── style.css        — estilos + tema escuro
├── js/
│   ├── app.js           — lógica principal
│   ├── api.js           — cliente da API brapi
│   ├── charts.js        — gráficos em Canvas
│   ├── filters.js       — busca, filtros e ordenação
│   ├── watchlist.js     — gestão de watchlist (localStorage)
│   ├── toast.js         — notificações toast
│   └── utils.js         — utilidades (formatação, helpers)
├── data/
│   └── default-stocks.json — lista de ativos populares da B3
└── README.md
```

## Como usar

Abra `index.html` no navegador. Pronto.

### Token da API brapi.dev (opcional)

A [brapi.dev](https://brapi.dev) funciona sem token, mas sem ele o limite
gratuito é de ~3-4 tickers distintos por IP. Para destravar o app completo
(todos os ativos, 100 req/min, batches de até 20 tickers), crie uma conta
gratuita em https://brapi.dev e configure o token no console do navegador:

```js
SW.setApiToken('seu_token_aqui');
```

O token é salvo no `localStorage` e usado automaticamente em todas as
requisições. Para limpar: `SW.clearCache()` após remover com
`localStorage.removeItem('brapi_token')`.

### Gráficos em Canvas (Fase 5)

O app usa Canvas puro (sem bibliotecas externas) para dois tipos de gráfico:

**Sparkline nos cards** — mini-gráfico de linha no rodapé de cada card,
mostrando os últimos 5 dias úteis de fechamento. A cor (verde/vermelho)
reflete a tendência do período. Atualiza junto com as cotações a cada 60s.

**Gráfico detalhado no modal** — ao clicar num card, abre um modal com:

- **Candlestick** (padrão) ou **linha** — alterne com os botões 📊/📈
- **Períodos**: 5d, 1m, 3m, 6m, 1a — o gráfico refaz a busca ao trocar
- **Volume** — barras na parte inferior, coloridas conforme o candle
- **Eixos** — preço (R$) à esquerda, datas na base
- **Tooltip interativo** — passe o mouse sobre o gráfico para ver
  data, abertura, máxima, mínima, fechamento e volume do candle
- **Responsivo** — redesenha no resize (ResizeObserver) e HiDPI-aware

Histórico obtido via parâmetros `range` e `interval` do endpoint `/quote`
da brapi.dev (campo `historicalDataPrice`), com cache de 5min.

### Polimento e Extras (Fase 7)

**Animação de entrada dos cards** — ao renderizar o grid (troca de view,
busca, filtros), os cards aparecem em cascata com um leve *fade + slide-up*
escalonado (stagger). A animação respeita `prefers-reduced-motion` (desativada
para quem prefere menos movimento).

**Indicador de mercado aberto/fechado** — no header, um dot colorido mostra
se a B3 está em pregão (verde, pulsante) ou fechada (vermelho, estático). O
horário de pregão é 10h–17h (Brasil/São Paulo), dias úteis. O status é
reavaliado a cada minuto, então o indicador muda sozinho se o app ficar
aberto.

**Toast notifications** — feedback visual discreto no canto inferior direito
para ações do usuário:

- ✅ Adicionar ativo à watchlist
- ℹ️ Remover ativo da watchlist
- ⚠️ Ticker já presente na watchlist
- ✕ Falha ao carregar cotações
- ℹ️ Watchlist limpa

Os toasts são auto-dismiss (4–6s), empilháveis, e respeitam
`prefers-reduced-motion`. Cada um tem um botão ✕ para fechar manualmente.

**Modal de detalhes** — clicar num card abre o modal com:

- Preço grande + variação (com valor absoluto)
- Grid 2×2: abertura, fechamento anterior, máx/mín do dia, volume,
  market cap, faixa de 52 semanas, P/L
- Gráfico de candlestick/linha com controles de período (5d–1a)
- Tooltip interativo (hover) com OHLCV

### API de debug

O objeto `window.SW` expõe (no console do navegador):

```js
SW.fetchQuote('PETR4')              // cotação de um ativo
SW.fetchMultiple(['PETR4','VALE3']) // cotação de N ativos (batching)
SW.fetchAvailable('PETR')           // lista de tickers disponíveis
SW.hasToken()                        // há token configurado?
SW.getCacheState()                   // estado do cache em memória
SW.state                             // estado interno do app
```

### Watchlist (localStorage)

A watchlist é persistida no `localStorage` (`sw_watchlist`), então ela
sobrevive a recarregamentos. Você pode adicionar ativos de três formas:

1. **Estrela (★/☆) no card** — clique/batida/teclado para alternar
2. **Botão "Adicionar"** na aba Watchlist — digite um ou mais tickers
   (separados por vírgula ou espaço), ex: `PETR4, VALE3, ABEV3`
3. **Console** via `window.SW.watchlist`:

```js
SW.watchlist.add('PETR4')           // adiciona
SW.watchlist.remove('PETR4')        // remove
SW.watchlist.toggle('PETR4')        // alterna → { list, added }
SW.watchlist.has('PETR4')            // true/false
SW.watchlist.load()                  // carrega array guardado
SW.watchlist.size()                  // número de ativos
SW.watchlist.replace(['PETR4','VALE3']) // sobrescreve (com dedup)
SW.watchlist.clear()                 // limpa todos
```

> Tickers são sempre guardados em uppercase e sem duplicatas. A ordem
> reflete a ordem em que foram adicionados.

## Desenvolvimento

Projeto construído incrementalmente via cron job de desenvolvimento automatizado.

## Licença

MIT
