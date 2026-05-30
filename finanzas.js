// =========================================================
// AVIPET — finanzas.js  v5
// Dashboard completo por area con boton volver al menu
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where,
  updateDoc, doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let _tabFinanzas  = null;
let _periodoActual = 'hoy';

// ─── PERIODO ──────────────────────────────────────────────
function _getFechasRango() {
  const hoy = new Date();
  const fmt  = function(d){ return d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear(); };
  if (_periodoActual === 'hoy') return [fmt(hoy)];
  if (_periodoActual === 'semana') {
    const fechas = [];
    const diasDesdeElLunes = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    for (let i = diasDesdeElLunes; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate()-i); fechas.push(fmt(d));
    }
    return fechas;
  }
  if (_periodoActual === 'mes') {
    const fechas = [];
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
    for (let i = 1; i <= diasMes; i++) fechas.push(i+'/'+(hoy.getMonth()+1)+'/'+hoy.getFullYear());
    return fechas;
  }
  return [fmt(hoy)];
}

function _labelPeriodo() {
  return { hoy:'Hoy', semana:'Esta semana', mes:'Este mes' }[_periodoActual] || 'Hoy';
}

// ─── RENDERIZAR: cabecera con volver + selector periodo ───
function _renderCabecera(contenedor, titulo, colorBtn) {
  const cab = document.createElement('div');
  cab.style.cssText = 'margin-bottom:12px;';
  // Botón volver
  const btnV = document.createElement('button');
  btnV.textContent = '← Volver';
  btnV.style.cssText = 'font-size:10px;font-weight:900;text-transform:uppercase;padding:6px 14px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;margin-bottom:10px;';
  btnV.onclick = function(){ window.mostrarMenuFinanzas(); };
  cab.appendChild(btnV);

  // Titulo
  const tit = document.createElement('p');
  tit.textContent = titulo;
  tit.style.cssText = 'font-size:16px;font-weight:900;color:#1e293b;margin:0 0 8px 0;text-transform:uppercase;';
  cab.appendChild(tit);

  // Selector periodo
  const sel = document.createElement('div');
  sel.style.cssText = 'display:flex;gap:4px;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:12px;';
  ['hoy','semana','mes'].forEach(function(p) {
    const b = document.createElement('button');
    b.textContent = { hoy:'Hoy', semana:'Semana', mes:'Mes' }[p];
    b.dataset.p = p;
    b.style.cssText = 'flex:1;padding:6px;border-radius:8px;border:none;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;transition:all .15s;';
    b.style.background = p === _periodoActual ? colorBtn : 'transparent';
    b.style.color      = p === _periodoActual ? '#fff' : '#64748b';
    b.onclick = function() {
      _periodoActual = p;
      if (_tabFinanzas === 'veterinaria') window.mostrarDashboardVet();
      else if (_tabFinanzas === 'peluqueria') window.mostrarDashboardPelu();
    };
    sel.appendChild(b);
  });
  cab.appendChild(sel);
  contenedor.appendChild(cab);
}

// ─── TARJETA RESUMEN ──────────────────────────────────────
function _tarjeta(label, valor, bg, colorVal, sub) {
  return '<div style="background:' + bg + ';border-radius:12px;padding:10px;text-align:center;">' +
    '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">' + label + '</p>' +
    '<p style="font-size:20px;font-weight:900;color:' + colorVal + ';margin:0;font-family:monospace;">' + valor + '</p>' +
    (sub ? '<p style="font-size:8px;color:#94a3b8;margin:2px 0 0 0;">' + sub + '</p>' : '') +
  '</div>';
}

// ─── MENU PRINCIPAL ───────────────────────────────────────
window.mostrarMenuFinanzas = async () => {
  _tabFinanzas = null;
  const listaDiv = document.getElementById('listaReporte');
  if (!listaDiv) return;
  listaDiv.innerHTML = '<p style="text-align:center;padding:12px;font-size:10px;color:#94a3b8;font-weight:700;">Cargando...</p>';

  // Consultar deudas pendientes para mostrar alertas
  // personaId: darwin, joan, peluquera, ayu1, ayuext
  const deudasPorPersona = {};
  try {
    const snapD = await getDocs(collection(db, "deudas"));
    snapD.forEach(function(d) {
      const r = d.data();
      if (r.estado !== 'pagado') {
        const pid = r.personaId || 'otro';
        if (!deudasPorPersona[pid]) deudasPorPersona[pid] = 0;
        deudasPorPersona[pid] += parseFloat(r.monto||0);
      }
    });
  } catch(e) { /* Si falla, seguimos sin alertas */ }

  listaDiv.innerHTML = '';

  // Deudas que afectan a cada boton
  // veterinaria: darwin + joan
  const deudaVet = (deudasPorPersona['darwin']||0) + (deudasPorPersona['joan']||0);
  // peluqueria: peluquera + ayu1 + ayuext
  const deudaPelu = (deudasPorPersona['peluquera']||0) + (deudasPorPersona['ayu1']||0) + (deudasPorPersona['ayuext']||0);
  // total deudas
  const deudaTotal = Object.values(deudasPorPersona).reduce(function(a,b){return a+b;}, 0);

  const botones = [
    { tab:'veterinaria', label:'Veterinaria',       color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', desc:'Consultas, doctores, insumos', deuda: deudaVet  },
    { tab:'peluqueria',  label:'Peluqueria',         color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff', desc:'Servicios, ayudantes, cobros', deuda: deudaPelu },
    { tab:'deudas',      label:'Deudas y Prestamos', color:'#dc2626', bg:'#fef2f2', border:'#fca5a5', desc:'Prestamos pendientes',          deuda: deudaTotal },
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 0;';

  botones.forEach(function(b) {
    const tieneDeuda = b.deuda > 0;
    // Si tiene deuda, el borde y fondo del boton se torna de alerta
    const borderFinal = tieneDeuda ? '#fca5a5' : b.border;
    const btn = document.createElement('button');
    btn.style.cssText = 'width:100%;padding:14px 16px;border-radius:14px;border:2px solid '+borderFinal+';background:'+b.bg+
      ';cursor:pointer;display:flex;align-items:center;justify-content:space-between;text-align:left;position:relative;';

    const badgeDeuda = tieneDeuda
      ? '<span style="background:#dc2626;color:#fff;font-size:8px;font-weight:900;padding:3px 8px;border-radius:20px;text-transform:uppercase;white-space:nowrap;">Deuda $'+b.deuda.toFixed(2)+'</span>'
      : '';

    btn.innerHTML =
      '<div style="flex:1;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:'+(tieneDeuda?'4':'0')+'px;">' +
          '<p style="font-size:14px;font-weight:900;color:'+b.color+';margin:0;">'+b.label+'</p>' +
          badgeDeuda +
        '</div>' +
        '<p style="font-size:10px;color:#94a3b8;margin:0;">'+b.desc+'</p>' +
      '</div>' +
      '<span style="font-size:20px;color:'+b.color+';margin-left:10px;">&rarr;</span>';

    btn.onclick = (function(tab){
      return function(){
        if (tab === 'veterinaria') { _tabFinanzas='veterinaria'; window.mostrarDashboardVet(); }
        else if (tab === 'peluqueria') { _tabFinanzas='peluqueria'; window.mostrarDashboardPelu(); }
        else if (tab === 'deudas') { window.abrirModuloDeudas(); }
      };
    })(b.tab);
    wrap.appendChild(btn);
  });

  listaDiv.appendChild(wrap);
};

// ─── DASHBOARD VETERINARIA ────────────────────────────────
window.mostrarDashboardVet = async () => {
  _tabFinanzas = 'veterinaria';
  const listaDiv = document.getElementById('listaReporte');
  if (!listaDiv) return;
  listaDiv.innerHTML = '<p style="text-align:center;padding:16px;font-size:10px;font-weight:900;color:#94a3b8;">Cargando '+_labelPeriodo()+'...</p>';

  try {
    const fechas = _getFechasRango();
    const snap = await getDocs(collection(db, "consultas"));
    const consultas = [];
    snap.forEach(function(d){ const r=d.data(); if(fechas.includes(r.fechaSimple)) consultas.push({id:d.id,...r}); });
    consultas.sort(function(a,b){ return (b.fecha&&a.fecha)?(b.fecha.seconds||0)-(a.fecha.seconds||0):0; });

    // Consultar deudas doctores
    const deudasDoc = { darwin:0, joan:0 };
    const detDeudasDoc = { darwin:[], joan:[] };
    try {
      const snapD = await getDocs(collection(db, "deudas"));
      snapD.forEach(function(d){
        const r = d.data();
        if (r.estado !== 'pagado') {
          if (r.personaId === 'darwin') { deudasDoc.darwin += parseFloat(r.monto||0); detDeudasDoc.darwin.push({ desc:r.descripcion||'---', monto:parseFloat(r.monto||0) }); }
          if (r.personaId === 'joan')   { deudasDoc.joan   += parseFloat(r.monto||0); detDeudasDoc.joan.push({ desc:r.descripcion||'---', monto:parseFloat(r.monto||0) }); }
        }
      });
    } catch(e) {}

    listaDiv.innerHTML = '';
    const contenedor = document.createElement('div');

    _renderCabecera(contenedor, 'Veterinaria', '#1d4ed8');

    // Calcular totales
    let bruto=0, insumos=0, pDarwin=0, pJoan=0;
    consultas.forEach(function(r){
      const v=parseFloat(r.montoVenta||0), g=parseFloat(r.montoInsumos||0), p=parseFloat(r.pagoDoctor||0);
      bruto+=v; insumos+=g;
      if(r.doctor&&r.doctor.includes('Darwin')) pDarwin+=p; else pJoan+=p;
    });
    const netoAvipet = bruto - insumos - pDarwin - pJoan;

    // Tarjetas fila 1
    const fila1 = document.createElement('div');
    fila1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
    fila1.innerHTML =
      _tarjeta('Bruto cobrado', '$'+bruto.toFixed(2), '#f8fafc', '#1e293b', consultas.length+' consulta'+(consultas.length!==1?'s':'')) +
      _tarjeta('Insumos gastados', '$'+insumos.toFixed(2), '#fffbeb', '#92400e', 'costo materiales');
    contenedor.appendChild(fila1);

    // Tarjetas fila 2 doctores — con deuda si aplica
    function _tarjetaDoc(nombre, comision, deuda, detDeuda, colorVal, bg) {
      const badgeDeuda = deuda > 0
        ? '<div style="background:#dc2626;border-radius:6px;padding:3px 8px;margin-top:6px;">' +
            '<p style="font-size:8px;font-weight:900;color:#fff;margin:0;">Deuda: $'+deuda.toFixed(2)+'</p>' +
            detDeuda.map(function(d){ return '<p style="font-size:8px;color:rgba(255,255,255,0.8);margin:1px 0;">- '+d.desc+'</p>'; }).join('') +
          '</div>'
        : '';
      return '<div style="background:'+bg+';border-radius:12px;padding:10px;text-align:center;">' +
        '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">'+nombre+'</p>' +
        '<p style="font-size:18px;font-weight:900;color:'+colorVal+';margin:0;font-family:monospace;">$'+comision.toFixed(2)+'</p>' +
        '<p style="font-size:8px;color:#94a3b8;margin:2px 0 0 0;">comision</p>' +
        badgeDeuda +
      '</div>';
    }

    const fila2 = document.createElement('div');
    fila2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
    fila2.innerHTML =
      _tarjetaDoc('Dr. Darwin', pDarwin, deudasDoc.darwin, detDeudasDoc.darwin, '#1d4ed8', '#eff6ff') +
      _tarjetaDoc('Dr. Joan',   pJoan,   deudasDoc.joan,   detDeudasDoc.joan,   '#15803d', '#f0fdf4');
    contenedor.appendChild(fila2);

    // Neto Avipet grande
    const netoCard = document.createElement('div');
    netoCard.style.cssText = 'background:'+(netoAvipet>=0?'#1d4ed8':'#dc2626')+';border-radius:14px;padding:14px;text-align:center;margin-bottom:12px;';
    netoCard.innerHTML =
      '<p style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.7);text-transform:uppercase;margin:0;">Neto Avipet — '+_labelPeriodo()+'</p>' +
      '<p style="font-size:32px;font-weight:900;color:#fff;margin:4px 0;font-family:monospace;">$'+netoAvipet.toFixed(2)+'</p>' +
      '<p style="font-size:9px;color:rgba(255,255,255,0.6);margin:0;">Bruto - Insumos - Doctores</p>';
    contenedor.appendChild(netoCard);

    // Botones accion
    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;';
    acciones.innerHTML =
      '<button onclick="window.descargarReporte()" style="background:#f1f5f9;color:#64748b;border:none;border-radius:10px;padding:10px;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;">Descargar TXT</button>' +
      '<button onclick="window.guardarResumenDelDia()" style="background:#1d4ed8;color:#fff;border:none;border-radius:10px;padding:10px;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;">Guardar en Nube</button>';
    contenedor.appendChild(acciones);

    // Lista detalle
    if (consultas.length === 0) {
      const vacio = document.createElement('p');
      vacio.style.cssText = 'text-align:center;color:#94a3b8;font-size:10px;font-weight:900;text-transform:uppercase;padding:20px;';
      vacio.textContent = 'Sin consultas para este periodo';
      contenedor.appendChild(vacio);
    } else {
      const tit = document.createElement('p');
      tit.style.cssText = 'font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;';
      tit.textContent = 'Detalle — ' + consultas.length + ' consulta' + (consultas.length!==1?'s':'');
      contenedor.appendChild(tit);

      consultas.forEach(function(r) {
        const v=parseFloat(r.montoVenta||0), g=parseFloat(r.montoInsumos||0), p=parseFloat(r.pagoDoctor||0);
        const neto=v-g-p;
        const esDarwin = r.doctor&&r.doctor.includes('Darwin');
        const card = document.createElement('div');
        card.style.cssText = 'background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:6px;border-left:4px solid '+(esDarwin?'#2563eb':'#10b981')+';';
        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div>' +
              '<p style="font-size:11px;font-weight:900;color:#1e293b;margin:0;text-transform:uppercase;">'+(r.paciente||'---')+(r.esMuestra?' (Muestra)':'')+'</p>' +
              '<p style="font-size:9px;color:#64748b;margin:2px 0;">'+(r.doctor||'---')+' &middot; '+(r.fechaSimple||'')+'</p>' +
            '</div>' +
            '<p style="font-size:13px;font-weight:900;color:#1e293b;margin:0;font-family:monospace;">$'+v.toFixed(2)+'</p>' +
          '</div>' +
          '<div style="display:flex;gap:10px;margin-top:5px;font-size:9px;">' +
            '<span style="color:#92400e;font-weight:700;">Ins: $'+g.toFixed(2)+'</span>' +
            '<span style="color:'+(esDarwin?'#1d4ed8':'#15803d')+';font-weight:700;">Doc: $'+p.toFixed(2)+'</span>' +
            '<span style="color:#16a34a;font-weight:900;">Avipet: $'+neto.toFixed(2)+'</span>' +
          '</div>';
        contenedor.appendChild(card);
      });
    }

    listaDiv.appendChild(contenedor);
  } catch(e) {
    listaDiv.innerHTML = '<p style="color:#dc2626;font-weight:900;text-align:center;padding:16px;">Error: '+e.message+'</p>';
  }
};

// ─── DASHBOARD PELUQUERIA ─────────────────────────────────
window.mostrarDashboardPelu = async () => {
  _tabFinanzas = 'peluqueria';
  const listaDiv = document.getElementById('listaReporte');
  if (!listaDiv) return;
  listaDiv.innerHTML = '<p style="text-align:center;padding:16px;font-size:10px;font-weight:900;color:#94a3b8;">Cargando '+_labelPeriodo()+'...</p>';

  try {
    const fechas = _getFechasRango();
    const snap = await getDocs(collection(db, "servicios_estetica"));
    const servicios = [];
    snap.forEach(function(d){ const r=d.data(); if(fechas.includes(r.fechaSimple)) servicios.push({id:d.id,...r}); });
    servicios.sort(function(a,b){ return (b.fecha&&a.fecha)?(b.fecha.seconds||0)-(a.fecha.seconds||0):0; });

    // Consultar deudas pendientes del equipo peluqueria
    const deudasEquipo = { peluquera:0, ayu1:0, ayuext:0 };
    try {
      const snapD = await getDocs(collection(db, "deudas"));
      snapD.forEach(function(d){
        const r = d.data();
        if (r.estado !== 'pagado' && deudasEquipo.hasOwnProperty(r.personaId)) {
          deudasEquipo[r.personaId] += parseFloat(r.monto||0);
        }
      });
    } catch(e) {}

    listaDiv.innerHTML = '';
    const contenedor = document.createElement('div');

    _renderCabecera(contenedor, 'Peluqueria', '#7c3aed');

    // Calcular totales
    let bruto=0, pPelu=0, pAyu1=0, pAyuExt=0, neto=0, pendiente=0;
    let cobradoUSD=0, cobradoBS=0, ayuUSD=0, ayuBS=0;
    let perrosConAyu=0;
    servicios.forEach(function(r){
      const precio=parseFloat(r.precioTotal||0);
      const pa=parseFloat(r.pagoPeluquera||0);
      const a1=parseFloat(r.pagoAyudante1||0);
      const ax=parseFloat(r.pagoAyudanteExtra||0);
      const n=parseFloat(r.ingresoAvipet||0);
      bruto+=precio; pPelu+=pa; pAyu1+=a1; pAyuExt+=ax; neto+=n;
      if(r.estatusPago==='pagado'){
        const usd=parseFloat(r.montoPagadoUSD||0);
        const bs=parseFloat(r.montoPagadoBS||0);
        if(r.modoPago==='bs'){ cobradoBS+=bs; }
        else if(r.modoPago==='mixto'){ cobradoUSD+=usd; cobradoBS+=bs; }
        else { cobradoUSD+=usd||precio; }
      } else { pendiente+=precio; }
      if(a1>0) perrosConAyu++;
    });
    const pagoAyu1Real = perrosConAyu * 2;
    // Cobrado Ayudante 1 equivalente: como se descuenta $1 por pelu y $1 por Avipet,
    // se calcula proporcional al modo de pago de cada servicio
    // Simplificación: dividir pagoAyu1Real por proporcion USD/Bs del total cobrado
    const totalCobrado = cobradoUSD + cobradoBS;
    const porcUSD = totalCobrado > 0 ? cobradoUSD / totalCobrado : 1;
    ayuUSD = parseFloat((pagoAyu1Real * porcUSD).toFixed(2));
    ayuBS  = parseFloat((pagoAyu1Real * (1 - porcUSD)).toFixed(2));

    // Fila 1 — 3 tarjetas resumen
    const fila1 = document.createElement('div');
    fila1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px;';
    fila1.innerHTML =
      _tarjeta('Bruto', '$'+bruto.toFixed(2), '#f8fafc', '#1e293b', servicios.length+' servicio'+(servicios.length!==1?'s':'')) +
      _tarjeta('Pendiente', '$'+pendiente.toFixed(2), '#fef2f2', '#dc2626', 'sin cobrar') +
      _tarjeta('Neto Avipet', '$'+neto.toFixed(2), '#f0fdf4', '#16a34a', '60% - $1/perro c/ayu');
    contenedor.appendChild(fila1);

    // Fila 2 — cobros en caja
    const fila2 = document.createElement('div');
    fila2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
    fila2.innerHTML =
      _tarjeta('Caja USD', '$'+cobradoUSD.toFixed(2), '#f0fdf4', '#16a34a', 'efectivo dolares') +
      _tarjeta('Caja Bs', 'Bs '+cobradoBS.toFixed(2), '#fffbeb', '#92400e', 'bolivares');
    contenedor.appendChild(fila2);

    // Fila 3 — peluquera con nota de deuda si aplica
    const deudaPelu = deudasEquipo['peluquera'];
    const deudaAyu1 = deudasEquipo['ayu1'];
    const deudaAyuExt = deudasEquipo['ayuext'];

    function _tarjetaConDeuda(label, valor, bg, colorVal, sub, deuda) {
      const montoNum = parseFloat(valor.replace('$','')) || 0;
      const neto = Math.max(0, montoNum - deuda);
      const alertaHtml = deuda > 0
        ? '<div style="border-top:1px solid #fca5a5;margin-top:6px;padding-top:6px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
              '<p style="font-size:8px;color:#64748b;margin:0;">Gano:</p>' +
              '<p style="font-size:8px;font-weight:900;color:'+colorVal+';margin:0;">'+valor+'</p>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
              '<p style="font-size:8px;color:#dc2626;margin:0;">Debe:</p>' +
              '<p style="font-size:8px;font-weight:900;color:#dc2626;margin:0;">-$'+deuda.toFixed(2)+'</p>' +
            '</div>' +
            '<div style="background:#dc2626;border-radius:6px;padding:3px 6px;display:flex;justify-content:space-between;">' +
              '<p style="font-size:8px;font-weight:900;color:#fff;margin:0;">Cobra:</p>' +
              '<p style="font-size:10px;font-weight:900;color:#fff;margin:0;">$'+neto.toFixed(2)+'</p>' +
            '</div>' +
          '</div>'
        : '';
      return '<div style="background:'+bg+';border-radius:12px;padding:10px;text-align:center;border:'+(deuda>0?'2px solid #fca5a5':'1px solid transparent')+';">' +
        '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">'+label+'</p>' +
        '<p style="font-size:18px;font-weight:900;color:'+(deuda>0?'#94a3b8':colorVal)+';margin:0;font-family:monospace;'+(deuda>0?'text-decoration:line-through;':'')+'">'+valor+'</p>' +
        (sub ? '<p style="font-size:8px;color:#94a3b8;margin:2px 0 0 0;">'+sub+'</p>' : '') +
        alertaHtml +
      '</div>';
    }

    const fila3 = document.createElement('div');
    fila3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px;';
    fila3.innerHTML =
      _tarjetaConDeuda('Peluquera', '$'+pPelu.toFixed(2), '#faf5ff', '#7c3aed', '40% - $1/c/ayu', deudaPelu) +
      _tarjetaConDeuda('Ayu. Extra', '$'+pAyuExt.toFixed(2), '#fff7ed', '#ea580c', 'hizo todo solo', deudaAyuExt);
    contenedor.appendChild(fila3);

    // Fila 4 — Ayudante 1 con desglose USD/Bs y deuda
    const fila4 = document.createElement('div');
    fila4.style.cssText = 'margin-bottom:8px;';
    const hayDeudaAyu1 = deudaAyu1 > 0;
    fila4.innerHTML =
      '<div style="background:#eff6ff;border-radius:12px;padding:10px;border:'+(hayDeudaAyu1?'2px solid #dc2626':'1px solid #bfdbfe')+';position:relative;">' +
        '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 4px 0;">Ayudante Principal — '+perrosConAyu+' perros con ayu</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">' +
          '<div style="text-align:center;">' +
            '<p style="font-size:8px;color:#94a3b8;margin:0;">Total</p>' +
            '<p style="font-size:18px;font-weight:900;color:#2563eb;margin:0;font-family:monospace;">$'+pagoAyu1Real.toFixed(2)+'</p>' +
            '<p style="font-size:8px;color:#94a3b8;margin:0;">'+perrosConAyu+' x $1 x 2</p>' +
          '</div>' +
          '<div style="text-align:center;">' +
            '<p style="font-size:8px;color:#94a3b8;margin:0;">En USD</p>' +
            '<p style="font-size:18px;font-weight:900;color:#16a34a;margin:0;font-family:monospace;">$'+ayuUSD.toFixed(2)+'</p>' +
          '</div>' +
          '<div style="text-align:center;">' +
            '<p style="font-size:8px;color:#94a3b8;margin:0;">En Bs</p>' +
            '<p style="font-size:18px;font-weight:900;color:#92400e;margin:0;font-family:monospace;">Bs '+ayuBS.toFixed(2)+'</p>' +
          '</div>' +
        '</div>' +
        (hayDeudaAyu1 ?
          '<div style="background:#dc2626;border-radius:8px;padding:6px 10px;margin-top:8px;text-align:center;">' +
            '<p style="font-size:9px;font-weight:900;color:#fff;margin:0;">DEUDA PENDIENTE: $'+deudaAyu1.toFixed(2)+'</p>' +
          '</div>' : '') +
      '</div>';
    contenedor.appendChild(fila4);

    // Botones accion
    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;';
    acciones.innerHTML =
      '<button onclick="_llamarFuncion(\'verResumenSemanalPelu\')" style="background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;">Resumen Semanal</button>' +
      '<button onclick="_llamarFuncion(\'ajustarPagoPeluqueria\')" style="background:#f59e0b;color:#fff;border:none;border-radius:10px;padding:10px;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer;">Ajustar Pagos</button>';
    contenedor.appendChild(acciones);

    // Lista detalle
    if (servicios.length === 0) {
      const vacio = document.createElement('p');
      vacio.style.cssText = 'text-align:center;color:#94a3b8;font-size:10px;font-weight:900;text-transform:uppercase;padding:20px;';
      vacio.textContent = 'Sin servicios para este periodo';
      contenedor.appendChild(vacio);
    } else {
      const tit = document.createElement('p');
      tit.style.cssText = 'font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;';
      tit.textContent = 'Detalle — ' + servicios.length + ' servicio' + (servicios.length!==1?'s':'');
      contenedor.appendChild(tit);

      servicios.forEach(function(r) {
        const precio=parseFloat(r.precioTotal||0);
        const pa=parseFloat(r.pagoPeluquera||0);
        const a1=parseFloat(r.pagoAyudante1||0);
        const ax=parseFloat(r.pagoAyudanteExtra||0);
        const n=parseFloat(r.ingresoAvipet||0);
        const pagado=r.estatusPago==='pagado';
        const tieneA1=a1>0, tieneAx=ax>0;

        const modoLabel = r.modoPago==='bs'?'Bs':r.modoPago==='mixto'?'Mixto':'USD';
        const peluBruto=(precio*0.40).toFixed(2);
        const avBruto=(precio*0.60).toFixed(2);

        const card = document.createElement('div');
        card.style.cssText = 'background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:6px;border-left:4px solid #7c3aed;';
        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div>' +
              '<p style="font-size:11px;font-weight:900;color:#1e293b;margin:0;text-transform:uppercase;">'+(r.paciente||'---')+'</p>' +
              '<p style="font-size:9px;color:#64748b;margin:2px 0;">'+(r.duenio||'')+(r.duenio?' &middot; ':'')+''+(r.fechaSimple||'')+'</p>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<p style="font-size:13px;font-weight:900;color:#1e293b;margin:0;font-family:monospace;">$'+precio.toFixed(2)+'</p>' +
              '<p style="font-size:9px;font-weight:900;color:'+(pagado?'#16a34a':'#dc2626')+';margin:0;">'+(pagado?'PAGADO '+modoLabel:'PENDIENTE')+'</p>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:5px;font-size:9px;">' +
            '<span style="color:#7c3aed;font-weight:700;">Pelu: '+(tieneA1?'($'+peluBruto+' - $1) = ':'')+'$'+pa.toFixed(2)+'</span>' +
            (tieneA1?'<span style="color:#2563eb;font-weight:700;">Ayu1: $'+a1.toFixed(2)+'</span>':'') +
            (tieneAx?'<span style="color:#ea580c;font-weight:700;">Extra: $'+ax.toFixed(2)+'</span>':'') +
            '<span style="color:#16a34a;font-weight:900;">Avipet: '+(tieneA1?'($'+avBruto+' - $1) = ':'')+'$'+n.toFixed(2)+'</span>' +
          '</div>';
        contenedor.appendChild(card);
      });
    }

    listaDiv.appendChild(contenedor);
  } catch(e) {
    listaDiv.innerHTML = '<p style="color:#dc2626;font-weight:900;text-align:center;padding:16px;">Error: '+e.message+'</p>';
  }
};

// ─── COMPATIBILIDAD: cargarReporte sigue funcionando ─────
window.cargarReporte = async () => {
  if (!_tabFinanzas) { window.mostrarMenuFinanzas(); return; }
  if (_tabFinanzas === 'veterinaria') { window.mostrarDashboardVet(); return; }
  if (_tabFinanzas === 'peluqueria')  { window.mostrarDashboardPelu(); return; }
};

window.cambiarPeriodoFinanzas = function(p) {
  _periodoActual = p;
  window.cargarReporte();
};

window.volverMenuFinanzas = function() {
  _tabFinanzas = null;
  window.mostrarMenuFinanzas();
};

window.cambiarTabFinanzas = function(tab) {
  _tabFinanzas = tab;
  window.cargarReporte();
};

window.setCalcModo=(modo)=>{
  window._calcModoActual=modo;
  const btnUsd=document.getElementById('btnUsdToBS'),btnBs=document.getElementById('btnBsToUSD'),simbolo=document.getElementById('calcSimbolo'),modoEl=document.getElementById('calcModo');
  if(modoEl)modoEl.value=modo;
  if(btnUsd&&btnBs){
    if(modo==='usdToBS'){
      btnUsd.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all bg-blue-600 text-white shadow-sm';
      btnBs.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all text-slate-500';
      if(simbolo)simbolo.innerText='$';
    }else{
      btnBs.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all bg-amber-500 text-white shadow-sm';
      btnUsd.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all text-slate-500';
      if(simbolo)simbolo.innerText='Bs';
    }
  }
  const inputEl=document.getElementById('calcInput');if(inputEl?.value)window.calcularConversor();
};
window.calcularConversor=()=>{
  const tasa=window.tasaDolarHoy||36,modo=document.getElementById('calcModo')?.value||window._calcModoActual||'usdToBS',inputEl=document.getElementById('calcInput'),resultEl=document.getElementById('calcResultado'),tasaEl=document.getElementById('calcTasaMostrar');
  if(!inputEl||!resultEl)return;
  const monto=parseFloat(inputEl.value)||0;
  if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";
  if(monto<=0){resultEl.innerHTML='<p class="text-[10px] text-slate-400 italic font-bold uppercase">Ingresa un monto arriba</p>';return;}
  if(modo==='usdToBS'){const r=monto*tasa;resultEl.innerHTML='<p class="text-[10px] text-slate-500 uppercase font-bold mb-1">$'+monto.toFixed(2)+' equivale a:</p><p class="text-4xl font-black text-amber-600 font-mono">Bs '+r.toFixed(2)+'</p><p class="text-[9px] text-slate-400 mt-2 italic">Tasa BCV: '+tasa.toFixed(2)+'</p>';}
  else{const r=monto/tasa;resultEl.innerHTML='<p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Bs '+monto.toFixed(2)+' equivale a:</p><p class="text-4xl font-black text-emerald-600 font-mono">$ '+r.toFixed(2)+'</p><p class="text-[9px] text-slate-400 mt-2 italic">Tasa BCV: '+tasa.toFixed(2)+'</p>';}
};
window.aplicarTasaManualCalc=()=>{
  const inp=document.getElementById('calcTasaManual'),tasa=parseFloat(inp?.value);
  if(!tasa||tasa<1){alert('Ingresa una tasa valida');return;}
  window.tasaDolarHoy=tasa;
  const tasaEl=document.getElementById('calcTasaMostrar');
  if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";
  if(inp)inp.value='';
  window.calcularConversor();
};
window.inicializarCalculadora=()=>{
  const tasa=window.tasaDolarHoy||36,tasaEl=document.getElementById('calcTasaMostrar');
  if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";
  window.setCalcModo('usdToBS');
};

// ─── AJUSTAR PAGO DESDE FINANZAS ─────────────────────────
window.ajustarPagoPeluqueria = async () => {
  const resFecha = await Swal.fire({
    title: 'Ajustar Pago - Seleccionar Fecha',
    html: '<p class="text-[11px] text-slate-500 mb-3">Fecha de los servicios a ajustar:</p>' +
          '<input type="date" id="swal_fecha_ajuste" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">',
    showCancelButton: true,
    confirmButtonText: 'Ver servicios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const val = document.getElementById('swal_fecha_ajuste')?.value;
      if (!val) { Swal.showValidationMessage('Selecciona una fecha'); return false; }
      const parts = val.split('-');
      return parseInt(parts[2]) + '/' + parseInt(parts[1]) + '/' + parts[0];
    }
  });
  if (!resFecha.isConfirmed) return;
  const fechaSimple = resFecha.value;

  try {
    const snap = await getDocs(query(collection(db,"servicios_estetica"), where("fechaSimple","==",fechaSimple)));
    if (snap.empty) {
      Swal.fire({ icon:'info', title:'Sin registros', text:'No hay servicios para: '+fechaSimple, timer:2000, showConfirmButton:false });
      return;
    }
    const todos = [];
    const pendientes = [];
    snap.forEach(d => {
      const r = d.data();
      todos.push({ id:d.id, ...r });
      if ((r.estatusPago||'pendiente') !== 'pagado') pendientes.push({ id:d.id, ...r });
    });
    if (pendientes.length === 0) {
      Swal.fire({ icon:'info', title:'Todo pagado', text:'No hay pendientes para '+fechaSimple, timer:2000, showConfirmButton:false });
      return;
    }
    let htmlLista = '<p class="text-[10px] text-slate-500 mb-2">Marca los que SI fueron pagados:</p>';
    htmlLista += '<div class="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2">';
    pendientes.forEach(r => {
      const precio = parseFloat(r.precioTotal||0).toFixed(2);
      htmlLista += '<label class="flex items-center gap-2 py-1.5 border-b border-slate-100 cursor-pointer">';
      htmlLista += '<input type="checkbox" class="chk-ajuste w-4 h-4 accent-blue-600" value="' + r.id + '">';
      htmlLista += '<span class="text-[10px] font-bold text-slate-700 flex-1">' + (r.paciente||'---') + ' &middot; ' + (r.duenio||'') + '</span>';
      htmlLista += '<span class="text-[10px] font-black">$' + precio + '</span>';
      htmlLista += '</label>';
    });
    htmlLista += '</div>';
    htmlLista += '<label class="flex items-center gap-2 mt-2 cursor-pointer">';
    htmlLista += '<input type="checkbox" id="chk_todos" onchange="document.querySelectorAll(\'.chk-ajuste\').forEach(function(c){c.checked=document.getElementById(\'chk_todos\').checked;})">';
    htmlLista += '<span class="text-[10px] font-bold text-slate-600">Seleccionar todos</span>';
    htmlLista += '</label>';

    const resServ = await Swal.fire({
      title: 'Ajustar - ' + fechaSimple,
      html: htmlLista,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const sel = Array.from(document.querySelectorAll('.chk-ajuste:checked')).map(function(c){return c.value;});
        if (sel.length === 0) { Swal.showValidationMessage('Marca al menos uno'); return false; }
        return sel;
      }
    });
    if (!resServ.isConfirmed) return;
    const idsAjustar = resServ.value;

    let htmlModo = '<div class="flex flex-col gap-2 mt-2">';
    htmlModo += '<button type="button" onclick="window._modoAjuste=\'usd\';Swal.clickConfirm()" class="w-full py-3 rounded-xl border-2 border-blue-200 bg-blue-50 font-black text-sm text-blue-700 hover:bg-blue-600 hover:text-white">Dolares (USD)</button>';
    htmlModo += '<button type="button" onclick="window._modoAjuste=\'bs\';Swal.clickConfirm()" class="w-full py-3 rounded-xl border-2 border-amber-200 bg-amber-50 font-black text-sm text-amber-700 hover:bg-amber-500 hover:text-white">Bolivares (Bs)</button>';
    htmlModo += '<button type="button" onclick="window._modoAjuste=\'mixto\';Swal.clickConfirm()" class="w-full py-3 rounded-xl border-2 border-slate-200 bg-slate-50 font-black text-sm text-slate-600 hover:bg-slate-600 hover:text-white">Mixto</button>';
    htmlModo += '</div>';

    await Swal.fire({
      title: 'Como pagaron?',
      html: htmlModo,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar'
    });

    const modo = window._modoAjuste || 'usd';
    window._modoAjuste = null;

    let actualizados = 0;
    for (let i = 0; i < idsAjustar.length; i++) {
      const id = idsAjustar[i];
      const serv = pendientes.find(function(p){return p.id===id;});
      const monto = parseFloat(serv ? serv.precioTotal : 0);
      let montUSD = monto, montBS = 0;
      if (modo === 'bs')    { montUSD = 0; montBS = monto; }
      if (modo === 'mixto') { montUSD = monto/2; montBS = monto/2; }
      await updateDoc(doc(db,"servicios_estetica",id), {
        estatusPago: 'pagado',
        modoPago: modo,
        montoPagadoUSD: montUSD,
        montoPagadoBS: montBS,
        ajustadoManualmente: true,
        actualizadoEn: serverTimestamp()
      });
      actualizados++;
    }
    await Swal.fire({ icon:'success', title:actualizados + ' ajustado(s)', text:fechaSimple + ' - ' + modo.toUpperCase(), timer:2000, showConfirmButton:false });
    window.cargarReporte();
  } catch(e) { console.error(e); alert('Error: '+e.message); }
};

// ─── RESUMEN SEMANAL PELUQUERIA ───────────────────────────
window.verResumenSemanalPelu = async () => {
  try {
    const hoy = new Date();
    const fechas = [];
    const diaSemana = hoy.getDay();
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    for (let i = diasDesdeElLunes; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate()-i);
      fechas.push(d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear());
    }

    // Consultar deudas pendientes del equipo
    const deudasEquipo = { peluquera:0, ayu1:0, ayuext:0 };
    const detDeudas = { peluquera:[], ayu1:[], ayuext:[] };
    try {
      const snapD = await getDocs(collection(db, "deudas"));
      snapD.forEach(function(d){
        const r = d.data();
        if (r.estado !== 'pagado' && deudasEquipo.hasOwnProperty(r.personaId)) {
          deudasEquipo[r.personaId] += parseFloat(r.monto||0);
          detDeudas[r.personaId].push({ desc: r.descripcion||'---', monto: parseFloat(r.monto||0) });
        }
      });
    } catch(e) {}

    const snap = await getDocs(collection(db,"servicios_estetica"));
    const servicios = [];
    snap.forEach(function(d) { const r=d.data(); if(fechas.includes(r.fechaSimple)) servicios.push({id:d.id,...r}); });

    if (servicios.length === 0) {
      Swal.fire({ icon:'info', title:'Sin servicios esta semana', timer:2000, showConfirmButton:false });
      return;
    }

    servicios.sort(function(a,b){return (a.fecha&&b.fecha)?(a.fecha.seconds||0)-(b.fecha.seconds||0):0;});

    let totalBruto=0, totalPelu=0, totalAyuExt=0, totalAvipet=0, pendiente=0;
    let perrosConAyu=0, perrosSinAyu=0;
    let totalPeluUSD=0, totalPeluBS=0, totalAvipetUSD=0, totalAvipetBS=0;
    let totalBrutoUSD=0, totalBrutoBS=0;
    let rows = '';

    servicios.forEach(function(r) {
      const precio  = parseFloat(r.precioTotal||0);
      const pagPelu = parseFloat(r.pagoPeluquera||0);
      const pagA1   = parseFloat(r.pagoAyudante1||0);
      const pagAx   = parseFloat(r.pagoAyudanteExtra||0);
      const neto    = parseFloat(r.ingresoAvipet||0);
      const pagado  = r.estatusPago === 'pagado';
      const tieneA1 = pagA1 > 0;

      totalBruto  += precio;
      totalPelu   += pagPelu;
      totalAyuExt += pagAx;
      totalAvipet += neto;
      if (!pagado) pendiente += precio;
      if (tieneA1) perrosConAyu++; else perrosSinAyu++;

      // Acumular por moneda para el desglose USD/Bs
      const modoPagoR = r.modoPago || 'usd';
      if (modoPagoR === 'bs') {
        totalPeluBS   += pagPelu;
        totalAvipetBS += neto;
        totalBrutoBS  += precio;
      } else if (modoPagoR === 'mixto') {
        // Mitad en USD, mitad en Bs
        totalPeluUSD   += pagPelu / 2;
        totalPeluBS    += pagPelu / 2;
        totalAvipetUSD += neto / 2;
        totalAvipetBS  += neto / 2;
        totalBrutoUSD  += precio / 2;
        totalBrutoBS   += precio / 2;
      } else {
        totalPeluUSD   += pagPelu;
        totalAvipetUSD += neto;
        totalBrutoUSD  += precio;
      }

      // Desglose de la resta
      const peluBruto   = parseFloat((precio * 0.40).toFixed(2));
      const avipetBruto = parseFloat((precio * 0.60).toFixed(2));

      const colorEst = pagado ? '#16a34a' : '#dc2626';
      const iconPago = pagado ? 'PAGADO' : 'PENDIENTE';

      rows += '<tr style="border-bottom:1px solid #f1f5f9;font-size:9px;">';
      rows += '<td style="padding:4px 6px;color:#64748b;">' + (r.fechaSimple||'---') + '</td>';
      rows += '<td style="padding:4px 6px;font-weight:700;text-transform:uppercase;">' + (r.paciente||'---') + '</td>';
      rows += '<td style="padding:4px 6px;text-align:center;font-weight:700;">$' + precio.toFixed(2) + '</td>';
      // Columna peluquera con resta visible
      if (tieneA1) {
        rows += '<td style="padding:4px 6px;text-align:center;color:#7c3aed;font-weight:700;">$' + peluBruto.toFixed(2) + ' - $1 = <b>$' + pagPelu.toFixed(2) + '</b></td>';
      } else {
        rows += '<td style="padding:4px 6px;text-align:center;color:#7c3aed;font-weight:700;">$' + pagPelu.toFixed(2) + '</td>';
      }
      rows += '<td style="padding:4px 6px;text-align:center;color:#2563eb;font-weight:700;">' + (tieneA1 ? '$'+pagA1.toFixed(2) : '&mdash;') + '</td>';
      // Columna Extra
      rows += '<td style="padding:4px 6px;text-align:center;color:#ea580c;font-weight:700;">' + (pagAx > 0 ? '$'+pagAx.toFixed(2) : '&mdash;') + '</td>';
      // Columna Avipet con resta visible
      if (tieneA1) {
        rows += '<td style="padding:4px 6px;text-align:center;color:#16a34a;font-weight:700;font-size:8px;">$' + avipetBruto.toFixed(2) + ' - $1 = <b>$' + neto.toFixed(2) + '</b></td>';
      } else {
        rows += '<td style="padding:4px 6px;text-align:center;color:#16a34a;font-weight:700;">$' + neto.toFixed(2) + '</td>';
      }
      // Columna pago — monto en dolares con etiqueta Bs o USD
      var modoPago = r.modoPago || '';
      var labelPago = 'PEND';
      if (r.estatusPago === 'pagado') {
        if (modoPago === 'bs') {
          labelPago = '$' + precio.toFixed(2) + ' (Bs)';
        } else if (modoPago === 'mixto') {
          labelPago = '$' + (precio/2).toFixed(2) + '$ + $' + (precio/2).toFixed(2) + '(Bs)';
        } else {
          labelPago = '$' + precio.toFixed(2) + ' USD';
        }
      }
      rows += '<td style="padding:4px 6px;text-align:center;color:' + colorEst + ';font-weight:900;font-size:8px;">' + labelPago + '</td>';
      rows += '</tr>';
    });

    // Pago real ayudante: $1 x perros x 2 (uno de pelu + uno de Avipet)
    const pagoAyu1Real = perrosConAyu * 2;

    let htmlModal = '';
    // Fila 1 de cards — 3 columnas
    htmlModal += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;text-align:left;">';


    // Helper: muestra ganó/debe/cobra si hay deuda
    function _desglosDeuda(ganado, deuda, colorGanado) {
      if (deuda <= 0) return '';
      const neto = Math.max(0, ganado - deuda);
      return '<div style="border-top:1px solid #fca5a5;margin-top:6px;padding-top:6px;">' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<p style="font-size:8px;color:#64748b;margin:0;">Gano:</p>' +
          '<p style="font-size:8px;font-weight:900;color:'+colorGanado+';margin:0;">$'+ganado.toFixed(2)+'</p>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<p style="font-size:8px;color:#dc2626;margin:0;">Debe:</p>' +
          '<p style="font-size:8px;font-weight:900;color:#dc2626;margin:0;">-$'+deuda.toFixed(2)+'</p>' +
        '</div>' +
        '<div style="background:#dc2626;border-radius:6px;padding:3px 6px;margin-top:4px;display:flex;justify-content:space-between;">' +
          '<p style="font-size:8px;font-weight:900;color:#fff;margin:0;">Cobra:</p>' +
          '<p style="font-size:11px;font-weight:900;color:#fff;margin:0;">$'+neto.toFixed(2)+'</p>' +
        '</div>' +
      '</div>';
    }

    htmlModal += '<div style="background:#f8fafc;border-radius:12px;padding:10px;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Servicios semana</p>';
    htmlModal += '<p style="font-size:20px;font-weight:900;color:#1e293b;">' + servicios.length + ' perros</p>';
    htmlModal += '<p style="font-size:9px;color:#64748b;">Con ayu1: <b>' + perrosConAyu + '</b></p>';
    htmlModal += '<p style="font-size:9px;color:#64748b;">Sin ayu: <b>' + perrosSinAyu + '</b></p></div>';

    htmlModal += '<div style="background:#f5f3ff;border-radius:12px;padding:10px;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#7c3aed;text-transform:uppercase;">Peluquera</p>';
    if (totalPeluUSD > 0 && totalPeluBS > 0) {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#7c3aed;margin:2px 0;">$' + totalPeluUSD.toFixed(2) + ' USD</p>';
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#92400e;margin:2px 0;">$' + totalPeluBS.toFixed(2) + ' en Bs</p>';
    } else if (totalPeluBS > 0) {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#92400e;margin:2px 0;">$' + totalPeluBS.toFixed(2) + ' en Bs</p>';
    } else {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#7c3aed;margin:2px 0;">$' + totalPelu.toFixed(2) + ' USD</p>';
    }
    htmlModal += '<p style="font-size:9px;color:#94a3b8;">40% - $1/perro con ayu</p>';
    htmlModal += _desglosDeuda(totalPelu, deudasEquipo['peluquera']||0, '#7c3aed');
    htmlModal += '</div>';

    // Desglose ayu1: $2 por mascota (=$1 pelu + $1 avipet) en la moneda que pagó
    var ayu1USD = 0, ayu1BS = 0;
    servicios.forEach(function(r2) {
      if (parseFloat(r2.pagoAyudante1||0) > 0) {
        var mp = r2.modoPago || 'usd';
        if (mp === 'bs') { ayu1BS += 2; }           // $2 en Bs
        else if (mp === 'mixto') { ayu1USD += 1; ayu1BS += 1; } // $1 USD + $1 en Bs
        else { ayu1USD += 2; }                       // $2 USD
      }
    });
    htmlModal += '<div style="background:#eff6ff;border-radius:12px;padding:10px;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#2563eb;text-transform:uppercase;">Ayudante 1</p>';
    htmlModal += '<p style="font-size:9px;color:#94a3b8;margin:0 0 4px 0;">' + perrosConAyu + ' mascotas x $2 ($1 pelu + $1 Avipet)</p>';
    if (ayu1USD > 0 && ayu1BS > 0) {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#2563eb;margin:2px 0;">$' + ayu1USD.toFixed(2) + ' USD</p>';
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#92400e;margin:2px 0;">$' + ayu1BS.toFixed(2) + ' en Bs</p>';
    } else if (ayu1BS > 0) {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#92400e;margin:2px 0;">$' + ayu1BS.toFixed(2) + ' en Bs</p>';
    } else {
      htmlModal += '<p style="font-size:18px;font-weight:900;color:#2563eb;margin:2px 0;">$' + ayu1USD.toFixed(2) + ' USD</p>';
    }
    // Desglose deuda Ayu1
    var totalAyu1 = ayu1USD + ayu1BS;
    htmlModal += _desglosDeuda(totalAyu1, deudasEquipo['ayu1']||0, '#2563eb');
    htmlModal += '</div></div>';

    // Fila 2 de cards — 4 columnas (con Extra separado)
    htmlModal += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';

    htmlModal += '<div style="background:#fff7ed;border-radius:10px;padding:8px;text-align:center;border:2px solid #fed7aa;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#ea580c;text-transform:uppercase;">Ayud. Extra</p>';
    htmlModal += '<p style="font-size:16px;font-weight:900;color:#ea580c;">$' + totalAyuExt.toFixed(2) + '</p>';
    htmlModal += '<p style="font-size:8px;color:#94a3b8;">hizo todo solo</p>';
    htmlModal += _desglosDeuda(totalAyuExt, deudasEquipo['ayuext']||0, '#ea580c');
    htmlModal += '</div>';

    htmlModal += '<div style="background:#f0fdf4;border-radius:10px;padding:8px;text-align:center;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#16a34a;text-transform:uppercase;">Neto Avipet</p>';
    if (totalAvipetUSD > 0 && totalAvipetBS > 0) {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#16a34a;margin:2px 0;">$' + totalAvipetUSD.toFixed(2) + ' USD</p>';
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#92400e;margin:2px 0;">$' + totalAvipetBS.toFixed(2) + ' en Bs</p>';
    } else if (totalAvipetBS > 0) {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#92400e;margin:2px 0;">$' + totalAvipetBS.toFixed(2) + ' en Bs</p>';
    } else {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#16a34a;margin:2px 0;">$' + totalAvipetUSD.toFixed(2) + ' USD</p>';
    }
    htmlModal += '</div>';

    htmlModal += '<div style="background:#fef2f2;border-radius:10px;padding:8px;text-align:center;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#dc2626;text-transform:uppercase;">Pendiente</p>';
    htmlModal += '<p style="font-size:16px;font-weight:900;color:#dc2626;">$' + pendiente.toFixed(2) + '</p></div>';

    htmlModal += '<div style="background:#1e293b;border-radius:10px;padding:8px;text-align:center;">';
    htmlModal += '<p style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Bruto semana</p>';
    if (totalBrutoUSD > 0 && totalBrutoBS > 0) {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#fff;margin:2px 0;">$' + totalBrutoUSD.toFixed(2) + ' USD</p>';
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#fbbf24;margin:2px 0;">$' + totalBrutoBS.toFixed(2) + ' en Bs</p>';
    } else if (totalBrutoBS > 0) {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#fbbf24;margin:2px 0;">$' + totalBrutoBS.toFixed(2) + ' en Bs</p>';
    } else {
      htmlModal += '<p style="font-size:15px;font-weight:900;color:#fff;margin:2px 0;">$' + totalBrutoUSD.toFixed(2) + ' USD</p>';
    }
    htmlModal += '</div></div>';

    // Tabla detallada
    htmlModal += '<div style="max-height:240px;overflow-y:auto;">';
    htmlModal += '<table style="width:100%;border-collapse:collapse;">';
    htmlModal += '<thead><tr style="background:#1e293b;color:#fff;font-size:8px;text-transform:uppercase;">';
    htmlModal += '<th style="padding:5px 6px;text-align:left;">Fecha</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:left;">Mascota</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;">Precio</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;">Peluquera</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;">Ayu1</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;color:#fed7aa;">Extra</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;">Avipet</th>';
    htmlModal += '<th style="padding:5px 6px;text-align:center;">Pago</th></tr></thead>';
    htmlModal += '<tbody>' + rows + '</tbody></table></div>';

    // Notas de deuda de empleados
    const hayDeudas = deudasEquipo.peluquera > 0 || deudasEquipo.ayu1 > 0 || deudasEquipo.ayuext > 0;
    if (hayDeudas) {
      htmlModal += '<div style="margin-top:10px;border-top:2px solid #fca5a5;padding-top:10px;">';
      htmlModal += '<p style="font-size:9px;font-weight:900;color:#dc2626;text-transform:uppercase;margin:0 0 6px 0;">Deudas pendientes del equipo</p>';

      var notasDeuda = [
        { pid:'peluquera', nombre:'Peluquera',          color:'#7c3aed', bg:'#faf5ff' },
        { pid:'ayu1',      nombre:'Ayudante Principal', color:'#2563eb', bg:'#eff6ff' },
        { pid:'ayuext',    nombre:'Ayudante Extra',     color:'#ea580c', bg:'#fff7ed' },
      ];

      notasDeuda.forEach(function(n) {
        if (deudasEquipo[n.pid] > 0) {
          htmlModal += '<div style="background:'+n.bg+';border:2px solid #fca5a5;border-radius:10px;padding:8px 12px;margin-bottom:6px;">';
          htmlModal += '<div style="display:flex;justify-content:space-between;align-items:center;">';
          htmlModal += '<p style="font-size:10px;font-weight:900;color:'+n.color+';margin:0;">'+n.nombre+'</p>';
          htmlModal += '<p style="font-size:14px;font-weight:900;color:#dc2626;margin:0;">Debe: $'+deudasEquipo[n.pid].toFixed(2)+'</p>';
          htmlModal += '</div>';
          if (detDeudas[n.pid].length > 0) {
            detDeudas[n.pid].forEach(function(d) {
              htmlModal += '<p style="font-size:9px;color:#64748b;margin:2px 0 0 0;">- '+d.desc+': $'+d.monto.toFixed(2)+'</p>';
            });
          }
          htmlModal += '</div>';
        }
      });
      htmlModal += '</div>';
    }

    Swal.fire({
      title: 'Resumen Semanal Peluqueria',
      width: 800,
      html: htmlModal,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#1d4ed8'
    });

  } catch(e) { console.error(e); alert('Error: '+e.message); }
};

// ─── CONTADOR DE MAQUINAS ─────────────────────────────────
async function _renderizarContadorMaquinas(consultas, fechas) {
  const listaDiv = document.getElementById('listaReporte');
  const netoDiv  = document.getElementById('repNeto');
  if (!listaDiv) return;
  const conteo = {};
  Object.keys(SERVICIOS_MAQUINA).forEach(s => { conteo[s] = { count: 0, total: 0, maquina: SERVICIOS_MAQUINA[s] }; });
  consultas.forEach(r => {
    const tratamiento = (r.tratamiento || '').toUpperCase();
    Object.keys(SERVICIOS_MAQUINA).forEach(serv => {
      if (tratamiento.includes(serv.split(' ')[0])) {
        conteo[serv].count++;
        conteo[serv].total += parseFloat(r.montoVenta || 0);
      }
    });
  });
  listaDiv.innerHTML = '';
  let totalServicios = 0;
  Object.entries(conteo).forEach(([servicio, data]) => {
    totalServicios += data.count;
    const colorBg     = data.count > 0 ? '#eff6ff' : '#f8fafc';
    const colorBorder = data.count > 0 ? '#bfdbfe' : '#e2e8f0';
    const colorText   = data.count > 0 ? '#1d4ed8' : '#94a3b8';
    const div = document.createElement('div');
    div.style.cssText = 'background:'+colorBg+';border:2px solid '+colorBorder+';border-radius:14px;padding:14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;';
    div.innerHTML =
      '<div>' +
        '<p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;">' + data.maquina + '</p>' +
        '<p style="font-size:13px;font-weight:900;color:#1e293b;">' + servicio + '</p>' +
      '</div>' +
      '<div style="text-align:right;">' +
        '<p style="font-size:28px;font-weight:900;color:'+colorText+';line-height:1;">' + data.count + '</p>' +
        '<p style="font-size:9px;color:#94a3b8;">servicio' + (data.count !== 1 ? 's' : '') + '</p>' +
      '</div>';
    listaDiv.appendChild(div);
  });
  const resumen = document.createElement('div');
  resumen.style.cssText = 'background:#1e293b;border-radius:14px;padding:14px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;';
  resumen.innerHTML =
    '<p style="font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;">Total servicios con maquina</p>' +
    '<p style="font-size:28px;font-weight:900;color:#60a5fa;">' + totalServicios + '</p>';
  listaDiv.appendChild(resumen);
  if (netoDiv) netoDiv.innerHTML = '';
}

console.log("finanzas.js v7 — desglose deuda en resumen semanal pelu");

// ─────────────────────────────────────────────────────────────────────────────
// MODULO DEUDAS / PRESTAMOS
// Coleccion Firebase: "deudas"
// Campos: persona, categoria, monto, descripcion, fecha, fechaSimple, estado
// ─────────────────────────────────────────────────────────────────────────────

// Personas predefinidas (quick-select)
const _PERSONAS_DEUDA = [
  { id:'darwin',   label:'Dr. Darwin',       color:'#2563eb', bg:'#eff6ff' },
  { id:'joan',     label:'Dr. Joan',          color:'#059669', bg:'#f0fdf4' },
  { id:'peluquera',label:'Peluquera',         color:'#7c3aed', bg:'#faf5ff' },
  { id:'ayu1',     label:'Ayudante Principal',color:'#0891b2', bg:'#ecfeff' },
  { id:'ayuext',   label:'Ayudante Extra',    color:'#ea580c', bg:'#fff7ed' },
  { id:'otro',     label:'Otra persona',      color:'#64748b', bg:'#f8fafc' },
];

window.abrirModuloDeudas = async () => {
  try {
    const snap = await getDocs(collection(db, "deudas"));
    const todas = [];
    snap.forEach(function(d){ todas.push({ id: d.id, ...d.data() }); });
    todas.sort(function(a,b){ return (b.fecha && a.fecha) ? (b.fecha.seconds||0)-(a.fecha.seconds||0) : 0; });

    // Calcular totales por estado
    let totalPendiente = 0, totalPagado = 0;
    todas.forEach(function(d){
      if (d.estado === 'pagado') totalPagado += parseFloat(d.monto||0);
      else totalPendiente += parseFloat(d.monto||0);
    });

    // Construir HTML de la lista
    let rowsHtml = '';
    if (todas.length === 0) {
      rowsHtml = '<p style="text-align:center;color:#94a3b8;font-size:11px;padding:20px;font-weight:700;">Sin deudas registradas</p>';
    } else {
      todas.forEach(function(d) {
        const monto = parseFloat(d.monto||0);
        const pagado = d.estado === 'pagado';
        const colorBg = pagado ? '#f0fdf4' : '#fef2f2';
        const colorBorder = pagado ? '#86efac' : '#fca5a5';
        const colorMonto = pagado ? '#16a34a' : '#dc2626';
        rowsHtml +=
          '<div style="background:' + colorBg + ';border:1px solid ' + colorBorder + ';border-radius:12px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">' +
            '<div>' +
              '<p style="font-size:11px;font-weight:900;color:#1e293b;margin:0;">' + (d.persona||'---') + '</p>' +
              '<p style="font-size:9px;color:#64748b;margin:2px 0;">' + (d.descripcion||'---') + '</p>' +
              '<p style="font-size:8px;color:#94a3b8;margin:0;">' + (d.fechaSimple||'') + '</p>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<p style="font-size:14px;font-weight:900;color:' + colorMonto + ';margin:0;">$' + monto.toFixed(2) + '</p>' +
              '<p style="font-size:8px;font-weight:900;color:' + colorMonto + ';margin:0;">' + (pagado ? 'PAGADA' : 'PENDIENTE') + '</p>' +
              (!pagado ?
                '<button onclick="window._marcarDeudaPagada(\'' + d.id + '\')" ' +
                  'style="margin-top:4px;background:#16a34a;color:#fff;border:none;border-radius:6px;padding:2px 8px;font-size:8px;font-weight:900;cursor:pointer;text-transform:uppercase;">' +
                  'Marcar pagada</button>' : '') +
            '</div>' +
          '</div>';
      });
    }

    const htmlModal =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div style="background:#fef2f2;border-radius:10px;padding:10px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#dc2626;text-transform:uppercase;margin:0;">Deuda pendiente</p>' +
          '<p style="font-size:20px;font-weight:900;color:#dc2626;margin:4px 0;">$' + totalPendiente.toFixed(2) + '</p>' +
        '</div>' +
        '<div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#16a34a;text-transform:uppercase;margin:0;">Ya pagado</p>' +
          '<p style="font-size:20px;font-weight:900;color:#16a34a;margin:4px 0;">$' + totalPagado.toFixed(2) + '</p>' +
        '</div>' +
      '</div>' +
      '<div style="max-height:320px;overflow-y:auto;">' + rowsHtml + '</div>';

    Swal.fire({
      title: 'Deudas y Prestamos',
      width: 600,
      html: htmlModal,
      showCancelButton: true,
      confirmButtonText: '+ Nueva Deuda',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#1d4ed8'
    }).then(function(res) {
      if (res.isConfirmed) window.registrarNuevaDeuda();
    });

  } catch(e) { console.error(e); alert('Error: ' + e.message); }
};

window._marcarDeudaPagada = async (idDeuda) => {
  try {
    await updateDoc(doc(db, "deudas", idDeuda), {
      estado: 'pagado',
      fechaPago: serverTimestamp()
    });
    Swal.fire({ icon:'success', title:'Marcada como pagada', timer:1500, showConfirmButton:false });
    setTimeout(function(){ window.abrirModuloDeudas(); }, 1600);
  } catch(e) { alert('Error: ' + e.message); }
};

window.registrarNuevaDeuda = async () => {
  // Paso 1: elegir persona
  let htmlPersonas = '<p style="font-size:11px;color:#64748b;margin-bottom:10px;">Quien debe?</p>';
  htmlPersonas += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
  _PERSONAS_DEUDA.forEach(function(p) {
    htmlPersonas +=
      '<button type="button" ' +
        'onclick="window._personaDeudaSeleccionada=\'' + p.id + '\';\'' + p.label + '\';window._personaDeudaLabel=\'' + p.label + '\';document.querySelectorAll(\'.btn-pers-deuda\').forEach(function(b){b.style.opacity=\'0.4\';});this.style.opacity=\'1\';this.style.fontWeight=\'900\';" ' +
        'class="btn-pers-deuda" ' +
        'style="background:' + p.bg + ';color:' + p.color + ';border:2px solid ' + p.color + ';border-radius:10px;padding:8px 4px;font-size:10px;font-weight:700;cursor:pointer;text-transform:uppercase;">' +
        p.label +
      '</button>';
  });
  htmlPersonas += '</div>';
  htmlPersonas += '<div id="inputOtroNombre" style="display:none;margin-top:8px;">' +
    '<input type="text" id="nombreOtroDeuda" placeholder="Nombre de la persona..." ' +
    'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:11px;font-weight:700;outline:none;box-sizing:border-box;">' +
  '</div>';

  const res1 = await Swal.fire({
    title: 'Nueva Deuda',
    html: htmlPersonas,
    showCancelButton: true,
    confirmButtonText: 'Siguiente',
    cancelButtonText: 'Cancelar',
    preConfirm: function() {
      const pid = window._personaDeudaSeleccionada;
      if (!pid) { Swal.showValidationMessage('Selecciona una persona'); return false; }
      if (pid === 'otro') {
        const nombre = document.getElementById('nombreOtroDeuda')?.value.trim();
        if (!nombre) { Swal.showValidationMessage('Escribe el nombre'); return false; }
        window._personaDeudaLabel = nombre;
      }
      return window._personaDeudaLabel || pid;
    },
    didOpen: function() {
      // Mostrar input de nombre cuando elige "otro"
      document.querySelectorAll('.btn-pers-deuda').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const pid2 = window._personaDeudaSeleccionada;
          const inp = document.getElementById('inputOtroNombre');
          if (inp) inp.style.display = pid2 === 'otro' ? 'block' : 'none';
        });
      });
    }
  });
  if (!res1.isConfirmed) return;
  const personaLabel = res1.value;

  // Paso 2: monto y descripcion
  const res2 = await Swal.fire({
    title: 'Deuda de: ' + personaLabel,
    html:
      '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">' +
        '<div>' +
          '<label style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Monto ($)</label>' +
          '<input type="number" id="montoDeuda" step="0.01" min="0" placeholder="0.00" ' +
            'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:10px;font-size:18px;font-weight:900;outline:none;box-sizing:border-box;margin-top:4px;color:#1e293b;">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Descripcion</label>' +
          '<input type="text" id="descDeuda" placeholder="Ej: Prestamo efectivo, avance salario..." ' +
            'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:11px;font-weight:700;outline:none;box-sizing:border-box;margin-top:4px;">' +
        '</div>' +
      '</div>',
    showCancelButton: true,
    confirmButtonText: 'Guardar Deuda',
    cancelButtonText: 'Atras',
    confirmButtonColor: '#dc2626',
    preConfirm: function() {
      const monto = parseFloat(document.getElementById('montoDeuda')?.value);
      if (!monto || monto <= 0) { Swal.showValidationMessage('Ingresa un monto valido'); return false; }
      return {
        monto: monto,
        descripcion: document.getElementById('descDeuda')?.value.trim() || ''
      };
    }
  });
  if (!res2.isConfirmed) return;

  const hoy = new Date();
  try {
    await addDoc(collection(db, "deudas"), {
      persona:      personaLabel,
      personaId:    window._personaDeudaSeleccionada || 'otro',
      monto:        res2.value.monto,
      descripcion:  res2.value.descripcion,
      estado:       'pendiente',
      fecha:        serverTimestamp(),
      fechaSimple:  hoy.getDate() + '/' + (hoy.getMonth()+1) + '/' + hoy.getFullYear()
    });
    window._personaDeudaSeleccionada = null;
    window._personaDeudaLabel = null;
    await Swal.fire({ icon:'success', title:'Deuda registrada', text: personaLabel + ': $' + res2.value.monto.toFixed(2), timer:2000, showConfirmButton:false });
    window.abrirModuloDeudas();
  } catch(e) { alert('Error guardando: ' + e.message); }
};

// modulo deudas incluido en finanzas.js
