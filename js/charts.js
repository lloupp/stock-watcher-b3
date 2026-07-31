// charts.js — Gráficos em Canvas para o Stock Watcher B3
// Fase 5: sparkline nos cards, gráfico de linha/candlestick no modal detalhado.
// Canvas puro (zero dependências), responsivo via ResizeObserver, HiDPI-aware.
//
// API pública (exportada):
//   drawSparkline(canvas, points, opts)  → mini linha no card
//   drawChart(canvas, history, opts)      → gráfico grande (linha ou candlestick)
//   formatShortDate(ts)                  → helper de label de eixo X

import { formatCurrency } from './utils.js';

/* ================================================================
   Helpers internos
   ================================================================ */

/** Configura um canvas para alta resolução (retina/HiDPI). */
function setupHiDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

/** Agrupa valores numéricos em "buckets" somando uma propriedade comum. */
function minMax(points, key) {
  let lo = Infinity, hi = -Infinity;
  for (const p of points) {
    const v = p[key];
    if (v == null || isNaN(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return { lo: 0, hi: 1 };
  if (lo === hi) return { lo: lo * 0.95, hi: hi * 1.05 };
  // Padding 6% para a linha não encostar na borda.
  const pad = (hi - lo) * 0.06;
  return { lo: lo - pad, hi: hi + pad };
}

/** Formata data curta para label do eixo X. */
export function formatShortDate(ts) {
  const d = new Date(ts);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                  'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  return `${day}/${mon}`;
}

/* ================================================================
   Sparkline — mini-gráfico de linha nos cards
   Desenha o histórico de close num canvas pequeno (sem eixos).
   Responsivo: redesenha no resize via ResizeObserver (gerido pelo caller).
   ================================================================ */

export function drawSparkline(canvas, points, opts = {}) {
  if (!canvas) return;
  const { color = null, width = 2, fill = true } = opts;

  const valid = points.filter((p) => p.c != null);
  if (valid.length < 2) {
    clearCanvas(canvas);
    return;
  }

  const { ctx, w, h } = setupHiDPI(canvas);
  canvas._sparkWidth = w;
  canvas._sparkHeight = h;

  // Determina cor com base na tendência (primeiro vs último)
  const first = valid[0].c;
  const last = valid[valid.length - 1].c;
  const trend = last >= first ? 'up' : 'down';
  const stroke = color || (trend === 'up' ? '#22c55e' : '#ef4444');

  const { lo, hi } = minMax(valid, 'c');
  const range = hi - lo || 1;

  const padY = 3;
  const usableH = h - padY * 2;

  // Coordenadas (x cresce da esquerda p/ direita)
  const n = valid.length;
  const stepX = w / (n - 1);
  const pts = valid.map((p, i) => ({
    x: i * stepX,
    y: padY + usableH - ((p.c - lo) / range) * usableH,
  }));

  // Área sob a linha (gradiente)
  if (fill) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (trend === 'up') {
      grad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
      grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    } else {
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[n - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Linha
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Ponto final destacado
  const lastPt = pts[n - 1];
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
}

/* ================================================================
   drawChart — gráfico grande no modal
   type: 'candlestick' | 'line'
   Desenha eixos, grid, candles/linha, eixo X (datas) e tooltips.
   ================================================================ */

export function drawChart(canvas, history, opts = {}) {
  if (!canvas) return;
  const { type = 'candlestick', showVolume = true } = opts;
  const points = history?.points ?? [];

  const { ctx, w, h } = setupHiDPI(canvas);
  canvas._chartWidth = w;
  canvas._chartHeight = h;

  // Limpa
  ctx.clearRect(0, 0, w, h);

  if (points.length < 2) {
    ctx.fillStyle = '#5a606f';
    ctx.font = '0.85rem Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sem dados históricos suficientes.', w / 2, h / 2);
    return;
  }

  // Margens e área de plotagem
  const marginLeft = 56;
  const marginRight = 12;
  const marginTop = 12;
  const volumeH = showVolume ? h * 0.18 : 0;
  const volumeTop = h - volumeH - 22; // 22 = espaço eixo X
  const priceBottom = showVolume ? volumeTop - 6 : h - 22;
  const priceTop = marginTop;
  const priceH = priceBottom - priceTop;
  const plotW = w - marginLeft - marginRight;

  const colors = {
    grid: 'rgba(255,255,255,0.05)',
    axis: '#5a606f',
    text: '#8b919e',
    up: '#22c55e',
    down: '#ef4444',
    upWick: 'rgba(34,197,94,0.85)',
    downWick: 'rgba(239,68,68,0.85)',
    volume: 'rgba(139,145,158,0.3)',
  };

  // ----- Escalas -----
  // Preços: para candlestick usa min/max de low/high; para linha usa close.
  let priceLo, priceHi;
  if (type === 'candlestick') {
    const lo = minMax(points, 'l').lo;
    const hi = minMax(points, 'h').hi;
    priceLo = lo;
    priceHi = hi;
  } else {
    const mm = minMax(points, 'c');
    priceLo = mm.lo;
    priceHi = mm.hi;
  }
  const priceRange = priceHi - priceLo || 1;

  // Volume
  let volMax = 0;
  if (showVolume) {
    for (const p of points) {
      if (p.v != null && p.v > volMax) volMax = p.v;
    }
    if (volMax === 0) volMax = 1;
  }

  const xForIndex = (i) => marginLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yForPrice = (p) => priceTop + priceH - ((p - priceLo) / priceRange) * priceH;
  const n = points.length;

  // ----- Grid horizontal + labels de preço (eixo Y) -----
  ctx.font = '0.68rem Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const frac = i / gridLines;
    const y = priceTop + priceH * frac;
    const price = priceHi - priceRange * frac;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(w - marginRight, y);
    ctx.stroke();
    if (showVolume && y > volumeTop - 4 && y < volumeTop + 4) continue; // não sobre o separador
    ctx.fillStyle = colors.text;
    ctx.fillText(formatCurrency(price), marginLeft - 8, y);
  }

  // Separador área preço / volume
  if (showVolume) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(marginLeft, volumeTop);
    ctx.lineTo(w - marginRight, volumeTop);
    ctx.stroke();
  }

  // ----- Volume (barras) -----
  if (showVolume && volMax > 1) {
    const barW = Math.max(1.5, (plotW / n) * 0.7);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (p.v == null || p.v <= 0) continue;
      const x = xForIndex(i);
      const barH = (p.v / volMax) * (volumeH - 4);
      const y = volumeTop + (volumeH - 4) - barH;
      // Cor do volume acompanha o candle
      const isUp = type === 'candlestick'
        ? (p.c >= p.o)
        : (i === 0 ? true : p.c >= points[i - 1].c);
      ctx.fillStyle = isUp ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)';
      ctx.fillRect(x - barW / 2, y, barW, barH);
    }
  }

  // ----- Eixo X: labels de data (5 marcas distribuídas) -----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = colors.text;
  const xLabelCount = Math.min(5, n);
  for (let i = 0; i < xLabelCount; i++) {
    const idx = Math.round((i / Math.max(1, xLabelCount - 1)) * (n - 1));
    const p = points[idx];
    const x = xForIndex(idx);
    ctx.fillText(formatShortDate(p.t), x, showVolume ? volumeTop + volumeH + 4 : priceBottom + 4);
  }

  // ----- Renderização: candlestick ou linha -----
  if (type === 'candlestick') {
    drawCandles(ctx, points, xForIndex, yForPrice, plotW, colors, opts.hoverIndex ?? -1);
  } else {
    drawLine(ctx, points, xForIndex, yForPrice, colors, opts.hoverIndex ?? -1);
  }

  // ----- Tooltip (se hoverIndex ativo) -----
  const hoverIndex = opts.hoverIndex;
  if (hoverIndex != null && hoverIndex >= 0 && hoverIndex < n) {
    drawTooltip(ctx, points, hoverIndex, xForIndex, yForPrice,
      { w, h, marginLeft, marginRight, priceTop, priceH, colors, type });
  }

  // Guarda metadados para interação (hover) gerida pelo caller via getChartPointAt
  canvas._chartMeta = {
    points, n, marginLeft, marginRight, priceTop, priceH, plotW,
    xForIndex, yForPrice, priceLo, priceHi, priceRange, type, showVolume, volumeTop, volumeH,
  };
}

/* ----- Desenha candles ----- */
function drawCandles(ctx, points, xForIndex, yForPrice, plotW, colors, hover) {
  const n = points.length;
  const candleW = Math.max(2, Math.min(14, (plotW / n) * 0.7));
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (p.o == null || p.c == null || p.h == null || p.l == null) continue;
    const x = xForIndex(i);
    const isUp = p.c >= p.o;
    const color = isUp ? colors.up : colors.down;

    // Sombra (wick) — linha vertical de high a low
    ctx.strokeStyle = isUp ? colors.upWick : colors.downWick;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yForPrice(p.h));
    ctx.lineTo(x, yForPrice(p.l));
    ctx.stroke();

    // Corpo (open→close)
    const yOpen = yForPrice(p.o);
    const yClose = yForPrice(p.c);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillStyle = color;
    const bw = (i === hover) ? candleW + 1 : candleW;
    ctx.fillRect(x - bw / 2, bodyTop, bw, bodyH);

    // Highlight no candle em hover
    if (i === hover) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - bw / 2 - 1, bodyTop - 1, bw + 2, bodyH + 2);
    }
  }
}

/* ----- Desenha linha ----- */
function drawLine(ctx, points, xForIndex, yForPrice, colors, hover) {
  const n = points.length;
  const valid = points.filter((p) => p.c != null);
  if (valid.length < 2) return;

  // Área sob a linha
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xForIndex(i);
    const y = yForPrice(p.c);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const firstX = xForIndex(0);
  const lastX = xForIndex(n - 1);
  ctx.lineTo(lastX, yForPrice(points[n - 1].c));
  ctx.lineTo(firstX, yForPrice(points[n - 1].c));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  grad.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Linha
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xForIndex(i);
    const y = yForPrice(p.c);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Ponto de hover
  if (hover >= 0 && hover < n) {
    const x = xForIndex(hover);
    const y = yForPrice(points[hover].c);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#0a0e17';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* ----- Tooltip no hover ----- */
function drawTooltip(ctx, points, idx, xForIndex, yForPrice, geo) {
  const p = points[idx];
  const x = xForIndex(idx);
  const { w, h, marginLeft, marginRight } = geo;

  // Linha vertical de hover
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(x, geo.priceTop);
  ctx.lineTo(x, geo.showVolume ? geo.volumeTop + geo.volumeH : h - 22);
  ctx.stroke();
  ctx.setLineDash([]);

  // Caixa de tooltip
  const padX = 10, padY = 8, lineH = 16;
  const dateStr = new Date(p.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const lines = [
    dateStr,
    `O: ${p.o != null ? formatCurrency(p.o) : '—'}`,
    `H: ${p.h != null ? formatCurrency(p.h) : '—'}`,
    `L: ${p.l != null ? formatCurrency(p.l) : '—'}`,
    `C: ${p.c != null ? formatCurrency(p.c) : '—'}`,
  ];
  if (p.v != null) lines.push(`Vol: ${formatVolShort(p.v)}`);

  ctx.font = '0.72rem Inter, system-ui, sans-serif';
  let maxW = 0;
  for (const ln of lines) {
    const m = ctx.measureText(ln);
    if (m.width > maxW) maxW = m.width;
  }
  const boxW = Math.ceil(maxW + padX * 2);
  const boxH = padY * 2 + lineH * lines.length;

  // Posição: evita sair da área
  let boxX = x + 10;
  if (boxX + boxW > w - marginRight) boxX = x - boxW - 10;
  if (boxX < marginLeft) boxX = marginLeft;
  const boxY = geo.priceTop + 8;

  // Fundo
  ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  // Texto
  ctx.fillStyle = '#e4e7ef';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((ln, i) => {
    if (i === 0) {
      ctx.fillStyle = '#8b919e';
      ctx.fillText(ln, boxX + padX, boxY + padY + i * lineH);
      ctx.fillStyle = '#e4e7ef';
    } else {
      ctx.fillText(ln, boxX + padX, boxY + padY + i * lineH);
    }
  });
}

/** Cantos arredondados. */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Formata volume curto para tooltip. */
function formatVolShort(v) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

/* ================================================================
   Interatividade — encontra o índice do ponto sob o cursor.
   Retorna -1 se estiver fora da área de plotagem.
   ================================================================ */

export function getChartPointAt(canvas, mouseX) {
  const meta = canvas._chartMeta;
  if (!meta) return -1;
  const rect = canvas.getBoundingClientRect();
  const x = mouseX - rect.left;
  if (x < meta.marginLeft || x > rect.width - meta.marginRight) return -1;
  const rel = (x - meta.marginLeft) / meta.plotW;
  const idx = Math.round(rel * (meta.n - 1));
  return Math.max(0, Math.min(meta.n - 1, idx));
}

/* ================================================================
   clearCanvas — limpa e cede espaço.
   ================================================================ */
function clearCanvas(canvas) {
  const { ctx, w, h } = setupHiDPI(canvas);
  ctx.clearRect(0, 0, w, h);
}
