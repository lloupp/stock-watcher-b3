// api.js — Cliente da API brapi.dev
// Fase 2: fetchQuote, fetchAvailable, fetchMultiple, cache em memória,
//          tratamento de erros e estados de loading.
//
// A API brapi.dev é gratuita e sem token, mas sem token o limite é de
// até 3 tickers por requisição no endpoint /quote. fetchMultiple faz
// batching automático de 3 em 3 (com paralelismo controlado) para não
// estourar esse limite.

/* ----------------------------------------------------------------
   Configuração
   ---------------------------------------------------------------- */
const BRAPI_BASE = 'https://brapi.dev/api';

// Limite de tickers por requisição sem token (empiricamente 3).
const BATCH_SIZE = 3;

// Janela de validade do cache (ms). 60s é suficiente para auto-refresh
// sem martelar a API a cada render.
const CACHE_TTL = 60_000;

// Chave do localStorage para o token opcional da brapi.dev.
// Sem token, a API gratuita permite consultar apenas ~3-4 tickers
// distintos por IP (limitação documentada empiricamente). Com token,
// o limite sobe para 100/minuto e batches de até 20 tickers.
const TOKEN_KEY = 'brapi_token';

/* ----------------------------------------------------------------
   Token opcional
   ---------------------------------------------------------------- */
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; }
  catch { return ''; } // localStorage ausente (SSR/proxy)
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
    clearCache(); // invalida cache ao mudar o token
  } catch { /* ignore */ }
}

export function hasToken() {
  return !!getToken();
}

/**
 * Monta uma query string combinando parâmetros extras com o token
 * (se existir). Aceita extra como string ("search=X") ou objeto.
 * Retorna "" se não houver nenhum parâmetro; senão começa com "?".
 */
function buildQuery(extra) {
  const params = new URLSearchParams();
  if (extra) {
    if (typeof extra === 'string') {
      // aceita "search=X" ou "?search=X"
      const s = extra.trim().replace(/^\?/, '');
      if (s) {
        // URLSearchParams lida com "k=v&k2=v2"
        for (const pair of new URLSearchParams(s)) {
          params.append(pair[0], pair[1]);
        }
      }
    } else {
      for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== '') params.append(k, String(v));
      }
    }
  }
  const t = getToken();
  if (t) params.append('token', t);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/* ----------------------------------------------------------------
   Cache em memória
   Estrutura: Map<ticker, { data, ts, status }>
   status: 'fresh' | 'loading' | 'error'
   ---------------------------------------------------------------- */
const cache = new Map();

function cacheGet(ticker) {
  const entry = cache.get(ticker);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(ticker);
    return null;
  }
  return entry.data;
}

function cacheSet(ticker, data) {
  cache.set(ticker, { data, ts: Date.now(), status: 'fresh' });
}

function cacheSetStatus(ticker, status) {
  const entry = cache.get(ticker);
  if (entry) entry.status = status;
}

export function clearCache(ticker = null) {
  if (ticker) cache.delete(ticker);
  else cache.clear();
}

/* ----------------------------------------------------------------
   Mapeamento da resposta da API → objeto interno normalizado.
   A API chama de "symbol" o que chamamos de "ticker".
   ---------------------------------------------------------------- */
export function normalizeQuote(raw) {
  if (!raw) return null;
  return {
    ticker: raw.symbol,
    shortName: raw.shortName || raw.symbol,
    longName: raw.longName || raw.shortName || raw.symbol,
    currency: raw.currency || 'BRL',
    price: raw.regularMarketPrice ?? null,
    dayHigh: raw.regularMarketDayHigh ?? null,
    dayLow: raw.regularMarketDayLow ?? null,
    change: raw.regularMarketChange ?? null,
    changePercent: raw.regularMarketChangePercent ?? null,
    marketTime: raw.regularMarketTime ?? null,
    marketCap: raw.marketCap ?? null,
    volume: raw.regularMarketVolume ?? null,
    previousClose: raw.regularMarketPreviousClose ?? null,
    open: raw.regularMarketOpen ?? null,
    fiftyTwoWeekLow: raw.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: raw.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekRange: raw.fiftyTwoWeekRange ?? null,
    priceEarnings: raw.priceEarnings ?? null,
    earningsPerShare: raw.earningsPerShare ?? null,
    logourl: raw.logourl ?? null,
  };
}

/* ----------------------------------------------------------------
   fetchQuote(ticker) — cotação de um único ativo
   Retorna o objeto normalizado ou lança Error com mensagem útil.
   ---------------------------------------------------------------- */
export async function fetchQuote(ticker) {
  const sym = String(ticker).trim().toUpperCase();
  if (!sym) throw new Error('Ticker vazio');

  const cached = cacheGet(sym);
  if (cached) return cached;

  // Marca como loading para permitir dedup de requisições concorrentes
  cacheSet(sym, { __loading: true });

  let res;
  try {
    res = await fetch(`${BRAPI_BASE}/quote/${encodeURIComponent(sym)}${buildQuery()}`);
  } catch (err) {
    cache.delete(sym);
    throw new Error(`Falha de rede ao buscar ${sym}: ${err.message}`);
  }

  if (!res.ok) {
    cache.delete(sym);
    if (res.status === 401) {
      throw new Error(`${sym}: token exigido (ticker pode não existir)`);
    }
    if (res.status === 404) {
      throw new Error(`${sym}: ativo não encontrado`);
    }
    throw new Error(`${sym}: erro HTTP ${res.status}`);
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    cache.delete(sym);
    throw new Error(`${sym}: resposta inválida da API`);
  }

  if (body.error) {
    cache.delete(sym);
    throw new Error(`${sym}: ${body.message || 'erro da API'}`);
  }

  const result = Array.isArray(body.results) ? body.results[0] : null;
  if (!result) {
    cache.delete(sym);
    throw new Error(`${sym}: nenhum dado retornado`);
  }

  const normalized = normalizeQuote(result);
  cacheSet(sym, normalized);
  return normalized;
}

/* ----------------------------------------------------------------
   fetchMultiple(tickers) — cotação de N ativos
   Faz batching de BATCH_SIZE e executa os batches em paralelo.
   Retorna um Map<ticker, { data, error }> para que o chamador
   consiga diferenciar sucesso/erro por ativo sem abortar o lote todo.
   ---------------------------------------------------------------- */
export async function fetchMultiple(tickers) {
  const symbols = tickers
    .map((t) => String(t).trim().toUpperCase())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedup

  // Primeiro coleta o que já está em cache e válido
  const out = new Map();
  const pending = [];
  for (const sym of symbols) {
    const cached = cacheGet(sym);
    if (cached && !cached.__loading) {
      out.set(sym, cached);
    } else {
      pending.push(sym);
    }
  }

  // Se não há pendentes, retorna imediato
  if (pending.length === 0) return out;

  // Agrupa em batches de BATCH_SIZE
  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  // Marca todos como loading
  pending.forEach((s) => cacheSet(s, { __loading: true }));

  // Executa batches em paralelo
  const results = await Promise.allSettled(
    batches.map((batch) => fetchBatch(batch))
  );

  // Mescla resultados
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) {
      for (const [sym, data] of r.value.entries()) {
        if (data && !data.__error) {
          cacheSet(sym, data);
          out.set(sym, data);
        } else {
          cache.delete(sym);
          out.set(sym, { __error: data?.__error || `Sem dados para ${sym}` });
        }
      }
    } else {
      // Batch inteiro falhou — registra erro por ticker
      const batch = batches[results.indexOf(r)];
      const msg = r.reason?.message || 'Falha no batch';
      batch.forEach((sym) => {
        cache.delete(sym);
        out.set(sym, { __error: msg });
      });
    }
  });

  return out;
}

/* ----------------------------------------------------------------
   fetchBatch(batch) — helper interno: 1 requisição /quote com até
   BATCH_SIZE tickers. Retorna Map<ticker, normalized | {__error}>.
   ---------------------------------------------------------------- */
async function fetchBatch(batch) {
  const url = `${BRAPI_BASE}/quote/${batch.map(encodeURIComponent).join(',')}${buildQuery()}`;
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.message) msg = j.message;
    } catch { /* ignore */ }
    // Se o batch inteiro falhou (ex: um ticker inválido exige token),
    // faz fallback individual — 1 ticker por requisição costuma
    // funcionar mesmo sem token para tickers válidos.
    if (batch.length > 1) {
      const individual = await Promise.allSettled(
        batch.map((sym) => fetchBatch([sym]))
      );
      const out = new Map();
      individual.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const data = r.value.get(batch[i]);
          out.set(batch[i], data);
        } else {
          out.set(batch[i], { __error: r.reason?.message || 'Falha individual' });
        }
      });
      return out;
    }
    throw new Error(msg);
  }

  const body = await res.json();
  if (body.error) {
    // Mesma estratégia de fallback individual
    if (batch.length > 1) {
      const individual = await Promise.allSettled(
        batch.map((sym) => fetchBatch([sym]))
      );
      const out = new Map();
      individual.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          out.set(batch[i], r.value.get(batch[i]));
        } else {
          out.set(batch[i], { __error: r.reason?.message || 'Falha individual' });
        }
      });
      return out;
    }
    throw new Error(body.message || 'erro da API');
  }

  const out = new Map();
  const results = Array.isArray(body.results) ? body.results : [];
  for (const sym of batch) {
    const found = results.find(
      (r) => r.symbol === sym || r.symbol === sym.toUpperCase()
    );
    if (found) {
      out.set(sym, normalizeQuote(found));
    } else {
      out.set(sym, { __error: `${sym} ausente na resposta` });
    }
  }
  return out;
}

/* ----------------------------------------------------------------
   fetchAvailable(search?) — lista de ativos disponíveis na B3.
   Sem search retorna todos (~1800). Com search filtra por ticker.
   Retorna array de strings (tickers).
   ---------------------------------------------------------------- */
export async function fetchAvailable(search = null) {
  const params = search ? `search=${encodeURIComponent(String(search).trim().toUpperCase())}` : '';
  const url = `${BRAPI_BASE}/available${buildQuery(params)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`available: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.message || 'erro em /available');
  const stocks = Array.isArray(body.stocks) ? body.stocks : [];
  return stocks;
}

/* ----------------------------------------------------------------
   fetchHistory(ticker, range, interval) — histórico OHLCV de um ativo.
   Usa o endpoint /quote com parâmetros range e interval suportados pela
   brapi.dev. A resposta vem em results[].historicalDataPrice (array de
   {date(unix seg), open, high, low, close, volume, adjustedClose}).
   Retorna { points: [{t, o, h, l, c, v, ac}], range, interval }.
   Não usa o cache de cotação (variável dedicada abaixo) pois o histórico
   é mais estável e custa mais caro de refetch.
   ---------------------------------------------------------------- */
const histCache = new Map();

const DEFAULT_RANGE = '1mo';
const DEFAULT_INTERVAL = '1d';

export async function fetchHistory(ticker, range = DEFAULT_RANGE, interval = DEFAULT_INTERVAL) {
  const sym = String(ticker).trim().toUpperCase();
  if (!sym) throw new Error('Ticker vazio para histórico');

  // Cache de histórico: TTL 5min (mais longevo que o de cotação porque
  // o histórico diário não muda minuto a minuto).
  const HIST_TTL = 5 * 60_000;
  const key = `${sym}:${range}:${interval}`;
  const hit = histCache.get(key);
  if (hit && Date.now() - hit.ts < HIST_TTL) return hit.data;

  const params = { range, interval, fundamental: 'false' };
  const url = `${BRAPI_BASE}/quote/${encodeURIComponent(sym)}${buildQuery(params)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Falha de rede ao buscar histórico de ${sym}: ${err.message}`);
  }
  if (!res.ok) throw new Error(`${sym}: histórico HTTP ${res.status}`);

  const body = await res.json();
  if (body.error) throw new Error(`${sym}: ${body.message || 'erro ao buscar histórico'}`);

  const result = Array.isArray(body.results) ? body.results[0] : null;
  const raw = Array.isArray(result?.historicalDataPrice) ? result.historicalDataPrice : [];

  // Normaliza: ordena por data asc, descarta pontos sem close.
  const points = raw
    .filter((p) => p && p.close != null && p.date != null)
    .map((p) => ({
      t: p.date * 1000,           // ms
      o: p.open ?? null,
      h: p.high ?? null,
      l: p.low ?? null,
      c: p.close ?? null,
      v: p.volume ?? null,
      ac: p.adjustedClose ?? p.close ?? null,
    }))
    .sort((a, b) => a.t - b.t);

  const data = { points, range, interval, ticker: sym };
  histCache.set(key, { data, ts: Date.now() });
  return data;
}

/** Limpa o cache de histórico (usado pelo auto-refresh para forçar novos dados). */
export function clearHistoryCache() {
  histCache.clear();
}

/* ----------------------------------------------------------------
   Exporta o cache para inspeção/teste
   ---------------------------------------------------------------- */
export function getCacheState() {
  const out = {};
  for (const [k, v] of cache.entries()) {
    out[k] = { status: v.status, age: Date.now() - v.ts };
  }
  return out;
}
