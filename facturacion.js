// =========================================================
// AVIPET — facturacion.js v1
// Módulo de facturación fiscal SENIAT (Opción A — Máquina Fiscal)
// Página independiente: facturacion.html
// =========================================================
import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, runTransaction
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
function _calcularTotales() {
  const grupos = {};
  _carrito.forEach(item => {
    const base = item.precio * item.cantidad;
    const aliq = item.alicuotaIVA ?? 16;
    if (!grupos[aliq]) grupos[aliq] = { base: 0, iva: 0 };
    grupos[aliq].base += base;
    grupos[aliq].iva  += base * (aliq / 100);
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
    const correlatRef  = doc(db, 'correlativos', serieId);
    const facturaRef   = doc(collection(db, 'facturas'));
    const auditRef     = doc(collection(db, 'auditoria_facturacion'));

    const lineas = _carrito.map(item => ({
      referenciaId:  item.id,
      referenciaTipo: item.tipo,
      descripcion:   item.descripcion,
      cantidad:      item.cantidad,
      precioUnitario: item.precio,
      alicuotaIVA:   item.alicuotaIVA ?? 16,
      baseImponible: item.precio * item.cantidad,
      montoIVA:      (item.precio * item.cantidad) * ((item.alicuotaIVA ?? 16) / 100)
    }));

    const stockItems = _carrito
      .filter(i => i.tipo === 'producto')
      .map(i => ({ id: i.id, cantidad: i.cantidad, nombre: i.descripcion }));

    let numeroFactura, numeroControl;

    await runTransaction(db, async (tx) => {
      // Leer correlativo
      const corrSnap = await tx.get(correlatRef);
      const ultimo   = corrSnap.exists() ? corrSnap.data() : {};
      numeroFactura  = (ultimo.ultimoNumeroFactura  || 0) + 1;
      numeroControl  = (ultimo.ultimoNumeroControl  || 0) + 1;

      // Leer stock actual para cada producto
      const stockReads = await Promise.all(stockItems.map(s => tx.get(doc(db,'inventario',s.id))));

      // Actualizar correlativo
      tx.set(correlatRef, {
        ultimoNumeroFactura: numeroFactura,
        ultimoNumeroControl: numeroControl,
        actualizado: serverTimestamp()
      }, { merge: true });

      // Escribir factura
      tx.set(facturaRef, {
        numeroFactura,
        numeroControl:        String(numeroControl).padStart(8, '0'),
        serieId,
        rifEmisor:            _configFiscal.rifEmisor,
        razonSocialEmisor:    _configFiscal.razonSocial   || 'AVIPET',
        direccionFiscalEmisor: _configFiscal.direccionFiscal || '',
        rifReceptor,
        nombreReceptor:       nomReceptor,
        direccionReceptor:    dirReceptor,
        esConsumidorFinal:    _esConsumidorFinal,
        propietario:          _clienteActual?.propietario || '',
        cedulaCliente:        _clienteActual?.cedula      || '',
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
        ticketFiscal:         null,
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
