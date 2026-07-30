// =========================================================
// AVIPET — almuerzo.js v3
// Control de descansos integrado en Peluquería
// Límite: 60 min + 10 min tolerancia = 70 min total
// Empleados dinámicos desde Firebase
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const LIMITE_MIN     = 60; // minutos permitidos
const TOLERANCIA_MIN = 10; // minutos de tolerancia
const LIMITE_TOTAL   = LIMITE_MIN + TOLERANCIA_MIN; // 70 min antes de marcar exceso

// ─── CAMBIAR TAB PELUQUERÍA ───────────────────────────────
window.cambiarTabPeluqueria = (tab) => {
  const panelServ = document.getElementById('panelPeluServicio');
  const panelDesc = document.getElementById('panelPeluDescanso');
  const btnServ   = document.getElementById('btnPeluTab_servicio');
  const btnDesc   = document.getElementById('btnPeluTab_descanso');
  const activo    = 'text-[10px] px-4 py-2 font-black uppercase rounded-t-lg bg-blue-600 text-white border-b-2 border-blue-600';
  const inactivo  = 'text-[10px] px-4 py-2 font-black uppercase rounded-t-lg bg-slate-100 text-slate-500 hover:bg-slate-200';

  if (tab === 'servicio') {
    panelServ?.classList.remove('hidden');
    panelDesc?.classList.add('hidden');
    if (btnServ) btnServ.className = activo;
    if (btnDesc) btnDesc.className = inactivo;
  } else {
    panelServ?.classList.add('hidden');
    panelDesc?.classList.remove('hidden');
    if (btnDesc) btnDesc.className = activo;
    if (btnServ) btnServ.className = inactivo;
    _iniciarReloj();
    cargarEmpleadosSelector();
    cargarActivosDescanso();
    cargarHistorialDescanso();
  }
};

// ─── RELOJ + CONTADORES EN VIVO ──────────────────────────
let _relojInt = null;

function _iniciarReloj() {
  if (_relojInt) return;
  _relojInt = setInterval(_actualizarContadores, 1000);
}

function _actualizarContadores() {
  const ahora = new Date();
  document.querySelectorAll('.activo-descanso').forEach(div => {
    const salida  = new Date(div.dataset.salida);
    const seg     = Math.floor((ahora - salida) / 1000);
    const min     = Math.floor(seg / 60);
    const s       = seg % 60;
    const display = String(min).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    const counter = div.querySelector('.contador-desc');
    const barra   = div.querySelector('.barra-progreso');
    if (!counter) return;

    counter.textContent = display;

    // Colores según zona
    if (min < LIMITE_MIN) {
      // Verde — dentro del tiempo
      counter.style.color  = '#16a34a';
      div.style.borderColor = '#fbbf24';
      div.style.background  = '#fef3c7';
    } else if (min < LIMITE_TOTAL) {
      // Naranja — en tolerancia
      counter.style.color   = '#d97706';
      div.style.borderColor = '#f59e0b';
      div.style.background  = '#fffbeb';
    } else {
      // Rojo — excedido
      counter.style.color   = '#dc2626';
      div.style.borderColor = '#dc2626';
      div.style.background  = '#fef2f2';
    }

    // Barra de progreso
    if (barra) {
      const pct = Math.min(100, (min / LIMITE_TOTAL) * 100);
      barra.style.width = pct + '%';
      barra.style.background = min < LIMITE_MIN ? '#16a34a' : min < LIMITE_TOTAL ? '#f59e0b' : '#dc2626';
    }
  });
}

// ─── UTILIDADES ──────────────────────────────────────────
function _hoy() {
  const d = new Date();
  return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
}

function _fmt(min) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return (h > 0 ? h + 'h ' : '') + m + 'min';
}

// ─── EMPLEADOS DESDE FIREBASE ────────────────────────────
async function cargarEmpleadosSelector() {
  const sel = document.getElementById('selectEmpleadoDescanso');
  if (!sel) return;

  try {
    const snap = await getDocs(collection(db, 'empleados_descanso'));
    const empleados = [];
    snap.forEach(d => empleados.push({ id: d.id, ...d.data() }));
    empleados.sort((a,b) => a.nombre.localeCompare(b.nombre));

    sel.innerHTML = '<option value="">-- Empleado --</option>';
    empleados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.nombre;
      opt.textContent = e.nombre;
      sel.appendChild(opt);
    });

    // Renderizar lista de empleados en el panel de gestión
    _renderizarListaEmpleados(empleados);

  } catch(err) {
    console.warn('Error cargando empleados:', err);
  }
}

function _renderizarListaEmpleados(empleados) {
  const cont = document.getElementById('listaEmpleadosDescanso');
  if (!cont) return;

  if (empleados.length === 0) {
    cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin empleados. Agrega uno.</p>';
    return;
  }

  cont.innerHTML = '';
  empleados.forEach(e => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:4px;';
    div.innerHTML =
      '<p style="font-weight:700;font-size:11px;color:#1e293b;">' + e.nombre + '</p>' +
      '<button style="font-size:10px;color:#dc2626;font-weight:900;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:2px 8px;cursor:pointer;" ' +
        'data-id="' + e.id + '" data-nombre="' + e.nombre + '">🗑</button>';
    div.querySelector('button').addEventListener('click', function() {
      eliminarEmpleado(this.dataset.id, this.dataset.nombre);
    });
    cont.appendChild(div);
  });
}

// ─── AGREGAR EMPLEADO ────────────────────────────────────
window.agregarEmpleadoDescanso = async () => {
  const inp = document.getElementById('inputNuevoEmpleado');
  const nombre = inp?.value.trim();
  if (!nombre) { alert('Escribe el nombre del empleado.'); return; }

  try {
    // Verificar si ya existe
    const snap = await getDocs(query(collection(db,'empleados_descanso'), where('nombre','==',nombre)));
    if (!snap.empty) { alert('⚠️ Ese empleado ya existe.'); return; }

    await addDoc(collection(db, 'empleados_descanso'), {
      nombre,
      creadoEn: serverTimestamp()
    });

    if (inp) inp.value = '';
    await cargarEmpleadosSelector();

    Swal.fire({ icon:'success', title:'✅ Empleado agregado', text: nombre, timer:1500, showConfirmButton:false });
  } catch(e) { alert('❌ ' + e.message); }
};

// ─── ELIMINAR EMPLEADO ───────────────────────────────────
async function eliminarEmpleado(id, nombre) {
  const res = await Swal.fire({
    title: '🗑 Eliminar empleado',
    html: '<p style="font-size:11px;">¿Eliminar a <b>' + nombre + '</b> de la lista?</p>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626'
  });
  if (!res.isConfirmed) return;
  try {
    await deleteDoc(doc(db, 'empleados_descanso', id));
    await cargarEmpleadosSelector();
    Swal.fire({ icon:'success', title:'✅ Eliminado', timer:1200, showConfirmButton:false });
  } catch(e) { alert('❌ ' + e.message); }
}

// ─── REGISTRAR SALIDA ────────────────────────────────────
window.registrarSalidaDescanso = async () => {
  const emp = document.getElementById('selectEmpleadoDescanso')?.value;
  if (!emp) { alert('Selecciona un empleado.'); return; }

  try {
    const snap = await getDocs(query(
      collection(db, 'control_descanso'),
      where('empleado','==',emp),
      where('fechaSimple','==',_hoy()),
      where('regreso','==',null)
    ));
    if (!snap.empty) { alert('⚠️ ' + emp + ' ya tiene una salida activa.'); return; }

    await addDoc(collection(db, 'control_descanso'), {
      empleado:    emp,
      fechaSimple: _hoy(),
      salida:      serverTimestamp(),
      salidaLocal: new Date().toISOString(),
      regreso:     null,
      regresoLocal:null,
      duracionMin: null,
      excedioMin:  null
    });

    await Swal.fire({
      icon:'success', title:'🚪 Salida registrada',
      html:'<b>'+emp+'</b><br><span style="font-size:11px;color:#64748b;">Límite: '+LIMITE_MIN+' min + '+TOLERANCIA_MIN+' min tolerancia</span>',
      timer:2000, showConfirmButton:false
    });

    cargarActivosDescanso();
    cargarHistorialDescanso();
  } catch(e) { alert('❌ ' + e.message); }
};

// ─── REGISTRAR REGRESO ───────────────────────────────────
window.registrarRegresoDescanso = async () => {
  const emp = document.getElementById('selectEmpleadoDescanso')?.value;
  if (!emp) { alert('Selecciona un empleado.'); return; }

  try {
    const snap = await getDocs(query(
      collection(db,'control_descanso'),
      where('empleado','==',emp),
      where('fechaSimple','==',_hoy()),
      where('regreso','==',null)
    ));
    if (snap.empty) { alert('⚠️ No hay salida activa para ' + emp + '.'); return; }

    const ref    = snap.docs[0];
    const salida = new Date(ref.data().salidaLocal);
    const ahora  = new Date();
    const durMin = Math.round((ahora - salida) / 60000);
    // Exceso se cuenta solo después de la tolerancia
    const excMin = Math.max(0, durMin - LIMITE_TOTAL);

    await updateDoc(doc(db,'control_descanso',ref.id), {
      regreso:     serverTimestamp(),
      regresoLocal:ahora.toISOString(),
      duracionMin: durMin,
      excedioMin:  excMin
    });

    const color = excMin > 0 ? '#dc2626' : durMin > LIMITE_MIN ? '#d97706' : '#16a34a';
    const msg   = excMin > 0
      ? 'Excedió <b>+' + _fmt(excMin) + '</b> (fuera de tolerancia)'
      : durMin > LIMITE_MIN
        ? 'Dentro de la tolerancia permitida'
        : 'Dentro del tiempo ✅';

    await Swal.fire({
      icon: excMin > 0 ? 'warning' : 'success',
      title: '✅ Regreso: ' + emp,
      html: 'Duración: <b>' + _fmt(durMin) + '</b><br>' +
            '<span style="color:' + color + ';font-weight:900;">' + msg + '</span>',
      timer:3000, showConfirmButton:false
    });

    cargarActivosDescanso();
    cargarHistorialDescanso();
  } catch(e) { alert('❌ ' + e.message); }
};

// ─── CARGAR ACTIVOS ──────────────────────────────────────
async function cargarActivosDescanso() {
  const cont = document.getElementById('listaDescansoActivo');
  if (!cont) return;
  try {
    const snap = await getDocs(query(
      collection(db,'control_descanso'),
      where('fechaSimple','==',_hoy()),
      where('regreso','==',null)
    ));
    if (snap.empty) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Nadie fuera ahora</p>';
      return;
    }
    cont.innerHTML = '';
    snap.forEach(d => {
      const r = d.data();
      const salida = new Date(r.salidaLocal);
      const div = document.createElement('div');
      div.dataset.salida = r.salidaLocal;
      div.className = 'activo-descanso';
      div.style.cssText = 'background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;padding:10px 14px;margin-bottom:6px;transition:all .3s;';
      div.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<p style="font-weight:900;font-size:12px;color:#92400e;">' + r.empleado + '</p>' +
            '<p style="font-size:9px;color:#78716c;">Salió: ' + salida.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) +
              ' · Límite: ' + LIMITE_MIN + 'min + ' + TOLERANCIA_MIN + 'min tolerancia</p>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<p class="contador-desc" style="font-weight:900;font-size:20px;font-variant-numeric:tabular-nums;">00:00</p>' +
            '<p style="font-size:8px;color:#78716c;">tiempo fuera</p>' +
          '</div>' +
        '</div>' +
        '<div style="background:#e2e8f0;border-radius:999px;height:4px;margin-top:8px;overflow:hidden;">' +
          '<div class="barra-progreso" style="height:100%;width:0%;background:#16a34a;border-radius:999px;transition:width .5s,background .5s;"></div>' +
        '</div>';
      cont.appendChild(div);
    });
  } catch(e) { console.error(e); }
}

// ─── HISTORIAL ───────────────────────────────────────────
window.cargarHistorialDescanso = async () => {
  const cont    = document.getElementById('historialDescanso');
  const excCont = document.getElementById('resumenExcesosDescanso');
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;">Cargando...</p>';
  try {
    const snap = await getDocs(query(
      collection(db,'control_descanso'),
      where('fechaSimple','==',_hoy())
    ));
    if (snap.empty) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin registros hoy</p>';
      if (excCont) excCont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin excesos hoy ✅</p>';
      return;
    }
    const regs = [];
    snap.forEach(d => regs.push({ id:d.id, ...d.data() }));
    regs.sort((a,b) => new Date(a.salidaLocal) - new Date(b.salidaLocal));

    cont.innerHTML = '';
    const excesos = {};

    regs.forEach(r => {
      const salida  = new Date(r.salidaLocal);
      const regreso = r.regresoLocal ? new Date(r.regresoLocal) : null;
      const activo  = !r.regresoLocal;
      const enTol   = r.duracionMin > LIMITE_MIN && r.excedioMin === 0;
      const excede  = r.excedioMin > 0;

      if (excede) excesos[r.empleado] = (excesos[r.empleado]||0) + r.excedioMin;

      const bg = activo ? '#fef3c7;border:1px solid #fbbf24;'
               : excede ? '#fef2f2;border:1px solid #fca5a5;'
               : enTol  ? '#fffbeb;border:1px solid #fde68a;'
                        : '#f0fdf4;border:1px solid #86efac;';

      const tag = activo ? '<span style="font-size:9px;font-weight:900;color:#d97706;">FUERA</span>'
                : excede ? '<span style="font-size:9px;font-weight:900;color:#dc2626;">+'+_fmt(r.excedioMin)+' EXCEDIDO</span>'
                : enTol  ? '<span style="font-size:9px;font-weight:900;color:#d97706;">EN TOLERANCIA</span>'
                         : '<span style="font-size:9px;font-weight:900;color:#16a34a;">✅ OK</span>';

      const div = document.createElement('div');
      div.style.cssText = 'border-radius:10px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;background:' + bg;
      div.innerHTML =
        '<div>' +
          '<p style="font-weight:900;font-size:11px;">' + r.empleado + '</p>' +
          '<p style="font-size:9px;color:#64748b;">' +
            salida.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) +
            (regreso ? ' → ' + regreso.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) : ' → ...') +
          '</p>' +
        '</div>' +
        '<div style="text-align:right;">' +
          (r.duracionMin !== null ? '<p style="font-size:11px;font-weight:900;color:#475569;">' + _fmt(r.duracionMin) + '</p>' : '') +
          tag +
        '</div>';
      cont.appendChild(div);
    });

    // Excesos
    if (excCont) {
      if (Object.keys(excesos).length === 0) {
        excCont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin excesos hoy ✅</p>';
      } else {
        excCont.innerHTML = '';
        Object.entries(excesos).sort((a,b)=>b[1]-a[1]).forEach(([nombre,min]) => {
          const d = document.createElement('div');
          d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fff;border-radius:10px;border:1px solid #fca5a5;margin-bottom:4px;';
          d.innerHTML =
            '<p style="font-weight:900;font-size:11px;">' + nombre + '</p>' +
            '<p style="font-weight:900;font-size:13px;color:#dc2626;">+' + _fmt(min) + '</p>';
          excCont.appendChild(d);
        });
      }
    }
  } catch(e) {
    cont.innerHTML = '<p style="font-size:10px;color:#dc2626;text-align:center;">Error</p>';
  }
};

// ─── TAB ALMUERZO ─────────────────────────────────────────
let _tabAlmuerzoActiva = 'descanso';

window.cambiarTabAlmuerzo = (tab) => {
  _tabAlmuerzoActiva = tab;
  const panelD = document.getElementById('panelAlmuerzoDescanso');
  const panelP = document.getElementById('panelAlmuerzoPlan');
  const btnD   = document.getElementById('tabAlmuerzoDescanso');
  const btnP   = document.getElementById('tabAlmuerzoPlan');

  panelD?.classList.toggle('hidden', tab !== 'descanso');
  panelP?.classList.toggle('hidden', tab !== 'planificador');

  if (btnD) { btnD.className = 'flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase ' + (tab === 'descanso' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-500'); }
  if (btnP) { btnP.className = 'flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase ' + (tab === 'planificador' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500'); }

  if (tab === 'descanso') {
    _iniciarReloj();
    cargarEmpleadosSelector();
    cargarActivosDescanso();
    cargarHistorialDescanso();
  } else {
    _iniciarPlanificador();
  }
};

// ─── PLANIFICADOR SEMANAL ─────────────────────────────────
const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
let _semanaOffset = 0; // 0 = semana actual, 1 = próxima, etc.

function _getLunesDeSemana(offset) {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0=dom, 1=lun...
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes + (offset * 7));
  lunes.setHours(0,0,0,0);
  return lunes;
}

function _fmtFecha(d) {
  return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
}

function _semanaKey(lunes) {
  return lunes.getFullYear() + '-' + String(lunes.getMonth()+1).padStart(2,'0') + '-' + String(lunes.getDate()).padStart(2,'0');
}

function _iniciarPlanificador() {
  _renderEncabezadoSemana();
  _cargarPlanEmpleados();
}

function _renderEncabezadoSemana() {
  const lunes = _getLunesDeSemana(_semanaOffset);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const label = document.getElementById('labelSemanaPlan');
  const rango  = document.getElementById('labelRangoSemana');
  if (label) label.textContent = _semanaOffset === 0 ? '📅 Semana actual' : _semanaOffset === 1 ? '📅 Próxima semana' : '📅 Semana +' + _semanaOffset;
  if (rango) rango.textContent = lunes.getDate() + ' ' + meses[lunes.getMonth()] + ' → ' + domingo.getDate() + ' ' + meses[domingo.getMonth()] + ' ' + domingo.getFullYear();
}

window.navegarSemanaPlan = (dir) => {
  if (_semanaOffset + dir < 0) return; // no ir al pasado
  _semanaOffset += dir;
  _renderEncabezadoSemana();
  _cargarPlanEmpleados();
};

async function _cargarPlanEmpleados() {
  const cont = document.getElementById('listaPlanificador');
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:24px;">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db, 'empleados_descanso'));
    const empleados = [];
    snap.forEach(d => empleados.push({ id: d.id, ...d.data() }));
    empleados.sort((a,b) => a.nombre.localeCompare(b.nombre));

    if (!empleados.length) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:24px;">Sin empleados registrados.<br>Agrégalos en la pestaña Almuerzo.</p>';
      return;
    }

    const lunes = _getLunesDeSemana(_semanaOffset);
    const semKey = _semanaKey(lunes);
    cont.innerHTML = '';

    for (const emp of empleados) {
      const docId = emp.nombre.replace(/\s+/g,'_') + '_' + semKey;
      let tareas = {};
      try {
        const snap = await getDoc(doc(db, 'planificador_tareas', docId));
        if (snap.exists()) tareas = snap.data().tareas || {};
      } catch(_) {}
      cont.appendChild(_renderTarjetaPlan(emp, semKey, lunes, tareas, docId));
    }
  } catch(e) {
    cont.innerHTML = '<p style="font-size:10px;color:#dc2626;text-align:center;padding:16px;">Error: ' + e.message + '</p>';
  }
}

function _renderTarjetaPlan(emp, semKey, lunes, tareas, docId) {
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border:1px solid #e0e7ff;border-radius:16px;overflow:hidden;';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'background:linear-gradient(to right,#4f46e5,#6366f1);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;';
  hdr.innerHTML = '<p style="font-weight:900;color:#fff;font-size:13px;">👤 ' + emp.nombre + '</p>' +
    '<div style="display:flex;gap:6px;">' +
    '<button onclick="window.guardarPlanEmpleado(\'' + docId + '\',\'' + emp.nombre + '\',\'' + semKey + '\')" style="background:#818cf8;color:#fff;border:none;padding:4px 10px;border-radius:8px;font-weight:900;font-size:9px;cursor:pointer;text-transform:uppercase;">💾 Guardar</button>' +
    '<button onclick="window.enviarPlanWhatsApp(\'' + emp.nombre + '\',\'' + semKey + '\')" style="background:#22c55e;color:#fff;border:none;padding:4px 10px;border-radius:8px;font-weight:900;font-size:9px;cursor:pointer;text-transform:uppercase;">📲 WhatsApp</button>' +
    '</div>';
  card.appendChild(hdr);

  const body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;';

  DIAS.forEach((dia, i) => {
    const fechaDia = new Date(lunes);
    fechaDia.setDate(lunes.getDate() + i);
    const fechaStr = _fmtFecha(fechaDia);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    row.innerHTML =
      '<span style="font-size:9px;font-weight:900;color:#6366f1;text-transform:uppercase;width:32px;flex-shrink:0;">' + DIAS_LABEL[i] + '</span>' +
      '<span style="font-size:8px;color:#94a3b8;width:36px;flex-shrink:0;">' + fechaDia.getDate() + '/' + (fechaDia.getMonth()+1) + '</span>' +
      '<input type="text" id="plan_' + docId + '_' + dia + '" placeholder="Sin tarea asignada..." value="' + (tareas[dia] || '') + '" ' +
        'style="flex:1;border:1px solid #e0e7ff;border-radius:8px;padding:5px 8px;font-size:10px;outline:none;font-family:inherit;" ' +
        'onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e0e7ff\'">';
    body.appendChild(row);
  });

  card.appendChild(body);
  return card;
}

window.guardarPlanEmpleado = async (docId, nombre, semKey) => {
  const tareas = {};
  DIAS.forEach(dia => {
    const inp = document.getElementById('plan_' + docId + '_' + dia);
    tareas[dia] = inp?.value.trim() || '';
  });
  try {
    await setDoc(doc(db, 'planificador_tareas', docId), {
      empleado: nombre,
      semanaInicio: semKey,
      tareas,
      actualizadoEn: serverTimestamp()
    });
    Swal.fire({ icon:'success', title:'✅ Guardado', text: nombre, timer:1500, showConfirmButton:false });
  } catch(e) {
    Swal.fire({ icon:'error', title:'Error', text: e.message });
  }
};

window.enviarPlanWhatsApp = async (nombre, semKey) => {
  // Cargar datos guardados
  const docId = nombre.replace(/\s+/g,'_') + '_' + semKey;
  let tareas = {};
  try {
    const snap = await getDoc(doc(db, 'planificador_tareas', docId));
    if (snap.exists()) tareas = snap.data().tareas || {};
  } catch(_) {}

  // Cargar teléfono del empleado
  let telefono = '';
  try {
    const snapEmp = await getDocs(collection(db,'empleados_descanso'));
    snapEmp.forEach(d => { if (d.data().nombre === nombre) telefono = d.data().telefono || ''; });
  } catch(_) {}

  // Construir fechas de la semana
  const lunes = new Date(semKey + 'T00:00:00');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);

  // Verificar si hay alguna tarea
  const hayTareas = DIAS.some(d => tareas[d]?.trim());
  if (!hayTareas) {
    Swal.fire({ icon:'warning', title:'Sin tareas', text:'Agrega al menos una tarea antes de enviar.', confirmButtonColor:'#6366f1' });
    return;
  }

  // Construir mensaje y links de calendario
  let msg = '📅 Hola ' + nombre.split(' ')[0] + ', aquí están tus actividades para la semana del ' +
    lunes.getDate() + ' al ' + domingo.getDate() + ' de ' + meses[domingo.getMonth()] + ':\n\n';

  const calLinks = [];

  DIAS.forEach((dia, i) => {
    const tarea = tareas[dia]?.trim();
    if (!tarea) return;
    const fechaDia = new Date(lunes);
    fechaDia.setDate(lunes.getDate() + i);
    const dd = String(fechaDia.getDate()).padStart(2,'0');
    const mm = String(fechaDia.getMonth()+1).padStart(2,'0');
    const yyyy = fechaDia.getFullYear();
    // Siguiente día para evento de todo el día
    const sig = new Date(fechaDia); sig.setDate(sig.getDate()+1);
    const ddS = String(sig.getDate()).padStart(2,'0');
    const mmS = String(sig.getMonth()+1).padStart(2,'0');

    msg += '• ' + DIAS_LABEL[i] + ' ' + dd + '/' + mm + ': ' + tarea + '\n';

    const calUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(tarea + ' — AVIPET') +
      '&dates=' + yyyy+mm+dd + '/' + yyyy+mmS+ddS +
      '&details=' + encodeURIComponent('Tarea asignada por AVIPET');
    calLinks.push('📌 ' + DIAS_LABEL[i] + ': ' + calUrl);
  });

  msg += '\n🗓️ Guarda tus actividades en tu calendario:\n' + calLinks.join('\n');
  msg += '\n\n✂️ AVIPET — Av. Fco. de Miranda, Sector Buena Vista, Petare.';

  // Enviar por WhatsApp
  const telLimpio = telefono.replace(/\D/g,'');
  const waUrl = 'https://wa.me/' + (telLimpio || '') + '?text=' + encodeURIComponent(msg);

  if (!telLimpio) {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Sin número registrado',
      html: '<p style="font-size:11px;">El empleado <b>' + nombre + '</b> no tiene número de WhatsApp guardado.<br>Ve a Ajustes → Empleados para agregarlo.<br><br>¿Quieres copiar el mensaje de todas formas?</p>',
      showCancelButton: true,
      confirmButtonText: 'Copiar mensaje',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6366f1'
    });
    if (isConfirmed) {
      try { await navigator.clipboard.writeText(msg); } catch(_) {}
      Swal.fire({ icon:'success', title:'Mensaje copiado', timer:1500, showConfirmButton:false });
    }
    return;
  }

  window.open(waUrl, '_blank');
};

// ─── EMPLEADOS — TELÉFONOS (para Ajustes) ────────────────
window.cargarEmpleadosTelefono = async () => {
  const cont = document.getElementById('listaEmpleadosTelefono');
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:16px;">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db,'empleados_descanso'));
    const empleados = [];
    snap.forEach(d => empleados.push({ id: d.id, ...d.data() }));
    empleados.sort((a,b) => a.nombre.localeCompare(b.nombre));

    if (!empleados.length) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:16px;">Sin empleados. Agrégalos desde el módulo de Almuerzo.</p>';
      return;
    }

    cont.innerHTML = '';
    empleados.forEach(emp => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px;';
      row.innerHTML =
        '<p style="font-weight:900;font-size:11px;color:#1e293b;flex:1;">' + emp.nombre + '</p>' +
        '<input type="tel" id="tel_emp_' + emp.id + '" placeholder="584121234567" value="' + (emp.telefono||'') + '" ' +
          'style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:10px;width:140px;outline:none;" ' +
          'onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
        '<button onclick="window.guardarTelefonoEmpleado(\'' + emp.id + '\',\'' + emp.nombre + '\')" ' +
          'style="background:#6366f1;color:#fff;border:none;padding:4px 10px;border-radius:8px;font-weight:900;font-size:9px;cursor:pointer;text-transform:uppercase;">Guardar</button>';
      cont.appendChild(row);
    });
  } catch(e) {
    cont.innerHTML = '<p style="font-size:10px;color:#dc2626;text-align:center;">Error: ' + e.message + '</p>';
  }
};

window.guardarTelefonoEmpleado = async (id, nombre) => {
  const inp = document.getElementById('tel_emp_' + id);
  const tel = inp?.value.trim().replace(/\D/g,'');
  if (!tel) { Swal.fire({ icon:'warning', title:'Número vacío', text:'Escribe el número con código de país. Ej: 584121234567', confirmButtonColor:'#6366f1' }); return; }
  try {
    await updateDoc(doc(db,'empleados_descanso',id), { telefono: tel });
    Swal.fire({ icon:'success', title:'✅ Guardado', text: nombre, timer:1500, showConfirmButton:false });
  } catch(e) {
    Swal.fire({ icon:'error', title:'Error', text: e.message });
  }
};

// Cargar descanso al entrar al módulo desde showTab
const _origShowTabAlmuerzo = window.showTab;
window._initAlmuerzoModule = () => {
  _iniciarReloj();
  cargarEmpleadosSelector();
  cargarActivosDescanso();
  cargarHistorialDescanso();
};

console.log("✅ almuerzo.js v4 — descansos + planificador semanal + teléfonos empleados");
