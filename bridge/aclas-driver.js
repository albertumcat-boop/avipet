// ============================================================
// aclas-driver.js — Protocolo TCP para Aclas CR2050 / HKA
// Frame: STX(0x02) + DATA + ETX(0x03) + LRC(XOR de DATA+ETX)
// Ref: Manual de Protocolos y Comandos Venezuela v8.3
// ============================================================
const net = require('net');
const cfg = require('./config.json');

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;

// ── Construcción de frame ─────────────────────────────────
function buildFrame(cmd) {
  const dataBytes = Buffer.from(cmd, 'latin1');
  const etxBuf    = Buffer.from([ETX]);
  const payload   = Buffer.concat([dataBytes, etxBuf]);
  let lrc = 0;
  for (const b of payload) lrc ^= b;
  return Buffer.concat([Buffer.from([STX]), payload, Buffer.from([lrc])]);
}

// ── Formato de campos numéricos ───────────────────────────
// Precio: 10 dígitos, 2 decimales implícitos ($15.50 → "0000001550")
function fmtPrice(usd) {
  return String(Math.round(parseFloat(usd) * 100)).padStart(10, '0');
}
// Cantidad: 8 dígitos, 3 decimales implícitos (1 unidad → "00001000")
function fmtQty(q) {
  return String(Math.round(parseFloat(q) * 1000)).padStart(8, '0');
}
// Descripción: máx 20 caracteres, sin caracteres especiales
function fmtDesc(s) {
  return String(s || '').replace(/[^\x20-\x7E]/g, ' ').substring(0, 20);
}

// ── Envío de un frame y espera de respuesta ───────────────
function sendCmd(socket, cmd) {
  return new Promise((resolve, reject) => {
    const frame = buildFrame(cmd);
    const timer = setTimeout(() => reject(new Error('Timeout esperando respuesta de la Aclas')), cfg.aclas.timeoutMs);

    socket.once('data', (data) => {
      clearTimeout(timer);
      if (data[0] === ACK) resolve(data);
      else if (data[0] === NAK) reject(new Error(`NAK recibido para comando: ${cmd.substring(0, 4)}`));
      else resolve(data); // respuesta con datos (ej. número de factura)
    });

    socket.write(frame);
  });
}

// ── Parsear respuesta con número de factura ───────────────
// La Aclas devuelve campos separados por 0x0A en la respuesta de cierre
function parseFacturaResp(buf) {
  const str   = buf.toString('latin1');
  const parts = str.split('\n').map(s => s.replace(/[\x00-\x1F]/g, '').trim()).filter(Boolean);
  // Formato típico: [numeroFactura, numeroControl, fecha, hora, ...]
  return {
    numeroFactura: parts[0] || '',
    numeroControl: parts[1] || '',
    raw: parts
  };
}

// ── Flujo completo: emitir factura fiscal ─────────────────
async function emitirFactura(data) {
  const { items, cliente, monedaPago, totalUSD, tasaBCV } = data;
  const pagoCode  = cfg.pagos[monedaPago] || cfg.pagos['USD'];
  const totalBs   = parseFloat((totalUSD * (tasaBCV || 1)).toFixed(2));

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(cfg.aclas.timeoutMs);

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Timeout de conexión con la Aclas (IP: ' + cfg.aclas.ip + ')'));
    });

    socket.on('error', (err) => {
      reject(new Error('No se pudo conectar a la Aclas: ' + err.message));
    });

    socket.connect(cfg.aclas.port, cfg.aclas.ip, async () => {
      try {
        // 1. Datos del receptor (solo si tiene RIF)
        if (cliente && cliente.rif) {
          await sendCmd(socket, `iR*${cliente.rif}`);
          await sendCmd(socket, `iS*${fmtDesc(cliente.nombre || 'CONSUMIDOR FINAL')}`);
        }

        // 2. Ítems del carrito
        for (const item of items) {
          const taxCode = cfg.alicuotas[String(item.alicuotaIVA || 16)] || cfg.alicuotas['16'];
          const precio  = fmtPrice(item.precioUSD);
          const qty     = fmtQty(item.cantidad || 1);
          const desc    = fmtDesc(item.descripcion);
          const cmd     = `!${precio}${qty}${String.fromCharCode(taxCode)}${desc}`;
          await sendCmd(socket, cmd);
        }

        // 3. Pago y cierre del documento
        const pagoMonto = fmtPrice(totalBs);
        const respBuf   = await sendCmd(socket, `1${pagoCode}${pagoMonto}`);

        // 4. Parsear número de factura devuelto
        const result = parseFacturaResp(respBuf);

        socket.destroy();
        resolve(result);
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });
  });
}

// ── Estado / diagnóstico de la máquina ───────────────────
async function healthCheck() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect',  () => { socket.destroy(); resolve({ ok: true,  ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.on('error',    () => { socket.destroy(); resolve({ ok: false, ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.on('timeout',  () => { socket.destroy(); resolve({ ok: false, ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.connect(cfg.aclas.port, cfg.aclas.ip);
  });
}

module.exports = { emitirFactura, healthCheck, buildFrame, fmtPrice, fmtQty };
