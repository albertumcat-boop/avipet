// ============================================================
// server.js — AVIPET Bridge v1.0
// HTTP local → TCP Aclas CR2050
// Escucha en http://localhost:3001
// ============================================================
const express = require('express');
const cors    = require('cors');
const aclas   = require('./aclas-driver');
const cfg     = require('./config.json');

const app = express();
app.use(cors());
app.use(express.json());

// ── GET /health — AVIPET verifica que el bridge está vivo ─
app.get('/health', async (req, res) => {
  try {
    const estado = await aclas.healthCheck();
    res.json({
      bridge: 'ok',
      version: '1.0.0',
      aclas: estado
    });
  } catch (e) {
    res.status(500).json({ bridge: 'ok', aclas: { ok: false, error: e.message } });
  }
});

// ── POST /factura — Emitir factura fiscal ─────────────────
// Body esperado:
// {
//   items: [{ descripcion, precioUSD, cantidad, alicuotaIVA }],
//   cliente: { rif, nombre } | null,
//   monedaPago: 'USD' | 'BS' | 'TARJETA' | 'ZELLE' | 'MIXTO',
//   totalUSD: number,
//   tasaBCV: number
// }
app.post('/factura', async (req, res) => {
  const { items, cliente, monedaPago, totalUSD, tasaBCV } = req.body;

  // Validación básica
  if (!items || !items.length) {
    return res.status(400).json({ error: 'Se requiere al menos un ítem.' });
  }
  if (typeof totalUSD !== 'number' || totalUSD <= 0) {
    return res.status(400).json({ error: 'totalUSD inválido.' });
  }

  try {
    const resultado = await aclas.emitirFactura({ items, cliente, monedaPago, totalUSD, tasaBCV });
    console.log(`[BRIDGE] Factura emitida: #${resultado.numeroFactura} / Control: ${resultado.numeroControl}`);
    res.json({
      ok: true,
      numeroFactura: resultado.numeroFactura,
      numeroControl: resultado.numeroControl,
      raw: resultado.raw
    });
  } catch (err) {
    console.error('[BRIDGE] Error al emitir factura:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Arranque ──────────────────────────────────────────────
const PORT = cfg.bridge.port || 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[AVIPET Bridge] corriendo en http://localhost:${PORT}`);
  console.log(`[AVIPET Bridge] Aclas en ${cfg.aclas.ip}:${cfg.aclas.port}`);
  console.log('[AVIPET Bridge] Presiona Ctrl+C para detener');
});
