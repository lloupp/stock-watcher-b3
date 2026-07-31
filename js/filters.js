// filters.js — Lógica de filtros e ordenação para o Stock Watcher B3
// Fase 6: Funções puras que recebem uma lista de ativos + critérios e devolvem
//          a lista filtrada/ordenada. Não toca no DOM nem no estado global —
//          app.js consome este módulo.
//
// Critérios de filtro:
//   - query: texto livre (ticker, nome, setor — case-insensitive)
//   - sector: "" (todos) | nome exato do setor
//   - variation: "all" | "gainers" | "losers"
//   - sort: uma chave em SORT_KEYS
//
// Os valores de mercado (preço, variação, volume) vêm de state.quotes, não
// do default-stocks. Por isso, as funções recebem um Map<ticker, quote>
// opcional para consultá-los. Se o quote não existir, o ativo é tratado
// como se tivesse valor nulo (neutro em ordenação, excluído de gainers/losers).

/* ----------------------------------------------------------------
   Chaves de ordenação suportadas.
   Cada chave define um label (para o <select>), a função de extração
   de valor comparável e a direção inicial.
   ---------------------------------------------------------------- */
export const SORT_KEYS = {
  default:     { label: 'Padrão (sem ordem)', value: null,      dir: 'asc'  },
  ticker:       { label: 'Ticker (A→Z)',       value: (s) => s.ticker,                dir: 'asc'  },
  name:        { label: 'Nome (A→Z)',          value: (s) => (s.name || '').toLowerCase(), dir: 'asc'  },
  price:        { label: 'Preço (maior → menor)', value: 'price',    dir: 'desc' },
  change:       { label: 'Variação % (maior → menor)', value: 'change', dir: 'desc' },
  volume:       { label: 'Volume (maior → menor)', value: 'volume',  dir: 'desc' },
  marketCap:    { label: 'Market cap (maior → menor)', value: 'marketCap', dir: 'desc' },
};

/* ----------------------------------------------------------------
   Extrai valores numéricos do quote para uso em filtros e ordenação.
   Retorna null se o ticker não tem cotação ainda.
   ---------------------------------------------------------------- */
export function getNumeric(stock, key, quotes) {
  if (!stock || !key) return null;
  if (key === 'price') {
    const q = quotes?.get(stock.ticker);
    return q?.price ?? null;
  }
  if (key === 'change') {
    const q = quotes?.get(stock.ticker);
    return q?.changePercent ?? null;
  }
  if (key === 'volume') {
    const q = quotes?.get(stock.ticker);
    return q?.volume ?? null;
  }
  if (key === 'marketCap') {
    const q = quotes?.get(stock.ticker);
    return q?.marketCap ?? null;
  }
  return null;
}

/* ----------------------------------------------------------------
   Coleta a lista de setores distintos dos ativos exibidos.
   Retorna array ordenado de strings (setor). Exclui "—" (desconhecido).
   ---------------------------------------------------------------- */
export function collectSectors(stocks) {
  const set = new Set();
  for (const s of stocks) {
    const sec = s.sector;
    if (sec && sec !== '—') set.add(sec);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/* ----------------------------------------------------------------
   Aplica TODOS os filtros + ordenação de uma vez.
   Retorna um novo array (não muta o original).
   ---------------------------------------------------------------- */
export function applyFilters(stocks, criteria, quotes) {
  const { query = '', sector = '', variation = 'all', sort = 'default' } = criteria || {};

  // 1) Filtro por texto (ticker, nome, setor)
  let result = stocks;
  const q = String(query).trim().toLowerCase();
  if (q) {
    result = result.filter(
      (s) =>
        (s.ticker && s.ticker.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.sector && s.sector.toLowerCase().includes(q))
    );
  }

  // 2) Filtro por setor (match exato, case-sensitive — setores vêm do JSON)
  if (sector) {
    result = result.filter((s) => s.sector === sector);
  }

  // 3) Filtro por variação (gainers / losers)
  if (variation === 'gainers' || variation === 'losers') {
    result = result.filter((s) => {
      const chg = getNumeric(s, 'change', quotes);
      if (chg == null) return false;
      return variation === 'gainers' ? chg > 0 : chg < 0;
    });
  }

  // 4) Ordenação
  const sortKey = SORT_KEYS[sort] || SORT_KEYS.default;
  if (sortKey.value !== null) {
    const extract = sortKey.value;
    const dir = sortKey.dir === 'desc' ? -1 : 1;

    if (typeof extract === 'function') {
      // ordenação por string (ticker, nome)
      result = [...result].sort((a, b) => {
        const va = extract(a) || '';
        const vb = extract(b) || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });
    } else {
      // ordenação por valor numérico (preço, variação, volume, market cap)
      result = [...result].sort((a, b) => {
        const va = getNumeric(a, extract, quotes) ?? -Infinity;
        const vb = getNumeric(b, extract, quotes) ?? -Infinity;
        // nulos vão para o final em ambos os casos
        if (va === -Infinity && vb === -Infinity) return 0;
        if (va === -Infinity) return 1;
        if (vb === -Infinity) return -1;
        return (va - vb) * dir;
      });
    }
  }

  return result;
}

/* ----------------------------------------------------------------
   Conta quantos ativos passam cada variação (todos/gainers/losers).
   Útil para mostrar badges nos botões de filtro.
   ---------------------------------------------------------------- */
export function countVariations(stocks, quotes) {
  let all = 0, gainers = 0, losers = 0;
  for (const s of stocks) {
    all++;
    const chg = getNumeric(s, 'change', quotes);
    if (chg == null) continue;
    if (chg > 0) gainers++;
    else if (chg < 0) losers++;
  }
  return { all, gainers, losers };
}
