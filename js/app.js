// app.js — Lógica principal do Stock Watcher B3
// Fase 1: Layout e UI base, grid de cards, busca client-side sobre default-stocks
// Fase 2: importa o cliente da API brapi.dev
// Fase 3: renderiza cards com dados reais, logo, cores, auto-refresh a cada 60s
// Fase 4: watchlist persistida em localStorage, tabs Populares/Watchlist,
//          botão ⭐ nos cards, adicionar/remover, toolbar de importação rápida

import { formatCurrency, formatVolume, formatPercent, formatMarketCap, changeClass } from './utils.js';
import {
  fetchQuote, fetchMultiple, fetchAvailable,
  setToken, hasToken, clearCache, getCacheState,
} from './api.js';
import {
  loadWatchlist, addToWatchlist, removeFromWatchlist,
  toggleWatchlist, hasInWatchlist, clearWatchlist, watchlistSize, replaceWatchlist,
} from './watchlist.js';

/* ----------------------------------------------------------------
   Configuração
   ---------------------------------------------------------------- */
// Intervalo de auto-refresh (ms). 60s bate com o TTL do cache da API.
const REFRESH_INTERVAL = 60_000;

/* ----------------------------------------------------------------
   Estado da aplicação
   ---------------------------------------------------------------- */
const state = {
  stocks: [],          // lista de ativos (default-stocks.json)
  watchlist: [],       // tickers guardados pelo usuário (array de strings)
  view: 'popular',     // view ativa: 'popular' | 'watchlist'
  query: '',           // termo de busca atual
  quotes: new Map(),    // cache de cotações da API (ticker → normalized quote)
  loading: false,      // carregando cotações?
  refreshTimer: null,   // handle do setInterval de auto-refresh
};

/* ----------------------------------------------------------------
   Helpers DOM
   ---------------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  cardsGrid: $('#cards-grid'),
  emptyState: $('#empty-state'),
  gridTitle: $('#grid-title'),
  gridMeta: $('#grid-meta'),
  searchInput: $('#search-input'),
  searchBtn: $('#search-btn'),
  searchClear: $('#search-clear'),
  marketStatus: $('#market-status'),
  modal: $('#modal'),
  modalContent: $('#modal-content'),
  // Fase 4: tabs e toolbar de watchlist
  viewTabs: $('#view-tabs'),
  watchlistCount: $('#watchlist-count'),
  watchlistToolbar: $('#watchlist-toolbar'),
  watchlistInput: $('#watchlist-input'),
  watchlistAddBtn: $('#watchlist-add-btn'),
  watchlistClear: $('#watchlist-clear'),
};

/* ----------------------------------------------------------------
   Inicialização
   ---------------------------------------------------------------- */
async function init() {
  console.log('Stock Watcher B3 — inicializando... (Fase 4: watchlist com localStorage)');
  console.log(hasToken()
    ? '[brapi] Token configurado no localStorage (limites completos).'
    : '[brapi] Sem token no localStorage — limite gratuito: ~3-4 tickers/IP. Use setApiToken() no console para configurar.');

  // Fase 4: carrega watchlist persistida ao abrir o app
  state.watchlist = loadWatchlist();
  console.log(`[watchlist] Carregados ${state.watchlist.length} ativo(s): ${state.watchlist.join(', ') || '—'}`);

  // Expõe API de depuração no window (acessível via console do navegador)
  window.SW = {
    fetchQuote, fetchMultiple, fetchAvailable,
    setApiToken: setToken, hasToken, clearCache, getCacheState, state,
    refreshNow: refreshQuotes,
    // Fase 4: API de watchlist no console
    watchlist: {
      load: loadWatchlist, add: addToWatchlist, remove: removeFromWatchlist,
      toggle: toggleWatchlist, has: hasInWatchlist, clear: clearWatchlist,
      size: watchlistSize, replace: replaceWatchlist,
    },
  };

  bindEvents();
  renderMarketStatus();
  updateWatchlistBadge();
  updateWatchlistToolbar();
  await loadDefaultStocks();
  renderCards();
  // Fase 3: busca cotações reais para preencher os cards
  // Fase 4: inclui tickers da watchlist que não estão nos defaults
  await refreshQuotes();
  startAutoRefresh();
}

/* ----------------------------------------------------------------
   Carrega cotações reais da API e atualiza os cards.
   Usa fetchMultiple (com batching) para respeitar o limite sem token.
   Fase 4: também busca cotações de tickers da watchlist que não
   estão no default-stocks.json (para mostrar preço mesmo sem metadata).
   ---------------------------------------------------------------- */
async function refreshQuotes() {
  // Lista de ativos exibidos depende da view ativa
  const displayed = getDisplayedStocks();
  if (displayed.length === 0) return;
  state.loading = true;
  updateRefreshIndicator(true);

  // Combina tickers exibidos + watchlist (para manter cards da watchlist frescos
  // mesmo quando o usuário está na aba Populares).
  const displayTickers = displayed.map((s) => s.ticker);
  const watchlistTickers = state.watchlist.filter(
    (t) => !displayTickers.includes(t)
  );
  // Se estamos na view "watchlist", os tickers já estão em displayTickers;
  // só adiciona extras se houver watchlist fora do display.
  const allTickers = state.view === 'watchlist'
    ? displayTickers
    : [...displayTickers, ...watchlistTickers];

  try {
    const map = await fetchMultiple(allTickers);
    // Mescla no state.quotes Map
    for (const [ticker, data] of map.entries()) {
      if (data && !data.__error && !data.__loading) {
        state.quotes.set(ticker, data);
      }
    }
  } catch (err) {
    console.error('Falha ao carregar cotações:', err);
  } finally {
    state.loading = false;
    updateRefreshIndicator(false);
    // Re-renderiza apenas os valores (sem reconstruir todo o DOM)
    updateCardsWithData();
    // Atualiza o título/meta caso a view seja watchlist e dados mudaram
    if (state.view === 'watchlist') updateGridMeta(getDisplayedStocks().length);
  }
}

/* ----------------------------------------------------------------
   Inicia auto-refresh a cada REFRESH_INTERVAL (60s).
   ---------------------------------------------------------------- */
function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    // clearCache força nova requisição (ignora o cache de 60s)
    clearCache();
    refreshQuotes();
  }, REFRESH_INTERVAL);
  console.log(`[auto-refresh] Configurado para ${REFRESH_INTERVAL / 1000}s.`);
}

/* ----------------------------------------------------------------
   Atualiza o indicador de refresh no header (spinner discreto)
   ---------------------------------------------------------------- */
function updateRefreshIndicator(active) {
  const wrap = els.marketStatus;
  wrap.classList.toggle('is-refreshing', active);
}

/* ----------------------------------------------------------------
   Carrega a lista de ativos padrão
   ---------------------------------------------------------------- */
async function loadDefaultStocks() {
  // Skeletons enquanto carrega/default (define o layout da Fase 1)
  renderSkeletons(8);

  try {
    const res = await fetch('data/default-stocks.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.stocks = await res.json();
  } catch (err) {
    console.error('Falha ao carregar default-stocks.json:', err);
    els.cardsGrid.innerHTML = '';
    els.emptyState.hidden = false;
    const t = els.emptyState.querySelector('.empty-title');
    if (t) t.textContent = 'Erro ao carregar lista de ativos.';
    const sub = els.emptyState.querySelector('.empty-sub');
    if (sub) sub.textContent = `Detalhe: ${err.message || err}`;
    state.stocks = [];
  }
}

/* ----------------------------------------------------------------
   Renderização dos cards
   Fase 1: layout esqueleto (ticker, nome, setor, placeholders).
   Fase 3: injeta dados reais da API quando disponíveis em state.quotes;
   caso contrário mostra "—" com spinner enquanto carrega.
   Fase 4: respeita a view ativa (popular | watchlist); botão ⭐ no card.
   ---------------------------------------------------------------- */
function getDisplayedStocks() {
  if (state.view === 'watchlist') {
    // Mostra tickers da watchlist, mesmo que não estejam em default-stocks.
    // Tenta usar metadados (nome/setor) de state.stocks quando disponível.
    return state.watchlist.map((ticker) => {
      const known = state.stocks.find((s) => s.ticker === ticker);
      if (known) return known;
      // Ticker guardado mas não no default: usa dados do quote se houver,
      // senão placeholder genérico.
      const q = state.quotes.get(ticker);
      return {
        ticker,
        name: q?.shortName || q?.longName || ticker,
        sector: q ? inferSector(q) : '—',
      };
    });
  }
  // View 'popular' → default stocks
  return state.stocks;
}

// Heurística simples de setor a partir do nome/longName (usado quando o
// ticker da watchlist não está em default-stocks.json). Não é essencial —
// só melhora o display do badge de setor.
function inferSector(quote) {
  const n = (quote.longName || quote.shortName || '').toLowerCase();
  if (!n) return '—';
  if (/banco|itau|bradesco|bank/.test(n)) return 'Bancos';
  if (/petrol|petro|oil/.test(n)) return 'Petróleo';
  if (/miner|mining/.test(n)) return 'Mineração';
  if (/energ|electric/.test(n)) return 'Energia';
  if (/pharma|drug|medic/.test(n)) return 'Farmacêutico';
  if (/steel|sider/.test(n)) return 'Siderurgia';
  if (/retail|varejo|magazine/.test(n)) return 'Varejo';
  if (/beverag|drink|cervej/.test(n)) return 'Bebidas';
  return '—';
}

function renderCards() {
  const displayed = getDisplayedStocks();
  const filtered = filterStocks(displayed, state.query);

  if (filtered.length === 0) {
    els.cardsGrid.innerHTML = '';
    els.emptyState.hidden = false;
    updateEmptyState();
    updateGridMeta(0);
    return;
  }

  els.emptyState.hidden = true;

  els.cardsGrid.innerHTML = filtered
    .map((s) => renderCard(s))
    .join('');

  updateGridMeta(filtered.length);
}

function renderCard(stock) {
  const { ticker, name, sector } = stock;
  const quote = state.quotes.get(ticker);
  const isFirstLoad = state.loading && !quote;

  // Logo: usa logourl da API se disponível, senão a primeira letra do ticker
  const logoHtml = quote?.logourl
    ? `<img src="${escapeAttr(quote.logourl)}" alt="" loading="lazy"
        onerror="this.style.display='none';this.parentElement.textContent='${ticker.charAt(0)}'">`
    : ticker.charAt(0);

  // Valores reais ou placeholder
  const priceStr = quote?.price != null ? formatCurrency(quote.price) : '—';
  const changeStr = quote?.changePercent != null
    ? formatPercent(quote.changePercent)
    : '—';
  const cls = quote?.changePercent != null ? changeClass(quote.changePercent) : 'is-flat';
  const volStr = quote?.volume != null ? formatVolume(quote.volume) : '—';
  const mcapStr = quote?.marketCap != null ? formatMarketCap(quote.marketCap) : '—';

  // Classe do card (borda colorida) — gain/loss/flat
  const cardCls = quote?.changePercent != null
    ? changeClass(quote.changePercent).replace('is-', 'is-')
    : '';

  // Fase 4: botão de adicionar/remover da watchlist (estrela)
  const inWatch = hasInWatchlist(ticker);
  const starLabel = inWatch ? 'Remover da watchlist' : 'Adicionar à watchlist';

  return `
    <article class="card ${cardCls}${isFirstLoad ? ' is-loading' : ''}" data-ticker="${ticker}" role="button" tabindex="0" aria-label="Detalhes de ${ticker}">
      <button class="card__star ${inWatch ? 'is-active' : ''}" data-watch-toggle="${ticker}" type="button" aria-pressed="${inWatch}" aria-label="${starLabel}" title="${starLabel}">
        <span aria-hidden="true">${inWatch ? '★' : '☆'}</span>
      </button>
      <div class="card__top">
        <div class="card__logo" data-logo="${ticker}">${logoHtml}</div>
        <div class="card__info">
          <div class="card__ticker">${ticker}</div>
          <div class="card__name">${escapeHtml(quote?.longName || name)}</div>
        </div>
        <span class="card__sector">${escapeHtml(sector)}</span>
      </div>
      <div class="card__price">
        <div class="card__price-value" data-price="${ticker}">${priceStr}</div>
        <div class="card__change ${cls}" data-change="${ticker}">${changeStr}</div>
      </div>
      <div class="card__meta">
        <span>
          <span class="card__meta-label">Volume</span>
          <b data-volume="${ticker}">${volStr}</b>
        </span>
        <span>
          <span class="card__meta-label">Market cap</span>
          <b data-mcap="${ticker}">${mcapStr}</b>
        </span>
      </div>
    </article>
  `;
}

/* ----------------------------------------------------------------
   Atualiza os valores dinâmicos dos cards no DOM (sem reconstruir).
   Atualiza preço, variação, volume, market cap, logo e classes de cor.
   ---------------------------------------------------------------- */
function updateCardsWithData() {
  for (const [ticker, quote] of state.quotes.entries()) {
    const card = els.cardsGrid.querySelector(`.card[data-ticker="${ticker}"]`);
    if (!card) continue;

    // Remove estado de loading
    card.classList.remove('is-loading');

    // Preço
    const priceEl = card.querySelector('[data-price]');
    if (priceEl && quote.price != null) {
      priceEl.textContent = formatCurrency(quote.price);
      priceEl.classList.remove('is-stale');
    }

    // Variação + cor do card
    const chgEl = card.querySelector('[data-change]');
    if (chgEl) {
      if (quote.changePercent != null) {
        chgEl.textContent = formatPercent(quote.changePercent);
        const cls = changeClass(quote.changePercent);
        chgEl.className = `card__change ${cls}`;
      } else {
        chgEl.textContent = '—';
        chgEl.className = 'card__change is-flat';
      }
    }

    // Borda colorida do card
    card.classList.remove('is-gain', 'is-loss');
    if (quote.changePercent != null) {
      const cc = changeClass(quote.changePercent);
      if (cc !== 'is-flat') card.classList.add(cc);
    }

    // Volume
    const volEl = card.querySelector('[data-volume]');
    if (volEl && quote.volume != null) {
      volEl.textContent = formatVolume(quote.volume);
    }

    // Market cap
    const mcapEl = card.querySelector('[data-mcap]');
    if (mcapEl && quote.marketCap != null) {
      mcapEl.textContent = formatMarketCap(quote.marketCap);
    }

    // Logo (troca letra por imagem se ainda não carregou)
    const logoEl = card.querySelector('[data-logo]');
    if (logoEl && quote.logourl && !logoEl.querySelector('img')) {
      logoEl.innerHTML = `<img src="${escapeAttr(quote.logourl)}" alt="" loading="lazy"
        onerror="this.style.display='none';this.parentElement.textContent='${ticker.charAt(0)}'">`;
    }
  }
}

/* ----------------------------------------------------------------
   Skeletons (loading)
   ---------------------------------------------------------------- */
function renderSkeletons(count) {
  els.cardsGrid.innerHTML = Array.from({ length: count })
    .map(() => `
      <div class="skeleton-card">
        <div class="skeleton__top">
          <div class="skeleton skeleton__avatar"></div>
          <div>
            <div class="skeleton skeleton__line"></div>
            <div class="skeleton skeleton__line--sm"></div>
          </div>
        </div>
        <div class="skeleton skeleton__price"></div>
        <div class="skeleton skeleton__line--sm"></div>
      </div>
    `)
    .join('');
}

/* ----------------------------------------------------------------
   Filtro de busca (client-side sobre os ativos carregados)
   ---------------------------------------------------------------- */
function filterStocks(stocks, query) {
  if (!query) return stocks;
  const q = query.trim().toLowerCase();
  if (!q) return stocks;
  return stocks.filter(
    (s) =>
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.sector && s.sector.toLowerCase().includes(q))
  );
}

function updateGridMeta(count) {
  if (state.query) {
    els.gridTitle.textContent = state.view === 'watchlist'
      ? `Resultados na watchlist para "${state.query}"`
      : `Resultados para "${state.query}"`;
  } else if (state.view === 'watchlist') {
    els.gridTitle.textContent = 'Minha watchlist';
  } else {
    els.gridTitle.textContent = 'Ações populares';
  }
  els.gridMeta.textContent = `${count} ${count === 1 ? 'ativo' : 'ativos'}`;
}

/* ----------------------------------------------------------------
   Estado vazio contextual (Fase 4)
   Mensagens diferentes para watchlist vazia vs busca sem resultados.
   ---------------------------------------------------------------- */
function updateEmptyState() {
  const titleEl = els.emptyState.querySelector('.empty-title');
  const subEl = els.emptyState.querySelector('.empty-sub');
  const iconEl = els.emptyState.querySelector('.empty-icon');

  if (state.view === 'watchlist' && !state.query) {
    iconEl.textContent = '⭐';
    titleEl.textContent = 'Sua watchlist está vazia.';
    subEl.innerHTML = 'Adicione ativos com o campo acima ou clique na estrela (☆) em qualquer card.';
  } else if (state.view === 'watchlist' && state.query) {
    iconEl.textContent = '📭';
    titleEl.textContent = `Nenhum ativo da watchlist corresponde a "${state.query}".`;
    subEl.textContent = '';
  } else if (state.query) {
    iconEl.textContent = '🔍';
    titleEl.textContent = `Nenhum ativo encontrado para "${state.query}".`;
    subEl.textContent = 'Tente outro ticker ou nome.';
  } else {
    iconEl.textContent = '📭';
    titleEl.textContent = 'Nenhum ativo encontrado.';
    subEl.textContent = '';
  }
}

/* ----------------------------------------------------------------
   Eventos de UI
   ---------------------------------------------------------------- */
function bindEvents() {
  // Botão de busca
  els.searchBtn.addEventListener('click', handleSearch);

  // Enter no input
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Limpa busca (botão ✕)
  els.searchClear.addEventListener('click', clearSearch);

  // Mostra/esconde o botão de limpar conforme o usuário digita
  els.searchInput.addEventListener('input', () => {
    els.searchClear.classList.toggle('visible', !!els.searchInput.value);
  });

  // Fecha o modal (overlay + botão ✕ injetado dinamicamente via delegação)
  els.modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Delegação de clique nos cards (abrir modal — placeholder da Fase 5)
  els.cardsGrid.addEventListener('click', (e) => {
    // Fase 4: botão de watchlist (estrela) tem prioridade — não abre modal
    const starBtn = e.target.closest('[data-watch-toggle]');
    if (starBtn) {
      e.stopPropagation();
      handleWatchlistToggle(starBtn.dataset.watchToggle);
      return;
    }
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.ticker);
  });
  els.cardsGrid.addEventListener('keydown', (e) => {
    // Estrela: Enter/Espaço alterna watchlist (não abre modal)
    const starBtn = e.target.closest('[data-watch-toggle]');
    if (starBtn && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      handleWatchlistToggle(starBtn.dataset.watchToggle);
      return;
    }
    const card = e.target.closest('.card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openModal(card.dataset.ticker);
    }
  });

  // Fase 4: tabs de view-switch (Populares / Watchlist)
  els.viewTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-view]');
    if (!tab) return;
    switchView(tab.dataset.view);
  });
  els.viewTabs.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[data-view]');
    if (!tab) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const tabs = [...els.viewTabs.querySelectorAll('[data-view]')];
      const idx = tabs.indexOf(tab);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(idx + dir + tabs.length) % tabs.length];
      next.focus();
      switchView(next.dataset.view);
    }
  });

  // Fase 4: toolbar de watchlist — adicionar ticker
  els.watchlistAddBtn.addEventListener('click', handleAddToWatchlist);
  els.watchlistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddToWatchlist();
  });

  // Fase 4: limpar watchlist inteira
  els.watchlistClear.addEventListener('click', handleClearWatchlist);

  // Fase 4: sincroniza watchlist caso outra aba do navegador altere o storage
  window.addEventListener('storage', (e) => {
    if (e.key === 'sw_watchlist') {
      state.watchlist = loadWatchlist();
      updateWatchlistBadge();
      renderCards();
      // Atualiza a estrela dos cards sem refetch de cotações
      updateCardStars();
      // Se novos tickers entraram, busca cotações deles
      refreshQuotes();
    }
  });
}

function handleSearch() {
  state.query = els.searchInput.value.trim();
  renderCards();
}

function clearSearch() {
  els.searchInput.value = '';
  els.searchClear.classList.remove('visible');
  state.query = '';
  els.searchInput.focus();
  renderCards();
}

/* ----------------------------------------------------------------
   Fase 4 — Watchlist: handlers e helpers de UI
   ---------------------------------------------------------------- */

/** Alterna o estado do ticker na watchlist e atualiza apenas a estrela do card. */
function handleWatchlistToggle(ticker) {
  const { list, added } = toggleWatchlist(ticker);
  state.watchlist = list;
  updateWatchlistBadge();
  updateCardStar(ticker);
  console.log(`[watchlist] ${added ? '+' : '-'} ${ticker} → total ${list.length}`);

  // Se estamos na view de watchlist e o ticker foi removido, ele some do grid.
  if (state.view === 'watchlist' && !added) {
    // Anima a saída do card
    const card = els.cardsGrid.querySelector(`.card[data-ticker="${ticker}"]`);
    if (card) {
      card.classList.add('is-leaving');
      setTimeout(() => renderCards(), 180);
    } else {
      renderCards();
    }
  }
}

/** Troca a view ativa entre 'popular' e 'watchlist'. */
function switchView(view) {
  if (view !== 'popular' && view !== 'watchlist') return;
  if (state.view === view) return;
  state.view = view;

  // Atualiza visual das tabs
  const tabs = els.viewTabs.querySelectorAll('[data-view]');
  tabs.forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  // Mostra/esconde a toolbar de watchlist
  updateWatchlistToolbar();

  // Limpa a busca ao trocar de view (contexto muda)
  if (state.query) clearSearch();

  renderCards();
  // Garante cotações para a nova view (especialmente watchlist com tickers novos)
  refreshQuotes();
  console.log(`[view] trocou para "${view}"`);
}

/** Adiciona ticker(s) à watchlist via toolbar. Aceita múltiplos separados por vírgula. */
function handleAddToWatchlist() {
  const raw = els.watchlistInput.value.trim();
  if (!raw) return;
  const tickers = raw.split(/[,\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tickers.length === 0) return;

  // Substitui a watchlist inteira mantendo a ordem existente + novos no final
  const before = state.watchlist.slice();
  for (const t of tickers) {
    if (!state.watchlist.includes(t)) state.watchlist.push(t);
  }
  replaceWatchlist(state.watchlist);

  const addedCount = state.watchlist.length - before.length;
  console.log(`[watchlist] +${addedCount} ticker(s) (${tickers.join(', ')}) → total ${state.watchlist.length}`);

  els.watchlistInput.value = '';
  updateWatchlistBadge();

  // Se já está na view watchlist, só atualiza os cards; senão troca para ela.
  if (state.view !== 'watchlist') {
    switchView('watchlist');
  } else {
    renderCards();
  }

  // Busca cotação dos tickers novos imediatamente
  refreshQuotes();
}

/** Limpa a watchlist inteira após confirmação do usuário. */
function handleClearWatchlist() {
  if (watchlistSize() === 0) return;
  // Confirmação leve — usa window.confirm (aceitável em app 100% client-side)
  const ok = window.confirm(
    `Remover todos os ${watchlistSize()} ativo(s) da sua watchlist?\nEsta ação não pode ser desfeita.`
  );
  if (!ok) return;
  clearWatchlist();
  state.watchlist = [];
  updateWatchlistBadge();
  renderCards();
  updateCardStars();
  console.log('[watchlist] limpa');
}

/** Atualiza o badge de tamanho da watchlist (mostra número de ativos). */
function updateWatchlistBadge() {
  const n = state.watchlist.length;
  if (n > 0) {
    els.watchlistCount.hidden = false;
    els.watchlistCount.textContent = n;
  } else {
    els.watchlistCount.hidden = true;
  }
}

/** Mostra/esconde a toolbar de watchlist conforme a view ativa. */
function updateWatchlistToolbar() {
  els.watchlistToolbar.hidden = state.view !== 'watchlist';
}

/** Atualiza o botão ★ de um card específico (após toggle sem re-render). */
function updateCardStar(ticker) {
  const card = els.cardsGrid.querySelector(`.card[data-ticker="${ticker}"]`);
  if (!card) return;
  const star = card.querySelector('.card__star');
  if (!star) return;
  const inWatch = hasInWatchlist(ticker);
  star.classList.toggle('is-active', inWatch);
  star.setAttribute('aria-pressed', inWatch);
  star.setAttribute('aria-label', inWatch ? 'Remover da watchlist' : 'Adicionar à watchlist');
  star.setAttribute('title', inWatch ? 'Remover da watchlist' : 'Adicionar à watchlist');
  const span = star.querySelector('span');
  if (span) span.textContent = inWatch ? '★' : '☆';
}

/** Reaplica o estado da estrela em todos os cards (após sync de storage). */
function updateCardStars() {
  const cards = els.cardsGrid.querySelectorAll('.card[data-ticker]');
  cards.forEach((card) => updateCardStar(card.dataset.ticker));
}

/* ----------------------------------------------------------------
   Modal — exibe cotação detalhada do ativo (Fase 3: dados reais;
   Fase 5 preencherá com gráfico de histórico)
   ---------------------------------------------------------------- */
function openModal(ticker) {
  const stock = state.stocks.find((s) => s.ticker === ticker);
  const quote = state.quotes.get(ticker);
  if (!stock && !quote) return;

  const display = quote?.longName || stock?.name || ticker;

  // Logo
  const logoHtml = quote?.logourl
    ? `<img src="${escapeAttr(quote.logourl)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${ticker.charAt(0)}'">`
    : (ticker.charAt(0));

  // Bloco de detalhes (apenas se houver cotação)
  let detailsHtml = '';
  if (quote) {
    const cc = quote.changePercent != null ? changeClass(quote.changePercent) : 'is-flat';
    const changeStr = quote.changePercent != null ? formatPercent(quote.changePercent) : '—';
    const changeAbs = quote.change != null ? (quote.change >= 0 ? '+' : '') + quote.change.toFixed(2) : '—';
    detailsHtml = `
      <div class="modal__quote">
        <div class="modal__price-row">
          <div class="modal__price">${quote.price != null ? formatCurrency(quote.price) : '—'}</div>
          <div class="modal__change ${cc}">${changeStr} <span class="modal__change-abs">(${changeAbs})</span></div>
        </div>
        <div class="modal__grid">
          <div class="modal__field"><span>Abertura</span><b>${quote.open != null ? formatCurrency(quote.open) : '—'}</b></div>
          <div class="modal__field"><span>Fech. anterior</span><b>${quote.previousClose != null ? formatCurrency(quote.previousClose) : '—'}</b></div>
          <div class="modal__field"><span>Máx. dia</span><b>${quote.dayHigh != null ? formatCurrency(quote.dayHigh) : '—'}</b></div>
          <div class="modal__field"><span>Mín. dia</span><b>${quote.dayLow != null ? formatCurrency(quote.dayLow) : '—'}</b></div>
          <div class="modal__field"><span>Volume</span><b>${quote.volume != null ? formatVolume(quote.volume) : '—'}</b></div>
          <div class="modal__field"><span>Market cap</span><b>${quote.marketCap != null ? formatMarketCap(quote.marketCap) : '—'}</b></div>
          <div class="modal__field"><span>Faixa 52 sem.</span><b>${quote.fiftyTwoWeekRange || '—'}</b></div>
          <div class="modal__field"><span>P/L</span><b>${quote.priceEarnings != null ? quote.priceEarnings.toFixed(2) : '—'}</b></div>
        </div>
      </div>
    `;
  } else {
    detailsHtml = `
      <p class="modal__placeholder">Carregando cotação…</p>
    `;
  }

  els.modalContent.innerHTML = `
    <button class="modal__close" data-modal-close aria-label="Fechar">✕</button>
    <div class="card__top">
      <div class="card__logo">${logoHtml}</div>
      <div class="card__info">
        <div class="card__ticker">${ticker}</div>
        <div class="card__name">${escapeHtml(display)}</div>
        ${stock ? `<span class="card__sector">${escapeHtml(stock.sector)}</span>` : ''}
      </div>
    </div>
    ${detailsHtml}
    <p class="modal__hint">Gráfico de histórico disponível na Fase 5.</p>
  `;
  els.modal.hidden = false;
  els.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  if (els.modal.hidden) return;
  els.modal.hidden = true;
  els.modal.setAttribute('aria-hidden', 'true');
}

/* ----------------------------------------------------------------
   Indicador de mercado aberto/fechado
   Horário de pregão B3: 10h–17h (horário de SP), dias úteis.
   ---------------------------------------------------------------- */
function renderMarketStatus() {
  const now = new Date();
  const sp = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = sp.getDay();
  const hour = sp.getHours();

  const isWeekday = day !== 0 && day !== 6;
  const isOpen = isWeekday && hour >= 10 && hour < 17;

  const wrap = els.marketStatus;
  wrap.classList.toggle('market-open', isOpen);
  wrap.classList.toggle('market-closed', !isOpen);
  wrap.querySelector('.status-text').textContent = isOpen
    ? 'Mercado aberto'
    : 'Mercado fechado';
}

/* ----------------------------------------------------------------
   Util: escape minimal de HTML para evitar XSS no nome/setor
   ---------------------------------------------------------------- */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/* Escape para uso dentro de atributos HTML (ex: src="...") */
function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/* ----------------------------------------------------------------
   Boot
   ---------------------------------------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exporta funções que fases posteriores reaproveitarão
export {
  state, els, renderCard, renderCards, renderSkeletons,
  fetchQuote, fetchMultiple, fetchAvailable, setToken, hasToken, clearCache,
  // Fase 4
  switchView, getDisplayedStocks,
  loadWatchlist, addToWatchlist, removeFromWatchlist,
  toggleWatchlist, hasInWatchlist, clearWatchlist, watchlistSize,
};
