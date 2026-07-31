// utils.js — Funções utilitárias (formatação, helpers)

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toString();
}

/**
 * Formata market cap (em reais) → R$ X.XXB / M / K
 */
export function formatMarketCap(value) {
  if (value == null || isNaN(value)) return '—';
  const opts = { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 };
  if (value >= 1e12) return `R$ ${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(2)}M`;
  return new Intl.NumberFormat('pt-BR', opts).format(value);
}

/**
 * Determina classe CSS de variação: gain | loss | flat
 */
export function changeClass(changePercent) {
  if (changePercent == null || isNaN(changePercent)) return 'is-flat';
  if (changePercent > 0) return 'is-gain';
  if (changePercent < 0) return 'is-loss';
  return 'is-flat';
}
