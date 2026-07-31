// app.js — Lógica principal do Stock Watcher B3
// Fase 1: Layout e UI base, grid de cards, busca client-side sobre default-stocks
// Fase 2: importa o cliente da API brapi.dev
// Fase 3: renderiza cards com dados reais, logo, cores, auto-refresh a cada 60s

import { formatCurrency, formatVolume, formatPercent, formatMarketCap, changeClass } from './utils.js';
import {
  fetchQuote, fetchMultiple, fetchAvailable,
  setToken, hasToken, clearCache, getCacheState,
} from './api.js';

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
};

/* ----------------------------------------------------------------
   Inicialização
   ---------------------------------------------------------------- */
async function init() {
  console.log('Stock Watcher B3 — inicializando... (Fase 3: cards com dados reais + auto-refresh)');
  console.log(hasToken()
    ? '[brapi] Token configurado no localStorage (limites completos).'
    : '[brapi] Sem token no localStorage — limite gratuito: ~3-4 tickers/IP. Use setApiToken() no console para configurar.');

  // Expõe API de depuração no window (acessível via console do navegador)
  window.SW = {
    fetchQuote, fetchMultiple, fetchAvailable,
    setApiToken: setToken, hasToken, clearCache, getCacheState, state,
    refreshNow: refreshQuotes,
  };

  bindEvents();
  renderMarketStatus();
  await loadDefaultStocks();
  renderCards();
  // Fase 3: busca cotações reais para preencher os cards
  await refreshQuotes();
  startAutoRefresh();
}

/* ----------------------------------------------------------------
   Carrega cotações reais da API e atualiza os cards.
   Usa fetchMultiple (com batching) para respeitar o limite sem token.
   ---------------------------------------------------------------- */
async function refreshQuotes() {
  if (state.stocks.length === 0) return;
  state.loading = true;
  updateRefreshIndicator(true);

  const tickers = state.stocks.map((s) => s.ticker);
  try {
    const map = await fetchMultiple(tickers);
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
    els.emptyState.querySelector('p').textContent = 'Erro ao carregar lista de ativos.';
    state.stocks = [];
  }
}

/* ----------------------------------------------------------------
   Renderização dos cards
   Fase 1: layout esqueleto (ticker, nome, setor, placeholders).
   Fase 3: injeta dados reais da API quando disponíveis em state.quotes;
   caso contrário mostra "—" com spinner enquanto carrega.
   ---------------------------------------------------------------- */
function renderCards() {
  const filtered = filterStocks(state.stocks, state.query);

  if (filtered.length === 0) {
    els.cardsGrid.innerHTML = '';
    els.emptyState.hidden = false;
    updateGridMeta(filtered.length);
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

  return `
    <article class="card ${cardCls}${isFirstLoad ? ' is-loading' : ''}" data-ticker="${ticker}" role="button" tabindex="0" aria-label="Detalhes de ${ticker}">
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
    els.gridTitle.textContent = `Resultados para "${state.query}"`;
  } else {
    els.gridTitle.textContent = 'Ações populares';
  }
  els.gridMeta.textContent = `${count} ${count === 1 ? 'ativo' : 'ativos'}`;
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
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.ticker);
  });
  els.cardsGrid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openModal(card.dataset.ticker);
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
};
