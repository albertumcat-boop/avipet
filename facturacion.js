// =========================================================
// AVIPET — facturacion.js v1
// Módulo de facturación fiscal SENIAT (Opción A — Máquina Fiscal)
// Página independiente: facturacion.html
// =========================================================
import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, runTransaction,
  onSnapshot, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── ESTADO ────────────────────────────────────────────
let _carrito        = [];
let _clienteActual  = null;
let _configFiscal   = {};
let _monedaPago     = 'USD';
let _esConsumidorFinal = true;
let _masterKey      = null;
let _tasaBCV        = 1;
let _serviciosHoy   = []; // referencia para botones "Agregar" de servicios del día

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await _cargarConfigFiscal();
  _renderCarrito();
  cargarHistorialFacturas();
  _initBarcodeReader();
  cambiarMonedaPago('USD');
});

// ─── CONFIG FISCAL ─────────────────────────────────────
async function _cargarConfigFiscal() {
  try {
    const [snapFiscal, snapTasa, snapSistema] = await Promise.all([
      getDoc(doc(db, 'configuracion', 'fiscal')),
      getDoc(doc(db, 'configuracion', 'tasa')),
      getDoc(doc(db, 'configuracion', 'sistema'))
    ]);

    _configFiscal = snapFiscal.exists() ? snapFiscal.data() : {
      rifEmisor: '', razonSocial: 'AVIPET', direccionFiscal: '',
      serieId: 'A', alicuotaIGTF: 3, esContribuyenteEspecial: true
    };

    if (snapTasa.exists()) _tasaBCV = parseFloat(snapTasa.data().valor || 1);
    if (snapSistema.exists()) _masterKey = snapSistema.data().masterKey || null;

    const rifDisplay = document.getElementById('rifEmisorDisplay');
    if (rifDisplay) rifDisplay.textContent = _configFiscal.rifEmisor || 'Sin configurar — ⚙️ Configura el RIF';

    if (!_configFiscal.rifEmisor) {
      document.getElementById('alertaConfigFiscal')?.classList.remove('hidden');
    }
  } catch(e) {
    console.warn('[FACT] Error cargando config:', e);
  }
}

// ─── BUSCAR CLIENTE ─────────────────────────────────────
window.buscarClienteFact = async () => {
  const ci = (document.getElementById('buscadorCIFact')?.value || '')
    .trim().replace(/[.\-\s]/g, '').toUpperCase();
  if (!ci) return;

  const cont = document.getElementById('serviciosHoyPanel');
  cont.innerHTML = '<p class="text-center text-blue-500 text-xs font-bold italic animate-pulse py-4">Buscando...</p>';

  const hoy   = new Date();
  const hoyStr = `${hoy.getDate()}/${hoy.getMonth()+1}/${hoy.getFullYear()}`;

  try {
    const [snapCons, snapPelu] = await Promise.all([
      getDocs(query(collection(db,'consultas'),   where('cedula','==',ci),        where('fechaSimple','==',hoyStr))),
      getDocs(query(collection(db,'servicios_estetica'), where('cedulaCliente','==',ci), where('fechaSimple','==',hoyStr)))
    ]);

    const servicios = [];

    snapCons.forEach(d => {
      const r = d.data();
      if (r.facturado) return;
      servicios.push({
        id: d.id, tipo: 'consulta',
        descripcion: 'CONSULTA VETERINARIA' + (r.paciente ? ` — ${r.paciente.toUpperCase()}` : ''),
        precio: parseFloat(r.montoVenta || 0),
        propietario: r.propietario || '', cedula: r.cedula || '',
        telefono: r.telefono || '', alicuotaIVA: 16
      });
    });

    snapPelu.forEach(d => {
      const r = d.data();
      if (r.facturado) return;
      servicios.push({
        id: d.id, tipo: 'peluqueria',
        descripcion: (r.servicio || 'SERVICIO ESTÉTICA') + (r.paciente ? ` — ${r.paciente.toUpperCase()}` : ''),
        precio: parseFloat(r.precioTotal || 0),
        propietario: r.duenio || '', cedula: r.cedulaCliente || '',
        telefono: r.telefono || '', alicuotaIVA: 16
      });
    });

    if (!servicios.length) {
      cont.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-6">Sin servicios pendientes de facturar hoy para este cliente.</p>';
      return;
    }

    const primero = servicios[0];
    _clienteActual = { cedula: primero.cedula, propietario: primero.propietario, telefono: primero.telefono };
    document.getElementById('clienteNombreFact').textContent = primero.propietario || ci;
    document.getElementById('clienteCIFact').textContent     = `CI: ${ci}`;
    document.getElementById('clientePanel')?.classList.remove('hidden');

    // Auto-rellenar campos del receptor con datos de la consulta
    const panelRIF = document.getElementById('panelRIF');
    if (panelRIF) {
      // Cambiar a modo "Con RIF" para mostrar los campos
      _esConsumidorFinal = false;
      document.getElementById('btnConsumidorFinal')?.classList.replace('bg-blue-600','bg-slate-100');
      document.getElementById('btnConsumidorFinal')?.classList.replace('text-white','text-slate-500');
      document.getElementById('btnConsumidorFinal')?.classList.remove('shadow');
      document.getElementById('btnConRIF')?.classList.replace('bg-slate-100','bg-blue-600');
      document.getElementById('btnConRIF')?.classList.replace('text-slate-500','text-white');
      document.getElementById('btnConRIF')?.classList.add('shadow');
      panelRIF.classList.remove('hidden');

      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('inputRIFReceptor',     `V-${primero.cedula}`);
      set('inputCedulaReceptor',  `V-${primero.cedula}`);
      set('inputNomReceptor',     primero.propietario);
      set('inputTelefonoReceptor',primero.telefono);
    }

    _serviciosHoy = servicios; // expuesto para botones inline
    cont.innerHTML = '';
    servicios.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 mb-2 hover:border-blue-300 transition-all';
      const icono = s.tipo === 'consulta' ? '🏥' : '✂️';
      const tipoLabel = s.tipo === 'consulta' ? 'Veterinaria' : 'Peluquería';
      // Estructura HTML solo con datos seguros (números y emojis)
      div.innerHTML = `
        <div class="flex-1">
          <p class="text-[11px] font-black text-slate-800 uppercase leading-tight" data-desc></p>
          <p class="text-[9px] text-slate-400 mt-0.5">${icono} ${tipoLabel} · IVA ${s.alicuotaIVA}%</p>
        </div>
        <div class="flex items-center gap-2 ml-2">
          <span class="text-[13px] font-black text-blue-700">$${s.precio.toFixed(2)}</span>
          <button data-idx="${idx}"
            class="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-blue-700 shadow transition-all">
            + Agregar
          </button>
        </div>`;
      // Datos del usuario via textContent para evitar XSS
      div.querySelector('[data-desc]').textContent = s.descripcion;
      div.querySelector('[data-idx]').addEventListener('click', () => window.agregarServicioAlCarrito(_serviciosHoy[idx]));
      cont.appendChild(div);
    });

  } catch(e) {
    console.error(e);
    cont.innerHTML = `<p class="text-center text-red-500 text-xs italic py-4">Error: ${e.message}</p>`;
  }
};

// ─── CARRITO ────────────────────────────────────────────
window.agregarServicioAlCarrito = (s) => {
  if (_carrito.find(i => i.id === s.id && i.tipo === s.tipo)) {
    Swal.fire({ icon:'info', title:'Ya está en el carrito', timer:1500, showConfirmButton:false });
    return;
  }
  _carrito.push({ ...s, cantidad: 1, bloqueado: true });
  _renderCarrito();
  Swal.fire({ icon:'success', title:'Agregado ✓', timer:800, showConfirmButton:false });
};

window.agregarProductoAlCarrito = async (codigo) => {
  if (!codigo) return;
  const btn = document.getElementById('btnBuscarBarcode');
  if (btn) btn.disabled = true;
  try {
    let snap = await getDocs(query(collection(db,'inventario'), where('codigoBarra','==',codigo), limit(1)));
    if (snap.empty) {
      // Try uppercase
      snap = await getDocs(query(collection(db,'inventario'), where('codigoBarra','==',codigo.toUpperCase()), limit(1)));
    }
    if (snap.empty) {
      Swal.fire({ icon:'warning', title:'Producto no encontrado', text:`Código: ${codigo}`, timer:2000, showConfirmButton:false });
      document.getElementById('inputBarcode').value = '';
      return;
    }
    const d = snap.docs[0];
    const p = d.data();
    const existente = _carrito.find(i => i.id === d.id && i.tipo === 'producto');
    if (existente) {
      existente.cantidad++;
    } else {
      _carrito.push({
        id: d.id, tipo: 'producto',
        descripcion: (p.nombre || codigo).toUpperCase(),
        precio: parseFloat(p.precioVenta || 0),
        cantidad: 1,
        alicuotaIVA: parseFloat(p.alicuotaIVA ?? 16),
        bloqueado: true,
        stockActual: parseFloat(p.cantidadStock || 0)
      });
    }
    _renderCarrito();
    document.getElementById('inputBarcode').value = '';
  } catch(e) {
    console.error(e);
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.buscarProductoManual = async () => {
  const { value: nombre } = await Swal.fire({
    title: 'Buscar producto',
    input: 'text', inputPlaceholder: 'Nombre del producto...',
    showCancelButton: true, confirmButtonText: 'Buscar',
    confirmButtonColor: '#1d4ed8'
  });
  if (!nombre) return;

  try {
    const snap = await getDocs(query(collection(db,'inventario'), orderBy('nombre'), limit(100)));
    const norm = t => t.toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    const filtro = snap.docs.filter(d => norm(d.data().nombre||'').includes(norm(nombre)));

    if (!filtro.length) {
      Swal.fire({ icon:'warning', title:'Sin resultados', text:`"${nombre}" no encontrado.`, timer:2000, showConfirmButton:false });
      return;
    }
    if (filtro.length === 1) {
      const p = { id: filtro[0].id, ...filtro[0].data() };
      _agregarProductoObjeto(p);
      return;
    }

    const opciones = {};
    filtro.slice(0,8).forEach(d => { opciones[d.id] = `${d.data().nombre} — $${parseFloat(d.data().precioVenta||0).toFixed(2)}`; });
    const { value: selId } = await Swal.fire({
      title: 'Selecciona el producto',
      input: 'select', inputOptions: opciones,
      showCancelButton: true, confirmButtonColor: '#1d4ed8'
    });
    if (!selId) return;
    const selDoc = filtro.find(d => d.id === selId);
    if (selDoc) _agregarProductoObjeto({ id: selDoc.id, ...selDoc.data() });
  } catch(e) { console.error(e); }
};

function _agregarProductoObjeto(p) {
  const existente = _carrito.find(i => i.id === p.id && i.tipo === 'producto');
  if (existente) { existente.cantidad++; }
  else {
    _carrito.push({
      id: p.id, tipo: 'producto',
      descripcion: (p.nombre || '').toUpperCase(),
      precio: parseFloat(p.precioVenta || 0),
      cantidad: 1,
      alicuotaIVA: parseFloat(p.alicuotaIVA ?? 16),
      bloqueado: true,
      stockActual: parseFloat(p.cantidadStock || 0)
    });
  }
  _renderCarrito();
}

window.eliminarDelCarrito = (idx) => {
  _carrito.splice(idx, 1);
  _renderCarrito();
};

window.cambiarCantidad = (idx, delta) => {
  _carrito[idx].cantidad = Math.max(1, (_carrito[idx].cantidad || 1) + delta);
  _renderCarrito();
};

window.editarPrecioCarrito = async (idx) => {
  const clave = prompt('🔐 Clave Maestra para modificar precio:');
  if (clave === null) return;
  if (clave.trim() !== _masterKey) { Swal.fire({ icon:'error', title:'🚫 Clave incorrecta', timer:1500, showConfirmButton:false }); return; }
  const { value: nuevo } = await Swal.fire({
    title: 'Nuevo precio',
    input: 'number', inputValue: _carrito[idx].precio.toFixed(2),
    inputAttributes: { step:'0.01', min:'0' },
    showCancelButton: true, confirmButtonColor: '#1d4ed8'
  });
  if (nuevo === undefined || nuevo === '') return;
  _carrito[idx].precio = parseFloat(nuevo);
  _renderCarrito();
};

function _renderCarrito() {
  const cont = document.getElementById('carritoItems');
  if (!cont) return;

  if (!_carrito.length) {
    cont.innerHTML = '<p class="text-center text-slate-400 text-[10px] italic py-8">Carrito vacío — agrega servicios o productos</p>';
  } else {
    cont.innerHTML = '';
    _carrito.forEach((item, idx) => {
      const subtotal = item.precio * item.cantidad;
      const div = document.createElement('div');
      div.className = 'border-b border-slate-100 py-2.5 flex items-start gap-2';
      div.innerHTML = `
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-black text-slate-800 uppercase leading-tight truncate" data-desc></p>
          <div class="flex items-center gap-1 mt-1">
            <span class="text-[8px] text-slate-400">IVA ${item.alicuotaIVA}%</span>
            <button data-edit class="text-[8px] text-blue-500 underline ml-1">$${item.precio.toFixed(2)} 🔐</button>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${item.tipo === 'producto'
            ? `<button data-dec class="w-5 h-5 bg-slate-200 rounded font-black text-xs leading-none">−</button>
               <span class="text-[11px] font-black w-5 text-center">${item.cantidad}</span>
               <button data-inc class="w-5 h-5 bg-slate-200 rounded font-black text-xs leading-none">+</button>`
            : `<span class="text-[11px] font-black w-5 text-center">1</span>`
          }
          <span class="text-[12px] font-black text-blue-700 w-16 text-right">$${subtotal.toFixed(2)}</span>
          <button data-del class="text-red-400 hover:text-red-600 font-black text-sm ml-1">✕</button>
        </div>`;
      // Datos de usuario via textContent
      div.querySelector('[data-desc]').textContent = item.descripcion;
      div.querySelector('[data-edit]').addEventListener('click', () => window.editarPrecioCarrito(idx));
      div.querySelector('[data-del]').addEventListener('click',  () => window.eliminarDelCarrito(idx));
      if (item.tipo === 'producto') {
        div.querySelector('[data-dec]').addEventListener('click', () => window.cambiarCantidad(idx, -1));
        div.querySelector('[data-inc]').addEventListener('click', () => window.cambiarCantidad(idx,  1));
      }
      cont.appendChild(div);
    });
  }

  _renderTotales(_calcularTotales());
}

// ─── CÁLCULO IVA / IGTF ────────────────────────────────
// Los precios en inventario YA incluyen IVA → se retrocálcula la base
function _calcularTotales() {
  const grupos = {};
  _carrito.forEach(item => {
    const aliq      = item.alicuotaIVA ?? 16;
    const totalItem = item.precio * item.cantidad;
    const base      = aliq > 0
      ? parseFloat((totalItem / (1 + aliq / 100)).toFixed(4))
      : totalItem;
    const iva       = parseFloat((totalItem - base).toFixed(4));
    if (!grupos[aliq]) grupos[aliq] = { base: 0, iva: 0 };
    grupos[aliq].base += base;
    grupos[aliq].iva  += iva;
  });

  const totalBase = Object.values(grupos).reduce((s,g) => s + g.base, 0);
  const totalIVA  = Object.values(grupos).reduce((s,g) => s + g.iva,  0);
  const subtotalConIVA = totalBase + totalIVA;

  const alicuotaIGTF = parseFloat(_configFiscal.alicuotaIGTF || 0) / 100;
  const igtf = (_monedaPago === 'USD' && _configFiscal.esContribuyenteEspecial && alicuotaIGTF > 0)
    ? subtotalConIVA * alicuotaIGTF : 0;

  const totalUSD = subtotalConIVA + igtf;
  const totalVES = totalUSD * _tasaBCV;

  return { grupos, totalBase, totalIVA, igtf, subtotalConIVA, totalUSD, totalVES, tasa: _tasaBCV };
}

function _renderTotales(t) {
  const el = id => document.getElementById(id);

  const desglose = el('desgloseIVA');
  if (desglose) {
    desglose.innerHTML = '';
    Object.entries(t.grupos).forEach(([aliq, g]) => {
      if (!g.base) return;
      desglose.insertAdjacentHTML('beforeend', `
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>Base imponible ${aliq}%:</span><span class="font-bold">$${g.base.toFixed(2)}</span>
        </div>
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>IVA ${aliq}%:</span><span class="font-bold text-emerald-600">$${g.iva.toFixed(2)}</span>
        </div>`);
    });
  }

  if (el('totalIVADisplay'))  el('totalIVADisplay').textContent  = `$${t.totalIVA.toFixed(2)}`;
  if (el('totalBaseDisplay')) el('totalBaseDisplay').textContent = `$${t.totalBase.toFixed(2)}`;

  const igtfRow = el('igtfRow');
  if (igtfRow) {
    igtfRow.style.display = t.igtf > 0 ? 'flex' : 'none';
    const igtfD = el('igtfDisplay');
    if (igtfD) igtfD.textContent = `$${t.igtf.toFixed(2)}`;
  }

  if (el('totalUSDDisplay')) el('totalUSDDisplay').textContent = `$${t.totalUSD.toFixed(2)}`;
  if (el('totalVESDisplay')) el('totalVESDisplay').textContent = `Bs ${t.totalVES.toFixed(2)}`;
  if (el('tasaBCVDisplay'))  el('tasaBCVDisplay').textContent  = `Tasa BCV: ${t.tasa.toFixed(2)} Bs/$1`;
}

// ─── MÉTODO DE PAGO ─────────────────────────────────────
window.cambiarMonedaPago = (moneda) => {
  _monedaPago = moneda;
  ['USD','VES','MIXTO'].forEach(m => {
    const btn = document.getElementById(`btnPago${m}`);
    if (!btn) return;
    const esActivo = m === moneda;
    btn.className = esActivo
      ? 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-blue-600 text-white shadow'
      : 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-slate-100 text-slate-500 hover:bg-slate-200';
  });
  _renderCarrito();
};

// ─── RECEPTOR ──────────────────────────────────────────
window.toggleConsumidorFinal = () => {
  _esConsumidorFinal = !_esConsumidorFinal;
  document.getElementById('panelRIF')?.classList.toggle('hidden', _esConsumidorFinal);
  const btn = document.getElementById('btnConsumidorFinal');
  if (btn) {
    btn.className = _esConsumidorFinal
      ? 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-blue-600 text-white shadow'
      : 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-slate-100 text-slate-500 hover:bg-slate-200';
  }
  const btnRIF = document.getElementById('btnConRIF');
  if (btnRIF) {
    btnRIF.className = !_esConsumidorFinal
      ? 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-blue-600 text-white shadow'
      : 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all bg-slate-100 text-slate-500 hover:bg-slate-200';
  }
};

// ─── BRIDGE ACLAS ────────────────────────────────────────
const BRIDGE_URL = 'http://localhost:3001';

async function _bridgeHealth() {
  try {
    const r = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(2500) });
    const d = await r.json();
    return d.aclas?.ok === true;
  } catch { return false; }
}

async function _emitirEnAclas(items, cliente, monedaPago, totalUSD, tasaBCV) {
  const r = await fetch(`${BRIDGE_URL}/factura`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, cliente, monedaPago, totalUSD, tasaBCV }),
    signal: AbortSignal.timeout(15000)
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Error desconocido del bridge');
  return d; // { numeroFactura, numeroControl }
}

async function _modoManual() {
  const { value } = await Swal.fire({
    title: '📟 Ingresa los datos de la Aclas',
    html: `<p class="text-[11px] text-slate-500 mb-3">El bridge no está activo. Emite la factura en la máquina Aclas y escribe los números aquí.</p>
      <label class="text-[9px] font-bold text-slate-400 uppercase block mb-1">N° Factura</label>
      <input id="manualFact" type="number" class="swal2-input" placeholder="Ej: 44921">
      <label class="text-[9px] font-bold text-slate-400 uppercase block mb-1 mt-2">N° Control</label>
      <input id="manualCtrl" type="text" class="swal2-input" placeholder="Ej: ZZN0020855">`,
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    confirmButtonColor: '#1d4ed8',
    preConfirm: () => {
      const nf = document.getElementById('manualFact')?.value.trim();
      const nc = document.getElementById('manualCtrl')?.value.trim();
      if (!nf) { Swal.showValidationMessage('El N° de Factura es obligatorio'); return false; }
      return { numeroFactura: parseInt(nf), numeroControl: nc || '' };
    }
  });
  return value; // undefined si canceló
}

// ─── EMITIR FACTURA ─────────────────────────────────────
window.emitirFactura = async () => {
  if (!_carrito.length) {
    Swal.fire({ icon:'warning', title:'Carrito vacío', timer:1500, showConfirmButton:false }); return;
  }
  if (!_configFiscal.rifEmisor) {
    Swal.fire({ icon:'error', title:'Configura el RIF', text:'Ve a ⚙️ Configuración Fiscal antes de emitir.' }); return;
  }
  if (_monedaPago === 'MIXTO' && _configFiscal.esContribuyenteEspecial) {
    const ok = await Swal.fire({
      icon: 'warning', title: 'Pago Mixto — IGTF',
      text: 'Eres contribuyente especial. El IGTF solo se aplica sobre la porción en USD. Verifica el monto manualmente en la máquina fiscal.',
      showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d4ed8'
    });
    if (!ok.isConfirmed) return;
  }

  const rifReceptor = _esConsumidorFinal ? 'CONSUMIDOR FINAL' : (document.getElementById('inputRIFReceptor')?.value.trim() || 'CONSUMIDOR FINAL');
  const nomReceptor = _esConsumidorFinal ? (_clienteActual?.propietario || '') : (document.getElementById('inputNomReceptor')?.value.trim() || '');
  const dirReceptor = _esConsumidorFinal ? '' : (document.getElementById('inputDirReceptor')?.value.trim() || '');
  const cedulaReceptor  = document.getElementById('inputCedulaReceptor')?.value.trim()  || _clienteActual?.cedula || '';
  const telefonoReceptor= document.getElementById('inputTelefonoReceptor')?.value.trim()|| _clienteActual?.telefono|| '';
  const emailReceptor   = document.getElementById('inputEmailReceptor')?.value.trim()   || '';
  const totales     = _calcularTotales();

  const confirmHTML = `<div style="text-align:left;font-size:11px;color:#334155;line-height:1.8;">
    <p><b>Receptor:</b> ${_esConsumidorFinal ? 'Consumidor Final' : rifReceptor}</p>
    <hr style="margin:6px 0;border-color:#e2e8f0;">
    <p><b>Base imponible:</b> $${totales.totalBase.toFixed(2)}</p>
    <p><b>IVA:</b> $${totales.totalIVA.toFixed(2)}</p>
    ${totales.igtf > 0 ? `<p><b>IGTF (${_configFiscal.alicuotaIGTF}%):</b> $${totales.igtf.toFixed(2)}</p>` : ''}
    <hr style="margin:6px 0;border-color:#e2e8f0;">
    <p style="font-size:16px;font-weight:900;color:#1d4ed8;"><b>TOTAL: $${totales.totalUSD.toFixed(2)}</b></p>
    <p style="font-size:10px;color:#94a3b8;">Bs ${totales.totalVES.toFixed(2)} · Tasa ${totales.tasa.toFixed(2)}</p>
  </div>`;

  const conf = await Swal.fire({
    title: '🧾 Confirmar Factura',
    html: confirmHTML, width: 420,
    showCancelButton: true, confirmButtonText: 'Emitir Factura',
    cancelButtonText: 'Cancelar', confirmButtonColor: '#1d4ed8'
  });
  if (!conf.isConfirmed) return;

  const btn = document.getElementById('btnEmitirFactura');
  const txtOrig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Emitiendo...'; }

  try {
    const serieId      = _configFiscal.serieId || 'A';
    const facturaRef   = doc(collection(db, 'facturas'));
    const auditRef     = doc(collection(db, 'auditoria_facturacion'));

    const lineas = _carrito.map(item => ({
      referenciaId:   item.id,
      referenciaTipo: item.tipo,
      descripcion:    item.descripcion,
      cantidad:       item.cantidad,
      precioUnitario: item.precio,
      alicuotaIVA:    item.alicuotaIVA ?? 16,
      // precio ya incluye IVA → retrocálculo
      baseImponible:  (item.alicuotaIVA ?? 16) > 0
        ? parseFloat((item.precio * item.cantidad / (1 + (item.alicuotaIVA ?? 16) / 100)).toFixed(4))
        : item.precio * item.cantidad,
      montoIVA: (item.alicuotaIVA ?? 16) > 0
        ? parseFloat((item.precio * item.cantidad - item.precio * item.cantidad / (1 + (item.alicuotaIVA ?? 16) / 100)).toFixed(4))
        : 0
    }));

    const stockItems = _carrito
      .filter(i => i.tipo === 'producto')
      .map(i => ({ id: i.id, cantidad: i.cantidad, nombre: i.descripcion }));

    // ── PASO 1: Emitir en la Aclas (bridge) o modo manual ──
    let numeroFactura, numeroControl, modoAclas;
    if (btn) btn.textContent = '🔌 Conectando con Aclas...';

    const bridgeActivo = await _bridgeHealth();
    if (bridgeActivo) {
      if (btn) btn.textContent = '🖨️ Imprimiendo en Aclas...';
      const itemsAclas = _carrito.map(i => ({
        descripcion:  i.descripcion,
        precioUSD:    i.precio,
        cantidad:     i.cantidad,
        alicuotaIVA:  i.alicuotaIVA ?? 16
      }));
      const cliente = _esConsumidorFinal ? null : {
        rif:    document.getElementById('inputRIFReceptor')?.value.trim(),
        nombre: document.getElementById('inputNomReceptor')?.value.trim()
      };
      const resp = await _emitirEnAclas(itemsAclas, cliente, _monedaPago, totales.totalUSD, _tasaBCV);
      numeroFactura = resp.numeroFactura;
      numeroControl = resp.numeroControl;
      modoAclas     = true;
    } else {
      // Bridge no disponible — modo manual
      if (btn) btn.disabled = false;
      const manual = await _modoManual();
      if (!manual) {
        if (btn) { btn.disabled = false; btn.textContent = txtOrig; }
        return;
      }
      if (btn) btn.disabled = true;
      numeroFactura = manual.numeroFactura;
      numeroControl = manual.numeroControl;
      modoAclas     = false;
    }

    if (btn) btn.textContent = '💾 Guardando en Firestore...';

    // ── PASO 2: Guardar en Firestore (atómico) ────────────
    await runTransaction(db, async (tx) => {

      // Leer stock actual para cada producto
      const stockReads = await Promise.all(stockItems.map(s => tx.get(doc(db,'inventario',s.id))));

      // Escribir factura
      tx.set(facturaRef, {
        numeroFactura,
        numeroControl:        String(numeroControl),
        modoEmision:          modoAclas ? 'aclas' : 'manual',
        serieId,
        rifEmisor:            _configFiscal.rifEmisor,
        razonSocialEmisor:    _configFiscal.razonSocial   || 'AVIPET',
        direccionFiscalEmisor: _configFiscal.direccionFiscal || '',
        rifReceptor,
        nombreReceptor:       nomReceptor,
        direccionReceptor:    dirReceptor,
        cedulaReceptor:       cedulaReceptor,
        telefonoReceptor:     telefonoReceptor,
        emailReceptor:        emailReceptor,
        esConsumidorFinal:    _esConsumidorFinal,
        propietario:          _clienteActual?.propietario || '',
        cedulaCliente:        _clienteActual?.cedula      || _clienteActual?.cedula || cedulaReceptor,
        lineas,
        totalBaseImponible:   totales.totalBase,
        totalIVA:             totales.totalIVA,
        igtf: totales.igtf > 0
          ? { aplica: true,  monto: totales.igtf, alicuota: _configFiscal.alicuotaIGTF, medioPago: _monedaPago }
          : { aplica: false, monto: 0 },
        moneda:               _monedaPago,
        tasaBCV:              _tasaBCV,
        totalMoneda:          totales.totalUSD,
        totalVES:             totales.totalVES,
        condicionPago:        'contado',
        estado:               'emitida',
        // Alias para Libro de Ventas (cargarLibroVentas los espera con estos nombres)
        nombreCliente:        nomReceptor || _clienteActual?.propietario || 'Consumidor Final',
        rifCliente:           rifReceptor,
        cedulaCliente:        cedulaReceptor,
        telefonoCliente:      telefonoReceptor,
        totalUSD:             totales.totalUSD,
        baseImponible16:      totales.grupos[16]?.base || 0,
        iva16:                totales.grupos[16]?.iva  || 0,
        baseImponible8:       totales.grupos[8]?.base  || 0,
        iva8:                 totales.grupos[8]?.iva   || 0,
        baseImponible0:       totales.grupos[0]?.base  || 0,
        ticketFiscal:         modoAclas ? 'aclas-auto' : 'manual',
        fechaEmision:         serverTimestamp(),
        fechaSimple:          new Date().toLocaleDateString('es-VE'),
        horaEmision:          new Date().toLocaleTimeString('es-VE', { hour:'2-digit', minute:'2-digit' })
      });

      // Descontar stock de productos
      stockItems.forEach((s, i) => {
        if (!stockReads[i].exists()) {
          throw new Error(`El producto "${s.nombre}" ya no existe en inventario. Retíralo del carrito.`);
        }
        const stockActual = parseFloat(stockReads[i].data().cantidadStock || 0);
        const nuevoStock  = Math.max(0, stockActual - s.cantidad);
        tx.update(doc(db,'inventario',s.id), {
          cantidadStock:        nuevoStock,
          ultimaActualizacion:  serverTimestamp()
        });
        const movRef = doc(collection(db,'movimientos_inventario'));
        tx.set(movRef, {
          productoId: s.id, productoNombre: s.nombre,
          tipo: 'SALIDA-FACTURA', cantidad: s.cantidad,
          stockResultante: nuevoStock, facturaId: facturaRef.id,
          fecha: serverTimestamp()
        });
      });

      // Marcar consultas y peluquería como facturadas
      _carrito.filter(i => i.tipo !== 'producto').forEach(i => {
        const col = i.tipo === 'consulta' ? 'consultas' : 'servicios_estetica';
        tx.update(doc(db, col, i.id), { facturado: true, facturaId: facturaRef.id });
      });

      // Auditoría
      tx.set(auditRef, {
        tipo: 'emision', documentoId: facturaRef.id,
        numeroFactura,
        timestamp: serverTimestamp(),
        detalle: `Factura #${numeroFactura} — $${totales.totalUSD.toFixed(2)} · ${rifReceptor}`
      });
    });

    // Guardar referencia local para el modal
    const carritoEmitido = [..._carrito];
    const totalesEmitidos = { ...totales };

    // Limpiar estado
    _carrito       = [];
    _clienteActual = null;
    document.getElementById('serviciosHoyPanel').innerHTML =
      '<p class="text-center text-slate-400 text-[10px] italic py-6">Busca un cliente para ver sus servicios del día.</p>';
    document.getElementById('clientePanel')?.classList.add('hidden');
    const ci = document.getElementById('buscadorCIFact');
    if (ci) ci.value = '';
    _renderCarrito();
    cargarHistorialFacturas();

    // Modal resumen para máquina fiscal
    _mostrarResumenMaquinaFiscal(facturaRef.id, numeroFactura, numeroControl, carritoEmitido, totalesEmitidos);

  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error al emitir', text: e.message });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOrig; }
  }
};

// ─── RESUMEN PARA MÁQUINA FISCAL ───────────────────────
function _mostrarResumenMaquinaFiscal(facturaId, numeroFactura, numeroControl, carrito, totales) {
  let filas = carrito.map(item => {
    const sub = (item.precio * item.cantidad).toFixed(2);
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:4px 8px;font-size:10px;text-align:left;">${item.descripcion}</td>
      <td style="padding:4px 8px;font-size:10px;text-align:center;">${item.cantidad}</td>
      <td style="padding:4px 8px;font-size:10px;text-align:right;">$${item.precio.toFixed(2)}</td>
      <td style="padding:4px 8px;font-size:10px;text-align:center;">${item.alicuotaIVA}%</td>
      <td style="padding:4px 8px;font-size:10px;text-align:right;font-weight:900;">$${sub}</td>
    </tr>`;
  }).join('');

  const html = `<div style="text-align:left;">
    <p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:8px;">
      📋 Ingresa esta información en la máquina fiscal:
    </p>
    <div style="background:#f8fafc;border-radius:10px;padding:8px;margin-bottom:10px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:340px;">
        <thead><tr style="background:#1e293b;color:#fff;">
          <th style="padding:4px 8px;font-size:9px;text-align:left;">Descripción</th>
          <th style="padding:4px 8px;font-size:9px;text-align:center;">Cant</th>
          <th style="padding:4px 8px;font-size:9px;text-align:right;">P/U</th>
          <th style="padding:4px 8px;font-size:9px;text-align:center;">IVA%</th>
          <th style="padding:4px 8px;font-size:9px;text-align:right;">Subtotal</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
      <div style="background:#eff6ff;border-radius:8px;padding:8px;">
        <p style="font-size:9px;color:#64748b;font-weight:700;margin:0 0 2px;">Base Imponible</p>
        <p style="font-size:16px;font-weight:900;color:#1d4ed8;margin:0;">$${totales.totalBase.toFixed(2)}</p>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:8px;">
        <p style="font-size:9px;color:#64748b;font-weight:700;margin:0 0 2px;">IVA Total</p>
        <p style="font-size:16px;font-weight:900;color:#16a34a;margin:0;">$${totales.totalIVA.toFixed(2)}</p>
      </div>
      ${totales.igtf > 0 ? `<div style="background:#fefce8;border-radius:8px;padding:8px;">
        <p style="font-size:9px;color:#64748b;font-weight:700;margin:0 0 2px;">IGTF</p>
        <p style="font-size:16px;font-weight:900;color:#ca8a04;margin:0;">$${totales.igtf.toFixed(2)}</p>
      </div>` : ''}
      <div style="background:#1d4ed8;border-radius:8px;padding:8px;${totales.igtf === 0 ? 'grid-column:span 2;' : ''}">
        <p style="font-size:9px;color:#bfdbfe;font-weight:700;margin:0 0 2px;">TOTAL A COBRAR</p>
        <p style="font-size:20px;font-weight:900;color:#fff;margin:0;">$${totales.totalUSD.toFixed(2)}</p>
        <p style="font-size:8px;color:#bfdbfe;margin:0;">Bs ${totales.totalVES.toFixed(2)}</p>
      </div>
    </div>
    <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;padding:10px;">
      <p style="font-size:10px;font-weight:900;color:#334155;margin:0 0 6px;">Nº del Ticket emitido por la Máquina Fiscal:</p>
      <input id="inputTicketFiscal" type="text" placeholder="Ej: 00001234"
        style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:15px;font-weight:900;text-align:center;outline:none;box-sizing:border-box;color:#1e293b;">
    </div>
  </div>`;

  Swal.fire({
    title: `🖨️ Factura #${numeroFactura} Emitida`,
    html, width: 560,
    showCancelButton: true,
    confirmButtonText:  '✅ Registrar Ticket y Finalizar',
    cancelButtonText:   'Omitir Ticket',
    confirmButtonColor: '#1d4ed8',
    preConfirm: () => ({ ticket: document.getElementById('inputTicketFiscal')?.value.trim() || null })
  }).then(async result => {
    if (result.isConfirmed && result.value?.ticket) {
      try { await updateDoc(doc(db,'facturas',facturaId), { ticketFiscal: result.value.ticket }); } catch(_) {}
    }
    Swal.fire({ icon:'success', title:`✅ Factura #${numeroFactura} registrada`, timer:2200, showConfirmButton:false });
  });
}

// ─── ESCÁNER CÁMARA — modo multi-scan (html5-qrcode) ──
// La cámara queda abierta: cada código agrega el producto al carrito.
// Se filtra el mismo código por 2 s para no duplicar el mismo scan.
let _html5Qr = null;
let _lastScanned = '';
let _lastScannedTs = 0;
let _scanCount = 0;

window.abrirEscaner = async function() {
  const modal = document.getElementById('modalEscaner');
  const estadoEl = document.getElementById('escanerEstado');
  if (!modal) return;
  _scanCount = 0;
  modal.classList.remove('hidden');
  estadoEl.textContent = 'Iniciando cámara...';

  try {
    _html5Qr = new Html5Qrcode('qr-reader');
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || !cameras.length) throw new Error('No se encontró cámara en este dispositivo.');

    const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];

    await _html5Qr.start(
      cam.id,
      { fps: 10, qrbox: { width: 250, height: 180 }, aspectRatio: 1.4 },
      (decodedText) => {
        const now = Date.now();
        // Ignorar si es el mismo código dentro de 2 segundos
        if (decodedText === _lastScanned && now - _lastScannedTs < 2000) return;
        _lastScanned = decodedText;
        _lastScannedTs = now;
        _scanCount++;

        document.getElementById('inputBarcode').value = decodedText;
        window.agregarProductoAlCarrito(decodedText);
        estadoEl.textContent = `✅ ${_scanCount} producto${_scanCount > 1 ? 's' : ''} agregado${_scanCount > 1 ? 's' : ''}. Apunta al siguiente o cierra.`;
      },
      () => {}
    );
    estadoEl.textContent = 'Apunta la cámara al código de barras del producto. La cámara queda abierta para escanear varios.';
  } catch(e) {
    estadoEl.textContent = '⚠️ ' + (e.message || 'No se pudo acceder a la cámara. Verifica los permisos.');
  }
};

window.cerrarEscaner = async function() {
  const modal = document.getElementById('modalEscaner');
  if (modal) modal.classList.add('hidden');
  if (_html5Qr) {
    try { await _html5Qr.stop(); } catch(_) {}
    try { _html5Qr.clear(); } catch(_) {}
    _html5Qr = null;
  }
};

// ─── LECTOR CÓDIGO DE BARRAS ───────────────────────────
function _initBarcodeReader() {
  const input = document.getElementById('inputBarcode');
  if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codigo = input.value.trim();
      if (codigo) window.agregarProductoAlCarrito(codigo);
    }
  });
  // Auto-focus cuando se hace click en la sección
  document.getElementById('seccionBarcode')?.addEventListener('click', () => input.focus());
}

// ─── HISTORIAL DE FACTURAS ─────────────────────────────
window.cargarHistorialFacturas = async () => {
  const cont = document.getElementById('historialFacturasLista');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center text-blue-500 text-xs italic animate-pulse py-6">Cargando...</p>';

  try {
    const snap = await getDocs(query(collection(db,'facturas'), orderBy('fechaEmision','desc'), limit(50)));
    if (snap.empty) {
      cont.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-6">Sin facturas emitidas aún.</p>';
      return;
    }
    cont.innerHTML = '';
    snap.forEach(d => {
      const f   = { id: d.id, ...d.data() };
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 mb-2 hover:border-blue-300 cursor-pointer transition-all';
      const estadoClass = f.estado === 'emitida' ? 'text-emerald-600' : 'text-red-500';
      div.innerHTML = `
        <div>
          <p class="text-[11px] font-black text-slate-800">#${f.numeroFactura}
            <span class="text-slate-400 font-normal text-[9px]">· Ctrl: ${f.numeroControl}</span>
          </p>
          <p class="text-[9px] text-slate-400">${f.fechaSimple || ''} ${f.horaEmision ? '· '+f.horaEmision : ''}</p>
          <p class="text-[9px] text-slate-500">${f.esConsumidorFinal ? 'Consumidor Final' : f.rifReceptor}
            ${f.propietario ? '· '+f.propietario : ''}</p>
          ${f.ticketFiscal ? `<p class="text-[8px] text-blue-500 font-bold">🖨️ Ticket: ${f.ticketFiscal}</p>` : ''}
        </div>
        <div class="text-right shrink-0">
          <p class="text-[14px] font-black text-blue-700">$${parseFloat(f.totalMoneda||0).toFixed(2)}</p>
          <p class="text-[8px] font-black uppercase ${estadoClass}">${f.estado}</p>
        </div>`;
      div.onclick = () => window.verDetalleFactura(f);
      cont.appendChild(div);
    });
  } catch(e) {
    console.error(e);
    cont.innerHTML = `<p class="text-center text-red-500 text-xs italic py-4">Error: ${e.message}</p>`;
  }
};

window.verDetalleFactura = (f) => {
  const filas = (f.lineas || []).map(l =>
    `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:3px 8px;font-size:10px;">${l.descripcion}</td>
      <td style="text-align:center;font-size:10px;padding:3px 8px;">${l.cantidad}</td>
      <td style="text-align:right;font-size:10px;padding:3px 8px;">$${parseFloat(l.precioUnitario||0).toFixed(2)}</td>
      <td style="text-align:center;font-size:10px;padding:3px 8px;">${l.alicuotaIVA}%</td>
      <td style="text-align:right;font-weight:900;font-size:10px;padding:3px 8px;">$${parseFloat(l.baseImponible||0).toFixed(2)}</td>
    </tr>`).join('');

  Swal.fire({
    title: `Factura #${f.numeroFactura}`,
    html: `<div style="text-align:left;font-size:11px;color:#334155;line-height:1.8;">
      <p><b>Nº Control:</b> ${f.numeroControl} &nbsp;|&nbsp; <b>Serie:</b> ${f.serieId}</p>
      <p><b>Fecha:</b> ${f.fechaSimple} ${f.horaEmision || ''}</p>
      <p><b>Receptor:</b> ${f.esConsumidorFinal ? 'Consumidor Final' : f.rifReceptor}</p>
      <p><b>Ticket Fiscal:</b> ${f.ticketFiscal || '<span style="color:#ef4444;">Sin registrar</span>'}</p>
      <hr style="margin:8px 0;border-color:#e2e8f0;">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:300px;">
          <thead><tr style="background:#1e293b;color:#fff;">
            <th style="padding:3px 8px;font-size:9px;text-align:left;">Descripción</th>
            <th style="font-size:9px;padding:3px 8px;">Cant</th>
            <th style="font-size:9px;padding:3px 8px;">P/U</th>
            <th style="font-size:9px;padding:3px 8px;">IVA</th>
            <th style="font-size:9px;padding:3px 8px;">Subtotal</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <hr style="margin:8px 0;border-color:#e2e8f0;">
      <div style="text-align:right;">
        <p>Base imponible: <b>$${parseFloat(f.totalBaseImponible||0).toFixed(2)}</b></p>
        <p>IVA: <b style="color:#16a34a;">$${parseFloat(f.totalIVA||0).toFixed(2)}</b></p>
        ${f.igtf?.aplica ? `<p>IGTF (${f.igtf.alicuota}%): <b>$${parseFloat(f.igtf.monto||0).toFixed(2)}</b></p>` : ''}
        <p style="font-size:16px;font-weight:900;color:#1d4ed8;">TOTAL: $${parseFloat(f.totalMoneda||0).toFixed(2)}</p>
        <p style="font-size:10px;color:#94a3b8;">Bs ${parseFloat(f.totalVES||0).toFixed(2)} · Tasa ${parseFloat(f.tasaBCV||0).toFixed(2)}</p>
      </div>
    </div>`,
    width: 520,
    confirmButtonText: 'Cerrar', confirmButtonColor: '#1d4ed8'
  });
};

// ─── CONFIGURACIÓN FISCAL ──────────────────────────────
window.abrirConfigFiscal = () => {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('configRIF',          _configFiscal.rifEmisor);
  set('configRazonSocial',  _configFiscal.razonSocial);
  set('configDireccion',    _configFiscal.direccionFiscal);
  set('configSerie',        _configFiscal.serieId || 'A');
  set('configIGTF',         _configFiscal.alicuotaIGTF ?? 3);
  const chk = document.getElementById('configContribEspecial');
  if (chk) chk.checked = _configFiscal.esContribuyenteEspecial !== false;
  document.getElementById('panelConfigFiscal')?.classList.remove('hidden');
};

window.cerrarConfigFiscal = () => {
  document.getElementById('panelConfigFiscal')?.classList.add('hidden');
};

window.guardarConfigFiscal = async () => {
  const val = id => document.getElementById(id)?.value.trim() || '';
  const config = {
    rifEmisor:              val('configRIF'),
    razonSocial:            val('configRazonSocial'),
    direccionFiscal:        val('configDireccion'),
    serieId:                val('configSerie') || 'A',
    alicuotaIGTF:           parseFloat(val('configIGTF')) || 3,
    esContribuyenteEspecial: document.getElementById('configContribEspecial')?.checked !== false
  };
  if (!config.rifEmisor) { alert('El RIF del emisor es obligatorio.'); return; }
  try {
    await setDoc(doc(db,'configuracion','fiscal'), config, { merge: true });
    _configFiscal = config;
    document.getElementById('rifEmisorDisplay').textContent = config.rifEmisor;
    document.getElementById('alertaConfigFiscal')?.classList.add('hidden');
    document.getElementById('panelConfigFiscal')?.classList.add('hidden');
    Swal.fire({ icon:'success', title:'Configuración guardada ✓', timer:1500, showConfirmButton:false });
  } catch(e) { alert('Error: ' + e.message); }
};

console.log('✅ facturacion.js v1 — módulo de facturación fiscal AVIPET');

// =========================================================
// MÓDULOS FISCALES: Libros, Notas C/D, Retenciones
// =========================================================

// ─── TAB SWITCHING ────────────────────────────────────────
window.showFacTab = function(tab) {
  const tabs = ['facturar','libro-ventas','libro-compras','notas','retenciones'];
  tabs.forEach(t => {
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('ftab-' + t);
    if (!sec || !btn) return;
    if (t === tab) {
      sec.classList.remove('hidden');
      btn.className = 'shrink-0 px-3 py-2 rounded-lg font-black text-[9px] uppercase transition-all bg-blue-600 text-white shadow';
    } else {
      sec.classList.add('hidden');
      btn.className = 'shrink-0 px-3 py-2 rounded-lg font-black text-[9px] uppercase transition-all text-slate-500 hover:bg-slate-100';
    }
  });
  if (tab === 'libro-ventas')  _initSelectoresLibro('lv');
  if (tab === 'libro-compras') _initSelectoresLibro('lc');
  if (tab === 'retenciones')   _initSelectoresRet();
};

// ─── HELPERS COMUNES ──────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function _initSelectoresLibro(prefix) {
  const mesEl  = document.getElementById(prefix + 'Mes');
  const anioEl = document.getElementById(prefix + 'Anio');
  if (!mesEl || mesEl.options.length) return;
  MESES.forEach((m, i) => { const o = document.createElement('option'); o.value = i+1; o.textContent = m; mesEl.appendChild(o); });
  const now = new Date();
  mesEl.value = now.getMonth() + 1;
  for (let a = now.getFullYear(); a >= 2024; a--) {
    const o = document.createElement('option'); o.value = a; o.textContent = a; anioEl.appendChild(o);
  }
}

function _initSelectoresRet() {
  _initSelectoresLibro('ret');
  const fechaEl = document.getElementById('retFecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().slice(0,10);
}

function _parseFechaSimple(fs) {
  if (!fs) return null;
  const p = String(fs).split('/');
  if (p.length !== 3) return null;
  return { dia: parseInt(p[0]), mes: parseInt(p[1]), anio: parseInt(p[2]) };
}

function _fmtMoney(n) { return '$' + parseFloat(n||0).toFixed(2); }

function _cardHTML(titulo, valor, color) {
  return `<div class="bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center">
    <div class="text-[8px] font-bold text-${color}-500 uppercase mb-1">${titulo}</div>
    <div class="text-[13px] font-black text-${color}-700">${valor}</div>
  </div>`;
}

// ─── LIBRO DE VENTAS ──────────────────────────────────────
window.cargarLibroVentas = async function() {
  const mes  = parseInt(document.getElementById('lvMes')?.value);
  const anio = parseInt(document.getElementById('lvAnio')?.value);
  if (!mes || !anio) return;

  const tablaEl   = document.getElementById('lvTabla');
  const resumenEl = document.getElementById('lvResumen');
  tablaEl.innerHTML = '<p class="text-center text-slate-400 py-6 italic">Cargando...</p>';

  try {
    const snap = await getDocs(collection(db, 'facturas'));
    let filas = [];
    snap.forEach(d => {
      const f = d.data();
      const fecha = _parseFechaSimple(f.fechaSimple);
      if (!fecha || fecha.mes !== mes || fecha.anio !== anio) return;
      if (f.estado === 'anulada') return;
      filas.push(f);
    });
    filas.sort((a,b) => (a.numeroFactura||0) - (b.numeroFactura||0));

    // Normalizar facturas viejas que usan campos distintos
    filas = filas.map(f => ({
      ...f,
      nombreCliente: f.nombreCliente || f.nombreReceptor || 'Consumidor Final',
      rifCliente:    f.rifCliente    || f.rifReceptor    || '',
      totalUSD:      f.totalUSD      ?? f.totalMoneda    ?? 0,
    }));

    let totBase16=0, totIVA16=0, totBase8=0, totIVA8=0, totBase0=0, totExento=0, totTotal=0;
    filas.forEach(f => {
      totBase16  += f.baseImponible16 || 0;
      totIVA16   += f.iva16 || 0;
      totBase8   += f.baseImponible8  || 0;
      totIVA8    += f.iva8  || 0;
      totBase0   += f.baseImponible0  || 0;
      totExento  += f.exento || 0;
      totTotal   += f.totalUSD || 0;
    });

    resumenEl.innerHTML =
      _cardHTML('Facturas', filas.length, 'blue') +
      _cardHTML('Total Ventas', _fmtMoney(totTotal), 'emerald') +
      _cardHTML('IVA 16%', _fmtMoney(totIVA16), 'amber') +
      _cardHTML('IVA 8%', _fmtMoney(totIVA8), 'orange');

    if (!filas.length) {
      tablaEl.innerHTML = '<p class="text-center text-slate-400 py-6 italic">Sin facturas en este período.</p>';
      return;
    }

    let rows = '';
    filas.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-2 py-1">${f.fechaSimple||''}</td>
        <td class="border px-2 py-1">${f.numeroFactura||''}</td>
        <td class="border px-2 py-1">${f.numeroControl||''}</td>
        <td class="border px-2 py-1 max-w-[100px] truncate"></td>
        <td class="border px-2 py-1">${f.rifCliente||'V/F'}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.baseImponible16)}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.iva16)}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.baseImponible8)}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.iva8)}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.baseImponible0)}</td>
        <td class="border px-2 py-1 text-right font-bold">${_fmtMoney(f.totalUSD)}</td>
      `;
      tr.querySelector('td:nth-child(4)').textContent = f.nombreCliente || 'Consumidor Final';
      rows += tr.outerHTML;
    });

    // totales row
    const totRow = `<tr class="font-bold bg-slate-50">
      <td class="border px-2 py-1" colspan="5">TOTALES</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totBase16)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totIVA16)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totBase8)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totIVA8)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totBase0)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totTotal)}</td>
    </tr>`;

    tablaEl.innerHTML = `
      <table id="tablaLV" class="w-full border-collapse border border-slate-200 text-[9px]">
        <thead class="bg-slate-100 font-bold">
          <tr>
            <th class="border px-2 py-1">Fecha</th>
            <th class="border px-2 py-1">N° Fact.</th>
            <th class="border px-2 py-1">N° Control</th>
            <th class="border px-2 py-1">Cliente</th>
            <th class="border px-2 py-1">RIF</th>
            <th class="border px-2 py-1">Base 16%</th>
            <th class="border px-2 py-1">IVA 16%</th>
            <th class="border px-2 py-1">Base 8%</th>
            <th class="border px-2 py-1">IVA 8%</th>
            <th class="border px-2 py-1">Base 0%</th>
            <th class="border px-2 py-1">Total $</th>
          </tr>
        </thead>
        <tbody>${rows}${totRow}</tbody>
      </table>`;
  } catch(e) { tablaEl.innerHTML = `<p class="text-red-600 text-xs p-4">${e.message}</p>`; }
};

// ─── LIBRO DE COMPRAS ─────────────────────────────────────
window.cargarLibroCompras = async function() {
  const mes  = parseInt(document.getElementById('lcMes')?.value);
  const anio = parseInt(document.getElementById('lcAnio')?.value);
  if (!mes || !anio) return;

  const tablaEl   = document.getElementById('lcTabla');
  const resumenEl = document.getElementById('lcResumen');
  tablaEl.innerHTML = '<p class="text-center text-slate-400 py-6 italic">Cargando...</p>';

  try {
    const [snapF, snapI] = await Promise.all([
      getDocs(collection(db,'compras_fiscales')),
      getDocs(collection(db,'compras_insumos'))
    ]);
    const filas = [];
    snapF.forEach(d => {
      const f = d.data();
      const fecha = _parseFechaSimple(f.fechaSimple);
      if (!fecha || fecha.mes !== mes || fecha.anio !== anio) return;
      filas.push({ ...f, _fuente:'fiscal' });
    });
    snapI.forEach(d => {
      const f = d.data();
      const fecha = _parseFechaSimple(f.fechaSimple || (f.fecha?.toDate ? f.fecha.toDate().toLocaleDateString('es-VE') : null));
      if (!fecha || fecha.mes !== mes || fecha.anio !== anio) return;
      if (!f.rifProveedor && !f.nroFactura) return; // skip if no fiscal data
      filas.push({ ...f, _fuente:'insumos' });
    });
    filas.sort((a,b) => (a.fechaSimple||'').localeCompare(b.fechaSimple||''));

    let totBase=0, totIVA=0, totTotal=0;
    filas.forEach(f => { totBase += f.baseImponible||0; totIVA += f.ivaCompra||0; totTotal += f.totalCompra||0; });

    resumenEl.innerHTML =
      _cardHTML('Compras', filas.length, 'blue') +
      _cardHTML('Total Compras', _fmtMoney(totTotal), 'emerald') +
      _cardHTML('IVA Crédito', _fmtMoney(totIVA), 'amber') +
      _cardHTML('Base Imponible', _fmtMoney(totBase), 'slate');

    if (!filas.length) {
      tablaEl.innerHTML = '<p class="text-center text-slate-400 py-6 italic">Sin compras fiscales en este período.</p>';
      return;
    }

    let rows = '';
    filas.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-2 py-1">${f.fechaSimple||''}</td>
        <td class="border px-2 py-1">${f.nroFactura||''}</td>
        <td class="border px-2 py-1"></td>
        <td class="border px-2 py-1">${f.rifProveedor||''}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.baseImponible)}</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.alicuotaIVA||16)}%</td>
        <td class="border px-2 py-1 text-right">${_fmtMoney(f.ivaCompra)}</td>
        <td class="border px-2 py-1 text-right font-bold">${_fmtMoney(f.totalCompra)}</td>
        <td class="border px-2 py-1 text-center"><span class="text-[7px] px-1 py-0.5 rounded ${f._fuente==='fiscal'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-500'}">${f._fuente}</span></td>
      `;
      tr.querySelector('td:nth-child(3)').textContent = f.nombreProveedor || '';
      rows += tr.outerHTML;
    });

    const totRow = `<tr class="font-bold bg-slate-50">
      <td class="border px-2 py-1" colspan="4">TOTALES</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totBase)}</td>
      <td class="border px-2 py-1"></td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totIVA)}</td>
      <td class="border px-2 py-1 text-right">${_fmtMoney(totTotal)}</td>
      <td></td>
    </tr>`;

    tablaEl.innerHTML = `
      <table id="tablaLC" class="w-full border-collapse border border-slate-200 text-[9px]">
        <thead class="bg-slate-100 font-bold">
          <tr>
            <th class="border px-2 py-1">Fecha</th>
            <th class="border px-2 py-1">N° Fact.</th>
            <th class="border px-2 py-1">Proveedor</th>
            <th class="border px-2 py-1">RIF</th>
            <th class="border px-2 py-1">Base Imp.</th>
            <th class="border px-2 py-1">Alic.</th>
            <th class="border px-2 py-1">IVA</th>
            <th class="border px-2 py-1">Total $</th>
            <th class="border px-2 py-1">Fuente</th>
          </tr>
        </thead>
        <tbody>${rows}${totRow}</tbody>
      </table>`;
  } catch(e) { tablaEl.innerHTML = `<p class="text-red-600 text-xs p-4">${e.message}</p>`; }
};

window.abrirRegistroCompraFiscal = async function() {
  const { value: datos } = await Swal.fire({
    title: 'Registrar Compra Fiscal',
    html: `
      <div class="space-y-2 text-left text-sm">
        <div><label class="text-xs font-bold text-slate-500">Fecha</label>
          <input id="cfFecha" type="date" class="w-full border rounded px-2 py-1 text-sm mt-1" value="${new Date().toISOString().slice(0,10)}"></div>
        <div><label class="text-xs font-bold text-slate-500">N° Factura Proveedor</label>
          <input id="cfNro" type="text" class="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="Ej: 0001"></div>
        <div><label class="text-xs font-bold text-slate-500">Nombre Proveedor</label>
          <input id="cfNom" type="text" class="w-full border rounded px-2 py-1 text-sm mt-1"></div>
        <div><label class="text-xs font-bold text-slate-500">RIF Proveedor</label>
          <input id="cfRIF" type="text" class="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="J-XXXXXXXXX-X"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="text-xs font-bold text-slate-500">Base Imponible ($)</label>
            <input id="cfBase" type="number" step="0.01" class="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="0.00"></div>
          <div><label class="text-xs font-bold text-slate-500">Alícuota IVA %</label>
            <select id="cfAlic" class="w-full border rounded px-2 py-1 text-sm mt-1">
              <option value="16">16%</option><option value="8">8%</option><option value="0">0%</option>
            </select></div>
        </div>
        <div><label class="text-xs font-bold text-slate-500">Descripción / Concepto</label>
          <input id="cfDesc" type="text" class="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="Ej: Insumos veterinarios"></div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    preConfirm: () => {
      const base = parseFloat(document.getElementById('cfBase')?.value)||0;
      const alic = parseFloat(document.getElementById('cfAlic')?.value)||16;
      const iva  = parseFloat((base * alic / 100).toFixed(2));
      const d = document.getElementById('cfFecha')?.value;
      if (!d) { Swal.showValidationMessage('Fecha requerida'); return false; }
      const dObj = new Date(d + 'T12:00:00');
      return {
        fechaSimple:    dObj.toLocaleDateString('es-VE'),
        nroFactura:     document.getElementById('cfNro')?.value.trim()||'',
        nombreProveedor:document.getElementById('cfNom')?.value.trim()||'',
        rifProveedor:   document.getElementById('cfRIF')?.value.trim()||'',
        baseImponible:  base,
        alicuotaIVA:    alic,
        ivaCompra:      iva,
        totalCompra:    parseFloat((base + iva).toFixed(2)),
        descripcion:    document.getElementById('cfDesc')?.value.trim()||'',
        ts:             serverTimestamp()
      };
    }
  });
  if (!datos) return;
  try {
    await addDoc(collection(db,'compras_fiscales'), datos);
    Swal.fire({ icon:'success', title:'Compra registrada ✓', timer:1500, showConfirmButton:false });
  } catch(e) { alert('Error: ' + e.message); }
};

// ─── NOTAS C/D ────────────────────────────────────────────
let _tipoNota = 'NC';
let _facturaNotaRef = null;

window.selTipoNota = function(tipo) {
  _tipoNota = tipo;
  ['NC','ND'].forEach(t => {
    const btn = document.getElementById('btnSel' + t);
    if (!btn) return;
    btn.className = 'flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ' +
      (t === tipo ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200');
  });
};

window.buscarFacturaNota = async function() {
  const num = parseInt(document.getElementById('notaFacturaNum')?.value);
  const infoEl = document.getElementById('notaFacturaInfo');
  if (!num) { infoEl.classList.add('hidden'); return; }
  try {
    const q = query(collection(db,'facturas'), where('numeroFactura','==',num), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { infoEl.classList.remove('hidden'); infoEl.textContent = 'Factura no encontrada.'; _facturaNotaRef = null; return; }
    const f = snap.docs[0].data();
    _facturaNotaRef = { id: snap.docs[0].id, data: f };
    infoEl.classList.remove('hidden');
    infoEl.innerHTML = '';
    infoEl.textContent = `Fact. #${f.numeroFactura} | ${f.fechaSimple} | Cliente: ${f.nombreCliente||'Cons. Final'} | Total: ${_fmtMoney(f.totalUSD)}`;
  } catch(e) { infoEl.textContent = 'Error: ' + e.message; infoEl.classList.remove('hidden'); }
};

window.emitirNota = async function() {
  if (!_facturaNotaRef) { alert('Busca la factura original primero.'); return; }
  const monto  = parseFloat(document.getElementById('notaMonto')?.value)||0;
  const motivo = document.getElementById('notaMotivo')?.value.trim()||'';
  if (monto <= 0 || !motivo) { alert('Monto y motivo son requeridos.'); return; }

  const colName  = _tipoNota === 'NC' ? 'notas_credito' : 'notas_debito';
  const corrName = _tipoNota === 'NC' ? 'NC' : 'ND';
  const f = _facturaNotaRef.data;

  try {
    let numero;
    await runTransaction(db, async tx => {
      const corrRef  = doc(db,'correlativos', corrName);
      const corrSnap = await tx.get(corrRef);
      numero = (corrSnap.exists() ? (corrSnap.data().ultimo||0) : 0) + 1;
      const nota = {
        numero,
        tipo:          _tipoNota,
        fechaSimple:   new Date().toLocaleDateString('es-VE'),
        facturaRef:    _facturaNotaRef.id,
        numeroFactura: f.numeroFactura,
        nombreCliente: f.nombreCliente||'Consumidor Final',
        rifCliente:    f.rifCliente||'',
        monto,
        motivo,
        ts:            serverTimestamp()
      };
      tx.set(doc(collection(db, colName)), nota);
      tx.set(corrRef, { ultimo: numero }, { merge: true });
    });
    Swal.fire({ icon:'success', title:`${_tipoNota} #${numero} emitida ✓`, timer:1800, showConfirmButton:false });
    document.getElementById('notaFacturaNum').value = '';
    document.getElementById('notaMonto').value = '';
    document.getElementById('notaMotivo').value = '';
    document.getElementById('notaFacturaInfo').classList.add('hidden');
    _facturaNotaRef = null;
    window.cargarNotasHistorial();
  } catch(e) { alert('Error: ' + e.message); }
};

window.cargarNotasHistorial = async function() {
  const el = document.getElementById('notasHistorial');
  if (!el) return;
  el.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">Cargando...</p>';
  try {
    const [snapNC, snapND] = await Promise.all([
      getDocs(query(collection(db,'notas_credito'), orderBy('ts','desc'), limit(25))),
      getDocs(query(collection(db,'notas_debito'),  orderBy('ts','desc'), limit(25)))
    ]);
    const notas = [];
    snapNC.forEach(d => notas.push({...d.data(), _tipo:'NC'}));
    snapND.forEach(d => notas.push({...d.data(), _tipo:'ND'}));
    notas.sort((a,b) => (b.ts?.seconds||0) - (a.ts?.seconds||0));
    if (!notas.length) { el.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">Sin notas emitidas.</p>'; return; }
    el.innerHTML = '';
    notas.forEach(n => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between border-b border-slate-100 py-2 text-[10px]';
      const badge = n._tipo === 'NC'
        ? '<span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold text-[8px]">NC</span>'
        : '<span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold text-[8px]">ND</span>';
      div.innerHTML = `${badge} <span class="flex-1 ml-2"></span> <span class="text-slate-400">${n.fechaSimple||''}</span> <span class="font-bold ml-2">${_fmtMoney(n.monto)}</span>`;
      div.querySelector('span.flex-1').textContent = `#${n.numero} — ${n.motivo||''}`;
      el.appendChild(div);
    });
  } catch(e) { el.innerHTML = `<p class="text-red-600 text-xs p-2">${e.message}</p>`; }
};

// init historial al cargar tab notas
document.getElementById('ftab-notas')?.addEventListener('click', () => window.cargarNotasHistorial());

// ─── RETENCIONES ──────────────────────────────────────────
window.calcularRetencion = function() {
  const iva    = parseFloat(document.getElementById('retIVATotal')?.value)||0;
  const pct    = parseFloat(document.getElementById('retPorcent')?.value)||75;
  const monto  = parseFloat((iva * pct / 100).toFixed(2));
  const el     = document.getElementById('retMontoCalc');
  if (el) el.textContent = _fmtMoney(monto);
};

window.guardarRetencion = async function() {
  const fecha    = document.getElementById('retFecha')?.value;
  const rifCli   = document.getElementById('retClienteRIF')?.value.trim();
  const nomCli   = document.getElementById('retClienteNom')?.value.trim();
  const factNum  = document.getElementById('retFacturaNum')?.value.trim();
  const ivaTotal = parseFloat(document.getElementById('retIVATotal')?.value)||0;
  const pct      = parseFloat(document.getElementById('retPorcent')?.value)||75;
  const comprobante = document.getElementById('retNroComprobante')?.value.trim();

  if (!fecha || !rifCli || ivaTotal <= 0) { alert('Fecha, RIF del cliente e IVA son requeridos.'); return; }
  const monto = parseFloat((ivaTotal * pct / 100).toFixed(2));
  const dObj  = new Date(fecha + 'T12:00:00');

  try {
    await addDoc(collection(db,'retenciones'), {
      fechaSimple:     dObj.toLocaleDateString('es-VE'),
      rifCliente:      rifCli,
      nombreCliente:   nomCli||'',
      nroFactura:      factNum||'',
      ivaTotalFactura: ivaTotal,
      porcentaje:      pct,
      montoRetenido:   monto,
      nroComprobante:  comprobante||'',
      ts:              serverTimestamp()
    });
    Swal.fire({ icon:'success', title:'Retención registrada ✓', timer:1500, showConfirmButton:false });
    ['retClienteRIF','retClienteNom','retFacturaNum','retIVATotal','retNroComprobante'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('retMontoCalc').textContent = '$0.00';
    window.cargarRetenciones();
  } catch(e) { alert('Error: ' + e.message); }
};

window.cargarRetenciones = async function() {
  const mes  = parseInt(document.getElementById('retMes')?.value);
  const anio = parseInt(document.getElementById('retAnio')?.value);
  const listaEl   = document.getElementById('retencionesLista');
  const resumenEl = document.getElementById('retencionesResumen');
  if (!mes || !anio || !listaEl) return;

  listaEl.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db,'retenciones'));
    const filas = [];
    snap.forEach(d => {
      const f = d.data();
      const fecha = _parseFechaSimple(f.fechaSimple);
      if (!fecha || fecha.mes !== mes || fecha.anio !== anio) return;
      filas.push(f);
    });
    filas.sort((a,b) => (a.fechaSimple||'').localeCompare(b.fechaSimple||''));

    const totalRet = filas.reduce((s,f) => s + (f.montoRetenido||0), 0);
    resumenEl.innerHTML = `<div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-center">
      <div class="text-[8px] font-bold text-blue-500 uppercase">Total Retenido ${MESES[mes-1]} ${anio}</div>
      <div class="text-[16px] font-black text-blue-700">${_fmtMoney(totalRet)}</div>
      <div class="text-[9px] text-blue-400 mt-1">${filas.length} retenciones registradas</div>
    </div>`;

    if (!filas.length) { listaEl.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">Sin retenciones en este período.</p>'; return; }

    listaEl.innerHTML = '';
    filas.forEach(f => {
      const div = document.createElement('div');
      div.className = 'border border-slate-100 rounded-xl p-3 mb-2 text-[10px]';
      div.innerHTML = `<div class="flex justify-between mb-1"><span class="font-bold"></span><span class="text-slate-400">${f.fechaSimple||''}</span></div>
        <div class="text-slate-500">RIF: ${f.rifCliente||''} | Fact. #${f.nroFactura||''} | Comprobante: ${f.nroComprobante||'—'}</div>
        <div class="flex justify-between mt-1"><span class="text-slate-400">IVA Factura: ${_fmtMoney(f.ivaTotalFactura)} × ${f.porcentaje||75}%</span><span class="font-black text-blue-700">${_fmtMoney(f.montoRetenido)}</span></div>`;
      div.querySelector('span.font-bold').textContent = f.nombreCliente || f.rifCliente;
      listaEl.appendChild(div);
    });
  } catch(e) { listaEl.innerHTML = `<p class="text-red-600 text-xs p-2">${e.message}</p>`; }
};

// ─── ESCÁNER REMOTO POR QR ───────────────────────────────
// Genera una sesión en Firestore, muestra un QR con la URL de scanner.html.
// El teléfono abre esa URL, escanea productos, y el PC los agrega al carrito
// en tiempo real usando onSnapshot.
let _unsubEscaneoRemoto = null;
let _codigosYaAgregados = new Set();

window.abrirEscanerRemoto = async function() {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sesRef    = doc(db, 'scanner_sessions', sessionId);
  const url       = `${location.origin}/scanner.html?s=${sessionId}`;

  try {
    await setDoc(sesRef, { activa: true, scans: [], ts: serverTimestamp() });
  } catch(e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo crear la sesión: ' + e.message });
    return;
  }

  _codigosYaAgregados.clear();

  // Escuchar scans en tiempo real
  _unsubEscaneoRemoto = onSnapshot(sesRef, async (snap) => {
    if (!snap.exists()) return;
    const scans = snap.data().scans || [];
    for (const s of scans) {
      const key = s.codigo + '_' + s.n;
      if (_codigosYaAgregados.has(key)) continue;
      _codigosYaAgregados.add(key);
      await window.agregarProductoAlCarrito(s.codigo);
      const el = document.getElementById('qrRemotoEstado');
      if (el) el.textContent = `✅ ${_codigosYaAgregados.size} producto(s) agregado(s) al carrito`;
    }
  });

  // Mostrar QR con SweetAlert2
  Swal.fire({
    title: '📱 Escanear con Teléfono',
    html: `<p style="font-size:11px;color:#64748b;margin-bottom:10px;">
             Escanea este QR con la cámara del teléfono para abrir el escáner móvil.
             Los productos se agregan al carrito automáticamente.
           </p>
           <div id="qrCanvasDiv" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
           <p id="qrRemotoEstado" style="font-size:12px;color:#475569;font-style:italic;">
             Esperando escaneos desde el teléfono...
           </p>`,
    confirmButtonText: '✅ Listo, cerrar',
    confirmButtonColor: '#1d4ed8',
    allowOutsideClick: false,
    showCancelButton: false,
    didOpen: () => {
      // Generar QR con la librería qrcode.js (cargada en el HTML)
      if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCanvasDiv'), {
          text: url, width: 200, height: 200,
          colorDark: '#1e293b', colorLight: '#ffffff'
        });
      } else {
        // Fallback: mostrar la URL como texto copiable
        const p = document.createElement('p');
        p.style = 'font-size:9px;color:#64748b;word-break:break-all;padding:8px;background:#f1f5f9;border-radius:8px;';
        p.textContent = url;
        document.getElementById('qrCanvasDiv').appendChild(p);
      }
    }
  }).then(async () => {
    if (_unsubEscaneoRemoto) { _unsubEscaneoRemoto(); _unsubEscaneoRemoto = null; }
    try { await updateDoc(sesRef, { activa: false }); } catch(_) {}
  });
};

// ─── IMPRIMIR LIBRO ───────────────────────────────────────
window.imprimirLibro = function(tipo) {
  const tablaId = tipo === 'ventas' ? 'tablaLV' : 'tablaLC';
  const tabla = document.getElementById(tablaId);
  if (!tabla) { alert('Carga el libro primero.'); return; }
  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>Libro de ${tipo === 'ventas' ? 'Ventas' : 'Compras'} — AVIPET</title>
    <style>body{font-family:Arial,sans-serif;font-size:9px;margin:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px}
    th{background:#eee;font-weight:bold}tr:nth-child(even){background:#f9f9f9}
    @media print{body{margin:5mm}}</style></head><body>
    <h2 style="font-size:12px;margin-bottom:8px">LIBRO DE ${tipo === 'ventas' ? 'VENTAS' : 'COMPRAS'} — AVIPET</h2>
    ${tabla.outerHTML}
    <script>window.print();</script></body></html>`);
  w.document.close();
};
