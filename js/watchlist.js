// watchlist.js — Gestão de watchlist com persistência em localStorage
// Fase 4: adicionar/remover ativos da watchlist, persistir, carregar ao abrir,
//          editar (remover) a watchlist. Puro em storage — sem tocar na API
//          nem no DOM. A camada de app (app.js) consome este módulo.
//
// Storage:
//   localStorage["sw_watchlist"] = JSON array de strings (tickers), ex:
//     ["PETR4","VALE3","ABEV3"]
//   A ordem é significativa: reflete a ordem em que o usuário adicionou
//   (inserção ordenada). Duplicatas são evitadas no nível do módulo.

/* ----------------------------------------------------------------
   Configuração
   ---------------------------------------------------------------- */
const STORAGE_KEY = 'sw_watchlist';

/* ----------------------------------------------------------------
   Acesso seguro ao localStorage (SSR/proxy/layout sem storage)
   ---------------------------------------------------------------- */
function hasStorage() {
  try {
    const k = '__sw_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const _hasStorage = hasStorage();

/* ----------------------------------------------------------------
   Leitura — retorna array de tickers ( sempre strings, dedup, sem vazios)
   Nunca lança; se storage ausente/corrompido, retorna [].
   ---------------------------------------------------------------- */
export function loadWatchlist() {
  if (!_hasStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normaliza: uppercase, trim, dedup preservando ordem
    const seen = new Set();
    const out = [];
    for (const t of parsed) {
      if (typeof t !== 'string') continue;
      const norm = t.trim().toUpperCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
    return out;
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------
   Escrita — serializa o array. Privado: só o módulo escreve.
   ---------------------------------------------------------------- */
function persist(tickers) {
  if (!_hasStorage) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------------
   has(ticker) — true se o ticker está na watchlist
   ---------------------------------------------------------------- */
export function hasInWatchlist(ticker) {
  const sym = String(ticker || '').trim().toUpperCase();
  if (!sym) return false;
  return loadWatchlist().includes(sym);
}

/* ----------------------------------------------------------------
   addToWatchlist(ticker) — adiciona no final se não existir.
   Retorna o novo array guardado.
   ---------------------------------------------------------------- */
export function addToWatchlist(ticker) {
  const sym = String(ticker || '').trim().toUpperCase();
  if (!sym) return loadWatchlist();
  const list = loadWatchlist();
  if (!list.includes(sym)) {
    list.push(sym);
    persist(list);
  }
  return list;
}

/* ----------------------------------------------------------------
   removeFromWatchlist(ticker) — remove se existir.
   Retorna o novo array guardado.
   ---------------------------------------------------------------- */
export function removeFromWatchlist(ticker) {
  const sym = String(ticker || '').trim().toUpperCase();
  if (!sym) return loadWatchlist();
  const list = loadWatchlist().filter((t) => t !== sym);
  persist(list);
  return list;
}

/* ----------------------------------------------------------------
   toggleWatchlist(ticker) — adiciona se não existe, remove se existe.
   Retorna { list, added: boolean } para o chamador saber o que fez.
   ---------------------------------------------------------------- */
export function toggleWatchlist(ticker) {
  const sym = String(ticker || '').trim().toUpperCase();
  if (!sym) return { list: loadWatchlist(), added: false };
  if (hasInWatchlist(sym)) {
    return { list: removeFromWatchlist(sym), added: false };
  }
  return { list: addToWatchlist(sym), added: true };
}

/* ----------------------------------------------------------------
   replaceWatchlist(tickers) — sobrescreve a watchlist inteira
   (útil para reordenar / bulk import). Valida e dedup.
   ---------------------------------------------------------------- */
export function replaceWatchlist(tickers = []) {
  const seen = new Set();
  const out = [];
  for (const t of tickers) {
    const sym = String(t || '').trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  persist(out);
  return out;
}

/* ----------------------------------------------------------------
   clearWatchlist() — remove todos os ativos da watchlist.
   ---------------------------------------------------------------- */
export function clearWatchlist() {
  persist([]);
  return [];
}

/* ----------------------------------------------------------------
   watchlistSize() — número de ativos guardados.
   ---------------------------------------------------------------- */
export function watchlistSize() {
  return loadWatchlist().length;
}

/* ----------------------------------------------------------------
  _NOTIFY — placeholder para future event-emitter. O app.js pode
   subscrever quando necessário; por ora, os callers checam o
   valor retornado pelas funções.
   ---------------------------------------------------------------- */
