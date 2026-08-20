// ============================================================
// aclas-driver.js — Protocolo Aclas CR2050 / HKA
// Soporta dos modos de conexión (configurar en config.json):
//   "modo": "tcp"    → Ethernet/Switch (puerto 8888)
//   "modo": "serial" → Cable RS232-USB  (ej. COM3)
// Frame: STX(0x02) + DATA + ETX(0x03) + LRC(XOR de DATA+ETX)
// Ref: Manual de Protocolos y Comandos Venezuela v8.3
// ============================================================
const net    = require('net');
const cfg    = require('./config.json');

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
function fmtPrice(usd) {
  return String(Math.round(parseFloat(usd) * 100)).padStart(10, '0');
}
function fmtQty(q) {
  return String(Math.round(parseFloat(q) * 1000)).padStart(8, '0');
}
function fmtDesc(s) {
  return String(s || '').replace(/[^\x20-\x7E]/g, ' ').substring(0, 20);
}

// ── Resolver departamento ─────────────────────────────────
function _resolverDepartamento(item) {
  const iva = parseInt(item.alicuotaIVA ?? 16);
  const cat = String(item.categoria || '').toLowerCase();

  if (iva === 0) {
    if (cat.includes('medicin') || cat.includes('medic') || cat.includes('farmac')) return 1;
    if (cat.includes('aliment') || cat.includes('comida') || cat.includes('croqueta')) return 2;
    return 3;
  }
  if (iva === 16) {
    if (cat.includes('medicin') || cat.includes('medic') || cat.includes('farmac') ||
        cat.includes('consul')  || cat.includes('vacuna')) return 4;
    if (cat.includes('aliment') || cat.includes('comida') || cat.includes('croqueta')) return 5;
    if (cat.includes('insect') || cat.includes('parasiticid') || cat.includes('antipulga')) return 6;
    if (cat.includes('cria') || cat.includes('avicola') || cat.includes('gallina')) return 7;
    if (cat.includes('accesori') || cat.includes('collar') || cat.includes('juguete') ||
        cat.includes('cama')    || cat.includes('bebeder')) return 8;
    if (cat.includes('peluca') || cat.includes('estetica') || cat.includes('baño') ||
        cat.includes('groomin')) return 9;
    return 10;
  }
  return 10;
}

// ── Parsear respuesta con número de factura ───────────────
function parseFacturaResp(buf) {
  const str   = buf.toString('latin1');
  const parts = str.split('\n').map(s => s.replace(/[\x00-\x1F]/g, '').trim()).filter(Boolean);
  return { numeroFactura: parts[0] || '', numeroControl: parts[1] || '', raw: parts };
}

// ============================================================
// MODO TCP — conexión por red (switch/LAN)
// ============================================================
function _crearSocketTCP() {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(cfg.aclas.timeoutMs);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout TCP con la Aclas')); });
    socket.on('error',   (e) => { reject(new Error('Error TCP: ' + e.message)); });
    socket.connect(cfg.aclas.port, cfg.aclas.ip, () => resolve(socket));
  });
}

function _sendCmdTCP(socket, cmd) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout respuesta TCP: ' + cmd.substring(0,4))), cfg.aclas.timeoutMs);
    socket.once('data', (data) => {
      clearTimeout(timer);
      if (data[0] === NAK) reject(new Error('NAK del comando: ' + cmd.substring(0,4)));
      else resolve(data);
    });
    socket.write(buildFrame(cmd));
  });
}

async function _emitirTCP(data) {
  const socket = await _crearSocketTCP();
  try {
    const { items, cliente, monedaPago, totalUSD, tasaBCV } = data;
    const pagoCode = cfg.pagos[monedaPago] || '02';
    const totalBs  = parseFloat((totalUSD * (tasaBCV || 1)).toFixed(2));

    if (cliente?.rif) {
      await _sendCmdTCP(socket, `iR*${cliente.rif}`);
      await _sendCmdTCP(socket, `iS*${fmtDesc(cliente.nombre || 'CONSUMIDOR FINAL')}`);
    }
    for (const item of items) {
      const depto = _resolverDepartamento(item);
      await _sendCmdTCP(socket, `DP${depto}${fmtPrice(item.precioUSD)}${fmtQty(item.cantidad || 1)}${fmtDesc(item.descripcion)}`);
    }
    const respBuf = await _sendCmdTCP(socket, `1${pagoCode}${fmtPrice(totalBs)}`);
    socket.destroy();
    return parseFacturaResp(respBuf);
  } catch(e) {
    socket.destroy();
    throw e;
  }
}

async function _healthTCP() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => { socket.destroy(); resolve({ ok: true,  modo: 'tcp', ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.on('error',   () => { socket.destroy(); resolve({ ok: false, modo: 'tcp', ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, modo: 'tcp', ip: cfg.aclas.ip, port: cfg.aclas.port }); });
    socket.connect(cfg.aclas.port, cfg.aclas.ip);
  });
}

// ============================================================
// MODO SERIAL — conexión RS232 por cable USB
// ============================================================
let _serialLib = null;

function _getSerial() {
  if (!_serialLib) {
    try { _serialLib = require('serialport'); }
    catch(e) { throw new Error('Módulo serialport no instalado. Ejecuta: npm install serialport'); }
  }
  return _serialLib;
}

function _crearSocketSerial() {
  return new Promise((resolve, reject) => {
    const { SerialPort } = _getSerial();
    const sp = new SerialPort({
      path:     cfg.serial.port,
      baudRate: cfg.serial.baudRate || 9600,
      dataBits: cfg.serial.dataBits || 8,
      parity:   cfg.serial.parity   || 'even',
      stopBits: cfg.serial.stopBits || 1,
      autoOpen: false
    });
    sp.open((err) => {
      if (err) reject(new Error(`No se pudo abrir ${cfg.serial.port}: ${err.message}`));
      else     resolve(sp);
    });
  });
}

function _sendCmdSerial(sp, cmd) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout serial: ' + cmd.substring(0,4))), cfg.serial.timeoutMs || 8000);
    sp.once('data', (data) => {
      clearTimeout(timer);
      if (data[0] === NAK) reject(new Error('NAK serial: ' + cmd.substring(0,4)));
      else resolve(data);
    });
    sp.write(buildFrame(cmd));
  });
}

async function _emitirSerial(data) {
  const sp = await _crearSocketSerial();
  try {
    const { items, cliente, monedaPago, totalUSD, tasaBCV } = data;
    const pagoCode = cfg.pagos[monedaPago] || '02';
    const totalBs  = parseFloat((totalUSD * (tasaBCV || 1)).toFixed(2));

    if (cliente?.rif) {
      await _sendCmdSerial(sp, `iR*${cliente.rif}`);
      await _sendCmdSerial(sp, `iS*${fmtDesc(cliente.nombre || 'CONSUMIDOR FINAL')}`);
    }
    for (const item of items) {
      const depto = _resolverDepartamento(item);
      await _sendCmdSerial(sp, `DP${depto}${fmtPrice(item.precioUSD)}${fmtQty(item.cantidad || 1)}${fmtDesc(item.descripcion)}`);
    }
    const respBuf = await _sendCmdSerial(sp, `1${pagoCode}${fmtPrice(totalBs)}`);
    sp.close();
    return parseFacturaResp(respBuf);
  } catch(e) {
    sp.close();
    throw e;
  }
}

async function _healthSerial() {
  try {
    const { SerialPort } = _getSerial();
    const ports = await SerialPort.list();
    const encontrado = ports.find(p => p.path === cfg.serial.port);
    return { ok: !!encontrado, modo: 'serial', port: cfg.serial.port, puertosDisponibles: ports.map(p => p.path) };
  } catch(e) {
    return { ok: false, modo: 'serial', error: e.message };
  }
}

// ============================================================
// API PÚBLICA — usa el modo configurado en config.json
// ============================================================
async function emitirFactura(data) {
  if (cfg.modo === 'serial') return _emitirSerial(data);
  return _emitirTCP(data);
}

async function healthCheck() {
  if (cfg.modo === 'serial') return _healthSerial();
  return _healthTCP();
}

module.exports = { emitirFactura, healthCheck, buildFrame };
