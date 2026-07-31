// app.js — Lógica principal do Stock Watcher B3
// Fase 1: Layout e UI base, grid de cards, busca client-side sobre default-stocks

import { formatCurrency, formatVolume, formatPercent } from './utils.js';

/* ----------------------------------------------------------------
   Estado da aplicação (será expandido nas próximas fases)
   ---------------------------------------------------------------- */
const state = {
  stocks: [],          // lista de ativos (default-stocks.json + watchlist futuramente)
  query: '',           // termo de busca atual
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
  console.log('Stock Watcher B3 — inicializando... (Fase 1)');

  bindEvents();
  renderMarketStatus();
  await loadDefaultStocks();
  renderCards();
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
   Na Fase 1 exibimos o card com os dados estáticos (ticker, nome, setor)
   e placeholders (—) nos campos que dependerão da API (Fase 2/3).
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
  const logo = ticker.charAt(0);

  // Fase 1: campos de preço/variação/volume ficam como placeholder "—"
  // A Fase 3 injetará dados reais da API.
  return `
    <article class="card" data-ticker="${ticker}" role="button" tabindex="0" aria-label="Detalhes de ${ticker}">
      <div class="card__top">
        <div class="card__logo" data-logo="${ticker}">${logo}</div>
        <div class="card__info">
          <div class="card__ticker">${ticker}</div>
          <div class="card__name">${escapeHtml(name)}</div>
        </div>
        <span class="card__sector">${escapeHtml(sector)}</span>
      </div>
      <div class="card__price">
        <div class="card__price-value" data-price="${ticker}">—</div>
        <div class="card__change is-flat" data-change="${ticker}">—</div>
      </div>
      <div class="card__meta">
        <span>
          <span class="card__meta-label">Volume</span>
          <b data-volume="${ticker}">—</b>
        </span>
        <span>
          <span class="card__meta-label">Market cap</span>
          <b data-mcap="${ticker}">—</b>
        </span>
      </div>
    </article>
  `;
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

  // Fecha o modal (placeholder — Fase 5)
  els.modal.querySelector('[data-modal-close]')
    .addEventListener('click', closeModal);
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
   Modal (placeholder — gráfico detalhado na Fase 5)
   ---------------------------------------------------------------- */
function openModal(ticker) {
  const stock = state.stocks.find((s) => s.ticker === ticker);
  if (!stock) return;
  els.modalContent.innerHTML = `
    <div class="card__top">
      <div class="card__logo">${stock.ticker.charAt(0)}</div>
      <div class="card__info">
        <div class="card__ticker">${stock.ticker}</div>
        <div class="card__name">${escapeHtml(stock.name)}</div>
      </div>
    </div>
    <p style="color: var(--text-secondary); margin-top: 16px; font-size: 0.9rem;">
      Gráfico detalhado e histórico disponíveis na Fase 5.
    </p>
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

/* ----------------------------------------------------------------
   Boot
   ---------------------------------------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exporta funções que fases posteriores reaproveitarão
export { state, els, renderCard, renderCards, renderSkeletons };
