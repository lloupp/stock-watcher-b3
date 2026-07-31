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
│   ├── watchlist.js     — gestão de watchlist
│   └── utils.js         — utilidades (formatação, helpers)
├── data/
│   └── default-stocks.json — lista de ativos populares da B3
└── README.md
```

## Como usar

Abra `index.html` no navegador. Pronto.

## Desenvolvimento

Projeto construído incrementalmente via cron job de desenvolvimento automatizado.

## Licença

MIT
