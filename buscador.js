// =========================================================
// AVIPET — buscador.js v5
// Muestra Servicios Realizados e Insumos Utilizados separados
// Busqueda por cedula (normalizada) y por nombre de mascota
// =========================================================

import { db } from './firebase-config.js';
import {
 collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const normalizarCedula = (ci) =>
 String(ci || '').replace(/[.\-\s]/g, '').trim().toUpperCase();

// ESTADO DE PAGINACION 
let _todosLosRegistros = [];
let _pagActual = 0;
const _POR_PAGINA = 20;

// BUSCAR POR CEDULA O NOMBRE 
window.buscarPorCedula = async () => {
 const ci = document.getElementById('buscadorCI')?.value.trim() || '';
 const nombre = document.getElementById('buscadorNombre')?.value.trim().toUpperCase() || '';
 const doctor = document.getElementById('buscadorDoctor')?.value || '';
 const periodo = document.getElementById('buscadorPeriodo')?.value || 'hoy';
 const fechaDesde = document.getElementById('buscadorFechaDesde')?.value || '';
 const fechaHasta = document.getElementById('buscadorFechaHasta')?.value || '';
 const cont = document.getElementById('resultadoBusqueda');
 if (!cont) return;

 cont.innerHTML = '<p class="text-center text-blue-500 text-[9px] font-black uppercase italic animate-pulse py-8">Buscando...</p>';

 try {
 let registros = [];

 if (ci) {
 // Busqueda especifica por cedula
 const ciNorm = normalizarCedula(ci);
 const snap1 = await getDocs(query(collection(db,"consultas"), where("cedula","==",ciNorm), orderBy("fecha","desc")));
 snap1.forEach(d => registros.push({ id:d.id, ...d.data() }));
 if (registros.length === 0 && ciNorm !== ci.trim()) {
 const snap2 = await getDocs(query(collection(db,"consultas"), where("cedula","==",ci.trim()), orderBy("fecha","desc")));
 snap2.forEach(d => registros.push({ id:d.id, ...d.data() }));
 }
 } else {
 // Busqueda general con filtros
 const snap = await getDocs(query(collection(db,"consultas"), orderBy("fecha","desc")));
 snap.forEach(d => registros.push({ id:d.id, ...d.data() }));

 // Filtro por nombre de mascota
 if (nombre) {
 registros = registros.filter(r => (r.paciente||'').toUpperCase().includes(nombre));
 }
 }

 // Filtro por doctor
 if (doctor) {
 registros = registros.filter(r => (r.doctorNombre||r.doctor||'').includes(doctor));
 }

 // Filtro por fecha
 if (!ci) {
 const hoy = new Date();
 const fmt = (d) => d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();

 if (periodo === 'hoy') {
 const fechaHoyStr = fmt(hoy);
 registros = registros.filter(r => r.fechaSimple === fechaHoyStr);
 } else if (periodo === 'semana') {
 const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
 registros = registros.filter(r => {
 if (!r.fechaSimple) return false;
 const p = r.fechaSimple.split('/');
 if (p.length !== 3) return false;
 const fd = new Date(p[2], p[1]-1, p[0]);
 return fd >= hace7 && fd <= hoy;
 });
 } else if (periodo === 'mes') {
 registros = registros.filter(r => {
 if (!r.fechaSimple) return false;
 const p = r.fechaSimple.split('/');
 return p.length === 3 && parseInt(p[1]) === hoy.getMonth()+1 && parseInt(p[2]) === hoy.getFullYear();
 });
 } else if (periodo === 'rango' && fechaDesde && fechaHasta) {
 const desde = new Date(fechaDesde);
 const hasta = new Date(fechaHasta);
 registros = registros.filter(r => {
 if (!r.fechaSimple) return false;
 const p = r.fechaSimple.split('/');
 if (p.length !== 3) return false;
 const fd = new Date(p[2], p[1]-1, p[0]);
 return fd >= desde && fd <= hasta;
 });
 }
 }

 if (!registros.length) {
 cont.innerHTML = '<p class="text-center text-slate-400 text-[9px] font-black uppercase italic py-8">Sin resultados para los filtros seleccionados.</p>';
 return;
 }

 // Guardar todos y mostrar primera pagina
 _todosLosRegistros = registros;
 _pagActual = 0;
 _mostrarPagina(cont);

 } catch(e) {
 console.error(e);
 cont.innerHTML = '<p class="text-center text-red-500 text-[9px] font-black uppercase italic py-4">Error: ' + e.message + '</p>';
 }
};

// MOSTRAR PAGINA DE RESULTADOS 
function _mostrarPagina(cont) {
 const inicio = _pagActual * _POR_PAGINA;
 const fin = inicio + _POR_PAGINA;
 const pagina = _todosLosRegistros.slice(inicio, fin);
 const total = _todosLosRegistros.length;

 if (_pagActual === 0) cont.innerHTML = '';

 // Contador de resultados
 if (_pagActual === 0) {
 const resumen = document.createElement('div');
 resumen.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;';
 resumen.innerHTML =
 '<p style="font-size:10px;font-weight:900;color:#64748b;">' + total + ' consultas encontradas</p>' +
 '<p style="font-size:9px;color:#94a3b8;">Mostrando ' + Math.min(_POR_PAGINA, total) + ' de ' + total + '</p>';
 cont.appendChild(resumen);
 }

 pagina.forEach(consulta => cont.appendChild(_renderizarTarjeta(consulta)));

 // Boton ver mas
 const btnVerMas = document.getElementById('btnVerMasBuscador');
 if (btnVerMas) btnVerMas.remove();

 if (fin < total) {
 const btn = document.createElement('button');
 btn.id = 'btnVerMasBuscador';
 btn.style.cssText = 'width:100%;padding:12px;border-radius:12px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:11px;color:#1d4ed8;cursor:pointer;margin-top:8px;';
 btn.textContent = 'Ver mas (' + (total - fin) + ' restantes)';
 btn.addEventListener('click', function() {
 _pagActual++;
 _mostrarPagina(cont);
 });
 cont.appendChild(btn);
 }
}

// RENDERIZAR TARJETA DE CONSULTA 
function _renderizarTarjeta(consulta) {
 const fecha = consulta.fechaSimple || consulta.fecha?.toDate?.().toLocaleDateString() || '---';
 const venta = parseFloat(consulta.montoVenta || 0).toFixed(2);
 const gastos = parseFloat(consulta.montoInsumos || 0).toFixed(2);
 const doctor = consulta.doctorNombre || consulta.doctor || '---';

 const card = document.createElement('div');
 card.className = 'bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-3';

 // HEADER 
 const header = document.createElement('div');
 header.className = 'bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex justify-between items-center';
 header.innerHTML =
 '<div>' +
 '<p class="font-black text-white uppercase text-[12px] leading-none">' + (consulta.paciente || '---') + '</p>' +
 '<p class="text-blue-200 text-[9px] font-bold mt-0.5">' + (consulta.especie || '') + (consulta.raza ? ' · ' + consulta.raza : '') + '</p>' +
 '</div>' +
 '<div class="text-right">' +
 '<p class="text-white font-black text-[11px]">' + fecha + '</p>' +
 '<p class="text-blue-200 text-[9px]">' + (consulta.propietario || '---') + '</p>' +
 '</div>';
 card.appendChild(header);

 // CUERPO 
 const body = document.createElement('div');
 body.className = 'p-3 space-y-2';

 // DATOS DEL DUENIO Y MASCOTA 
 const infoDiv = document.createElement('div');
 infoDiv.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';

 // Datos duenio
 const duenioDiv = document.createElement('div');
 duenioDiv.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;';
 duenioDiv.innerHTML =
 '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Propietario</p>' +
 '<p style="font-size:11px;font-weight:900;color:#1e293b;">' + (consulta.propietario || '---') + '</p>' +
 '<p style="font-size:9px;color:#64748b;">CI: <b>' + (consulta.cedula || '---') + '</b></p>' +
 '<p style="font-size:9px;color:#64748b;">Tel: <b>' + (consulta.telefono || '---') + '</b></p>' +
 (consulta.correo ? '<p style="font-size:9px;color:#64748b;">' + consulta.correo + '</p>' : '') +
 (consulta.direccion ? '<p style="font-size:9px;color:#64748b;">' + consulta.direccion + '</p>' : '');
 infoDiv.appendChild(duenioDiv);

 // Datos mascota
 const mascotaDiv = document.createElement('div');
 mascotaDiv.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px;';
 mascotaDiv.innerHTML =
 '<p style="font-size:8px;font-weight:900;color:#1d4ed8;text-transform:uppercase;margin-bottom:4px;">Paciente</p>' +
 '<p style="font-size:11px;font-weight:900;color:#1e293b;text-transform:uppercase;">' + (consulta.paciente || '---') + '</p>' +
 '<p style="font-size:9px;color:#64748b;">' + (consulta.especie || '') + (consulta.raza ? ' · ' + consulta.raza : '') + '</p>' +
 (consulta.edad ? '<p style="font-size:9px;color:#64748b;">Edad: <b>' + consulta.edad + '</b></p>' : '') +
 (consulta.peso ? '<p style="font-size:9px;color:#64748b;">Peso: <b>' + consulta.peso + ' kg</b></p>' : '') +
 (consulta.sexo ? '<p style="font-size:9px;color:#64748b;">Sexo: <b>' + consulta.sexo + '</b></p>' : '') +
 (consulta.color ? '<p style="font-size:9px;color:#64748b;">Color: <b>' + consulta.color + '</b></p>' : '');
 infoDiv.appendChild(mascotaDiv);

 body.appendChild(infoDiv);

 // Datos clinicos
 if (consulta.tratamiento) {
 const diagDiv = document.createElement('div');
 diagDiv.className = 'bg-slate-50 rounded-xl p-2 border border-slate-100';
 diagDiv.innerHTML =
 '<p class="text-[8px] font-black text-slate-400 uppercase mb-1">Diagnostico / Tratamiento</p>' +
 '<p class="text-[10px] text-slate-700 font-bold leading-snug">' + consulta.tratamiento + '</p>';
 body.appendChild(diagDiv);
 }

 // SERVICIOS REALIZADOS (azul) 
 if (Array.isArray(consulta.serviciosRealizados) && consulta.serviciosRealizados.length > 0) {
 const servDiv = document.createElement('div');
 servDiv.style.cssText = 'border:1px solid #bfdbfe;border-radius:10px;overflow:hidden;margin-top:6px;';
 let htmlServ = '<div style="background:#eff6ff;padding:4px 10px;"><p style="font-size:9px;font-weight:900;color:#1d4ed8;text-transform:uppercase;">Servicios Realizados</p></div>';
 htmlServ += '<table style="width:100%;border-collapse:collapse;">';
 consulta.serviciosRealizados.forEach(function(s) {
 htmlServ +=
 '<tr style="border-bottom:1px solid #f1f5f9;">' +
 '<td style="padding:4px 8px;font-size:11px;font-weight:700;color:#1e293b;">' + (s.nombre || '').replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\s]+/u, '').trim() + '</td>' +
 '<td style="padding:4px 8px;text-align:right;font-size:11px;font-weight:900;color:#2563eb;">$' + parseFloat(s.precio || 0).toFixed(2) + '</td>' +
 '</tr>';
 });
 htmlServ += '</table>';
 servDiv.innerHTML = htmlServ;
 body.appendChild(servDiv);
 }

 // INSUMOS UTILIZADOS (gris) 
 if (Array.isArray(consulta.listaDetalladaInsumos) && consulta.listaDetalladaInsumos.length > 0) {
 const insDiv = document.createElement('div');
 insDiv.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-top:6px;';
 let htmlIns = '<div style="background:#f8fafc;padding:4px 10px;"><p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;">Insumos Utilizados</p></div>';
 htmlIns += '<table style="width:100%;border-collapse:collapse;">';
 htmlIns += '<thead><tr style="background:#f8fafc;"><th style="padding:2px 8px;text-align:left;font-size:8px;color:#94a3b8;">Insumo</th><th style="padding:2px 8px;text-align:center;font-size:8px;color:#94a3b8;">Cant</th><th style="padding:2px 8px;text-align:right;font-size:8px;color:#94a3b8;">Costo</th></tr></thead>';
 consulta.listaDetalladaInsumos.forEach(function(ins) {
 htmlIns +=
 '<tr style="border-bottom:1px solid #f8fafc;">' +
 '<td style="padding:3px 8px;font-size:10px;">' + (ins.nombre || '') + '</td>' +
 '<td style="padding:3px 8px;text-align:center;font-size:10px;">' + (ins.cant || 1) + '</td>' +
 '<td style="padding:3px 8px;text-align:right;font-size:10px;">$' + parseFloat(ins.costo || 0).toFixed(2) + '</td>' +
 '</tr>';
 });
 htmlIns += '</table>';
 insDiv.innerHTML = htmlIns;
 body.appendChild(insDiv);
 }

 // FINANZAS 
 const finDiv = document.createElement('div');
 finDiv.className = 'grid grid-cols-3 gap-2 mt-2';
 finDiv.innerHTML =
 '<div class="bg-blue-50 rounded-lg p-2 text-center">' +
 '<p class="text-[7px] font-black text-blue-400 uppercase">Cobrado</p>' +
 '<p class="text-[13px] font-black text-blue-700 font-mono">$' + venta + '</p>' +
 '</div>' +
 '<div class="bg-amber-50 rounded-lg p-2 text-center">' +
 '<p class="text-[7px] font-black text-amber-500 uppercase">Insumos</p>' +
 '<p class="text-[13px] font-black text-amber-700 font-mono">$' + gastos + '</p>' +
 '</div>' +
 '<div class="bg-slate-50 rounded-lg p-2 text-center">' +
 '<p class="text-[7px] font-black text-slate-400 uppercase">Doctor</p>' +
 '<p class="text-[10px] font-black text-slate-600 leading-tight">' + doctor + '</p>' +
 '</div>';
 body.appendChild(finDiv);

 // VACUNAS 
 if (Array.isArray(consulta.vacunasAplicadas) && consulta.vacunasAplicadas.length > 0) {
 const vacDiv = document.createElement('div');
 vacDiv.className = 'mt-2';
 let htmlVac = '<p class="text-[8px] font-black text-emerald-600 uppercase mb-1">Vacunas aplicadas</p>';
 htmlVac += '<div class="flex flex-wrap gap-1">';
 consulta.vacunasAplicadas.forEach(function(v) {
 htmlVac += '<span style="background:#d1fae5;color:#065f46;border-radius:999px;padding:2px 8px;font-size:8px;font-weight:700;">' + (v.vacuna || '') + '</span>';
 });
 htmlVac += '</div>';
 vacDiv.innerHTML = htmlVac;
 body.appendChild(vacDiv);
 }

 // BOTONES 
 const btnDiv = document.createElement('div');
 btnDiv.className = 'flex gap-2 mt-3';

 const btnEditar = document.createElement('button');
 btnEditar.className = 'flex-1 bg-blue-600 text-white py-2 rounded-xl font-black text-[9px] uppercase hover:bg-blue-700 transition-all';
 btnEditar.textContent = 'Editar Consulta';
 btnEditar.addEventListener('click', function() {
 if (typeof window.abrirConsultaParaEditar === 'function') {
 window.abrirConsultaParaEditar(consulta.id);
 } else {
 alert('Sistema cargando, intenta en un momento.');
 }
 });
 btnDiv.appendChild(btnEditar);

 const btnVacunas = document.createElement('button');
 btnVacunas.className = 'flex-1 bg-emerald-500 text-white py-2 rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 transition-all';
 btnVacunas.textContent = 'Ver Vacunas';
 btnVacunas.addEventListener('click', function() {
 if (typeof window.abrirHojaVacunasDesdeBuscador === 'function') {
 window.abrirHojaVacunasDesdeBuscador(consulta);
 } else {
 window.showTab('historia');
 setTimeout(() => window.autocompletarPorCedula(consulta.cedula), 500);
 }
 });
 btnDiv.appendChild(btnVacunas);

 // Botón eliminar historia
 const btnEliminar = document.createElement('button');
 btnEliminar.className = 'bg-red-100 text-red-600 px-3 py-2 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 hover:text-white transition-all';
 btnEliminar.textContent = 'Eliminar';
 btnEliminar.addEventListener('click', async function() {
   if (window._masterKeyReady) await window._masterKeyReady;
   const conf = await Swal.fire({
     icon: 'warning',
     title: 'Eliminar historia',
     html: '<p style="font-size:11px;">Vas a eliminar la consulta de <b>' + (consulta.paciente||'---') + '</b> del ' + (consulta.fechaSimple||'') + '.<br><br><span style="color:#dc2626;font-weight:900;">Esta accion no se puede deshacer.</span></p>',
     showCancelButton: true,
     confirmButtonText: 'Si, eliminar',
     cancelButtonText: 'Cancelar',
     confirmButtonColor: '#dc2626',
     input: 'password',
     inputPlaceholder: 'Clave maestra...',
     preConfirm: function(clave) {
       if (!clave || clave.trim() !== window.MASTER_KEY_SISTEMA) {
         Swal.showValidationMessage('Clave maestra incorrecta');
         return false;
       }
       return true;
     }
   });
   if (!conf.isConfirmed) return;
   try {
     await deleteDoc(doc(db, "consultas", consulta.id));
     await Swal.fire({ icon:'success', title:'Eliminado', timer:1500, showConfirmButton:false });
     // Remover la card del DOM
     card.remove();
   } catch(e) {
     Swal.fire({ icon:'error', title:'Error', text: e.message });
   }
 });
 btnDiv.appendChild(btnEliminar);

 body.appendChild(btnDiv);

 // Mostrar fotos si existen
 const fotos = consulta.fotosHistoria || (consulta.urlExamen ? [consulta.urlExamen] : []);
 if (fotos.length > 0) {
   const fotoDiv = document.createElement('div');
   fotoDiv.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;';
   fotos.forEach(function(url) {
     const img = document.createElement('img');
     img.src = url;
     img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #bfdbfe;cursor:pointer;';
     img.onclick = function() { Swal.fire({ imageUrl: url, imageAlt: 'Foto consulta', showConfirmButton:false, showCloseButton:true, width:400 }); };
     fotoDiv.appendChild(img);
   });
   body.appendChild(fotoDiv);
 }

 card.appendChild(body);
 return card;
}

// abrirConsultaParaEditar definida canónicamente en historia.js — no redefinir aquí

// TOGGLE RANGO DE FECHAS
window.toggleRangoBuscador = () => {
 const sel = document.getElementById('buscadorPeriodo')?.value;
 const rango = document.getElementById('rangoBuscador');
 if (rango) rango.classList.toggle('hidden', sel !== 'rango');
};

// ─── TAB BUSCADOR ─────────────────────────────────────────
let _tabBusc = 'historial';

window.cambiarTabBuscador = (tab) => {
  _tabBusc = tab;
  const tabH = document.getElementById('tabBuscHistorial');
  const tabT = document.getElementById('tabBuscTestVac');
  const filtroWrap = document.getElementById('filtroTipoDocWrap');
  const btn = document.getElementById('btnBuscarPrincipal');
  if (tabH) {
    tabH.classList.toggle('text-blue-600', tab === 'historial');
    tabH.classList.toggle('border-blue-600', tab === 'historial');
    tabH.classList.toggle('text-slate-400', tab !== 'historial');
    tabH.classList.toggle('border-transparent', tab !== 'historial');
  }
  if (tabT) {
    tabT.classList.toggle('text-purple-600', tab === 'testvac');
    tabT.classList.toggle('border-purple-600', tab === 'testvac');
    tabT.classList.toggle('text-slate-400', tab !== 'testvac');
    tabT.classList.toggle('border-transparent', tab !== 'testvac');
  }
  if (filtroWrap) filtroWrap.classList.toggle('hidden', tab !== 'testvac');
  if (btn) btn.style.background = tab === 'testvac' ? '#7c3aed' : '';
  document.getElementById('resultadoBusqueda').innerHTML = '';
};

window.buscarEnBuscador = () => {
  if (_tabBusc === 'testvac') {
    window.buscarTestsYVacunas();
  } else {
    window.buscarPorCedula();
  }
};

// ─── FILTRO FECHA (reutilizable) ──────────────────────────
function _filtrarPorFecha(registros) {
  const periodo = document.getElementById('buscadorPeriodo')?.value || 'hoy';
  const fechaDesde = document.getElementById('buscadorFechaDesde')?.value || '';
  const fechaHasta = document.getElementById('buscadorFechaHasta')?.value || '';
  const ci = document.getElementById('buscadorCI')?.value.trim() || '';
  if (ci) return registros; // con cédula no se filtra por fecha
  const hoy = new Date();
  const fmt = d => d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();
  if (periodo === 'hoy') {
    const s = fmt(hoy);
    return registros.filter(r => r.fechaSimple === s);
  } else if (periodo === 'semana') {
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate()-7);
    return registros.filter(r => { if (!r.fechaSimple) return false; const p=r.fechaSimple.split('/'); if(p.length!==3)return false; const fd=new Date(p[2],p[1]-1,p[0]); return fd>=hace7&&fd<=hoy; });
  } else if (periodo === 'mes') {
    return registros.filter(r => { if (!r.fechaSimple) return false; const p=r.fechaSimple.split('/'); return p.length===3&&parseInt(p[1])===hoy.getMonth()+1&&parseInt(p[2])===hoy.getFullYear(); });
  } else if (periodo === 'rango' && fechaDesde && fechaHasta) {
    const desde=new Date(fechaDesde); const hasta=new Date(fechaHasta);
    return registros.filter(r => { if (!r.fechaSimple) return false; const p=r.fechaSimple.split('/'); if(p.length!==3)return false; const fd=new Date(p[2],p[1]-1,p[0]); return fd>=desde&&fd<=hasta; });
  }
  return registros;
}

// ─── BUSCAR TESTS Y VACUNAS ───────────────────────────────
window.buscarTestsYVacunas = async () => {
  const ci = document.getElementById('buscadorCI')?.value.trim() || '';
  const nombre = document.getElementById('buscadorNombre')?.value.trim().toUpperCase() || '';
  const doctor = document.getElementById('buscadorDoctor')?.value || '';
  const tipoDoc = document.getElementById('filtroTipoDoc')?.value || 'ambos';
  const cont = document.getElementById('resultadoBusqueda');
  if (!cont) return;

  cont.innerHTML = '<p style="text-align:center;color:#7c3aed;font-size:9px;font-weight:900;text-transform:uppercase;font-style:italic;padding:32px 0;animation:pulse 1s infinite;">Buscando...</p>';

  try {
    let registros = [];
    if (ci) {
      const ciNorm = normalizarCedula(ci);
      const snap = await getDocs(query(collection(db,'consultas'), where('cedula','==',ciNorm), orderBy('fecha','desc')));
      snap.forEach(d => registros.push({ id:d.id, ...d.data() }));
      if (!registros.length && ciNorm !== ci.trim()) {
        const snap2 = await getDocs(query(collection(db,'consultas'), where('cedula','==',ci.trim()), orderBy('fecha','desc')));
        snap2.forEach(d => registros.push({ id:d.id, ...d.data() }));
      }
    } else {
      const snap = await getDocs(query(collection(db,'consultas'), orderBy('fecha','desc')));
      snap.forEach(d => registros.push({ id:d.id, ...d.data() }));
      if (nombre) registros = registros.filter(r => (r.paciente||'').toUpperCase().includes(nombre));
    }
    if (doctor) registros = registros.filter(r => (r.doctorNombre||r.doctor||'').includes(doctor));
    registros = _filtrarPorFecha(registros);

    // Filtrar por tipo
    if (tipoDoc === 'tests') {
      registros = registros.filter(r => Array.isArray(r.testsRealizados) && r.testsRealizados.length > 0);
    } else if (tipoDoc === 'vacunas') {
      registros = registros.filter(r =>
        (Array.isArray(r.vacunasAplicadas) && r.vacunasAplicadas.length > 0) ||
        (Array.isArray(r.desparasitacionesAplicadas) && r.desparasitacionesAplicadas.length > 0)
      );
    } else {
      registros = registros.filter(r =>
        (Array.isArray(r.testsRealizados) && r.testsRealizados.length > 0) ||
        (Array.isArray(r.vacunasAplicadas) && r.vacunasAplicadas.length > 0) ||
        (Array.isArray(r.desparasitacionesAplicadas) && r.desparasitacionesAplicadas.length > 0)
      );
    }

    if (!registros.length) {
      cont.innerHTML = '<p style="text-align:center;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase;font-style:italic;padding:32px 0;">Sin resultados.</p>';
      return;
    }

    cont.innerHTML = '';
    const resumen = document.createElement('div');
    resumen.style.cssText = 'background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;';
    resumen.innerHTML = '<p style="font-size:10px;font-weight:900;color:#5b21b6;">' + registros.length + ' registros encontrados</p>' +
      '<p style="font-size:9px;color:#7c3aed;">Tests & Vacunas</p>';
    cont.appendChild(resumen);
    registros.forEach(r => cont.appendChild(_renderizarTarjetaTV(r, tipoDoc)));

  } catch(e) {
    console.error(e);
    cont.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:9px;font-weight:900;padding:16px;">Error: ' + e.message + '</p>';
  }
};

// ─── TARJETA TESTS & VACUNAS ──────────────────────────────
function _renderizarTarjetaTV(c, tipoDoc) {
  const fecha = c.fechaSimple || c.fecha?.toDate?.().toLocaleDateString() || '---';
  const doctor = c.doctorNombre || c.doctor || '---';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border:1px solid #ede9fe;border-radius:16px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 4px rgba(124,58,237,0.07);';

  // Header morado
  const header = document.createElement('div');
  header.style.cssText = 'background:linear-gradient(to right,#7c3aed,#6d28d9);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;';
  header.innerHTML =
    '<div>' +
    '<p style="font-weight:900;color:#fff;text-transform:uppercase;font-size:12px;line-height:1;">' + (c.paciente||'---') + '</p>' +
    '<p style="color:#ddd6fe;font-size:9px;margin-top:2px;">' + (c.especie||'') + (c.raza?' · '+c.raza:'') + '</p>' +
    '</div>' +
    '<div style="text-align:right;">' +
    '<p style="color:#fff;font-weight:900;font-size:11px;">' + fecha + '</p>' +
    '<p style="color:#ddd6fe;font-size:9px;">CI: ' + (c.cedula||'---') + ' · ' + (c.propietario||'') + '</p>' +
    '</div>';
  card.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;';

  // Info compacta
  const info = document.createElement('div');
  info.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;font-size:9px;color:#64748b;flex-wrap:wrap;';
  info.innerHTML =
    (c.telefono ? '<span>📞 ' + c.telefono + '</span>' : '') +
    '<span>👨‍⚕️ ' + doctor + '</span>' +
    (c.peso ? '<span>⚖️ ' + c.peso + ' kg</span>' : '') +
    (c.edad ? '<span>🎂 ' + c.edad + '</span>' : '');
  body.appendChild(info);

  // Tests rápidos
  const tests = c.testsRealizados || [];
  if (tests.length > 0 && tipoDoc !== 'vacunas') {
    const sec = document.createElement('div');
    sec.style.cssText = 'border:1px solid #ede9fe;border-radius:10px;overflow:hidden;margin-bottom:8px;';
    let html = '<div style="background:#f5f3ff;padding:4px 10px;"><p style="font-size:9px;font-weight:900;color:#7c3aed;text-transform:uppercase;">🧪 Tests Rápidos</p></div>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="background:#faf5ff;"><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:left;">Prueba</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;width:100px;">Resultado</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:left;">Nota</th></tr></thead><tbody>';
    tests.forEach(t => {
      const color = (t.resultado||'').includes('POSITIVO') ? '#dc2626' : (t.resultado||'').includes('NEGATIVO') ? '#16a34a' : '#64748b';
      html += '<tr style="border-top:1px solid #f1f5f9;">' +
        '<td style="padding:4px 8px;font-size:10px;font-weight:700;">' + (t.nombre||'') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:11px;font-weight:900;color:' + color + ';">' + (t.resultado||'---') + '</td>' +
        '<td style="padding:4px 8px;font-size:9px;color:#64748b;font-style:italic;">' + (t.nota||'-') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    sec.innerHTML = html;
    body.appendChild(sec);
  }

  // Vacunas
  const vacunas = c.vacunasAplicadas || [];
  if (vacunas.length > 0 && tipoDoc !== 'tests') {
    const sec = document.createElement('div');
    sec.style.cssText = 'border:1px solid #d1fae5;border-radius:10px;overflow:hidden;margin-bottom:8px;';
    let html = '<div style="background:#f0fdf4;padding:4px 10px;"><p style="font-size:9px;font-weight:900;color:#065f46;text-transform:uppercase;">💉 Vacunas Aplicadas</p></div>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="background:#f0fdf4;"><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:left;">Vacuna</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Fecha</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Próxima</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Peso</th></tr></thead><tbody>';
    vacunas.forEach(v => {
      html += '<tr style="border-top:1px solid #f1f5f9;">' +
        '<td style="padding:4px 8px;font-size:10px;font-weight:700;">' + (v.vacuna||'') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;">' + (v.fecha||'---') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;color:#059669;font-weight:700;">' + (v.proxima||'---') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;">' + (v.peso||'---') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    sec.innerHTML = html;
    body.appendChild(sec);
  }

  // Desparasitaciones
  const desp = c.desparasitacionesAplicadas || [];
  if (desp.length > 0 && tipoDoc !== 'tests') {
    const sec = document.createElement('div');
    sec.style.cssText = 'border:1px solid #fef3c7;border-radius:10px;overflow:hidden;margin-bottom:8px;';
    let html = '<div style="background:#fffbeb;padding:4px 10px;"><p style="font-size:9px;font-weight:900;color:#92400e;text-transform:uppercase;">🐛 Desparasitaciones</p></div>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="background:#fffbeb;"><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:left;">Producto</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Fecha</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Próxima</th><th style="padding:3px 8px;font-size:8px;color:#94a3b8;text-align:center;">Peso</th></tr></thead><tbody>';
    desp.forEach(d => {
      html += '<tr style="border-top:1px solid #f1f5f9;">' +
        '<td style="padding:4px 8px;font-size:10px;font-weight:700;">' + (d.producto||'') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;">' + (d.fecha||'---') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;color:#d97706;font-weight:700;">' + (d.proxima||'---') + '</td>' +
        '<td style="padding:4px 8px;text-align:center;font-size:9px;">' + (d.peso||'---') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    sec.innerHTML = html;
    body.appendChild(sec);
  }

  card.appendChild(body);
  return card;
}

console.log(" buscador.js v5 — filtros, paginacion, servicios e insumos separados");
