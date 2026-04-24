// =========================================================
// AVIPET — almuerzo.js v1
// Control de tiempo de almuerzo por empleado
// Límite: 1 hora (60 min). Acumula excesos en Firebase.
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const LIMITE_MIN = 60; // minutos permitidos

// ─── RELOJ EN TIEMPO REAL ─────────────────────────────────
let _relojInterval = null;
let _contadorInterval = null;

function _iniciarReloj() {
  const el = document.getElementById('relojAlmuerzo');
  const elF = document.getElementById('fechaAlmuerzo');
  if (!el) return;
  if (_relojInterval) clearInterval(_relojInterval);
  _relojInterval = setInterval(() => {
    const ahora = new Date();
    el.textContent = ahora.toLocaleTimeString('es-VE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    if (elF) elF.textContent = ahora.toLocaleDateString('es-VE', { weekday:'long', day:'numeric', month:'long' });
    _actualizarContadoresVivos();
  }, 1000);
}

// ─── FORMATO DE TIEMPO ────────────────────────────────────
function _formatMin(totalMin) {
  const h = Math.floor(Math.abs(totalMin) / 60);
  const m = Math.abs(totalMin) % 60;
  return (h > 0 ? h + 'h ' : '') + m + 'min';
}

// ─── FECHA SIMPLE HOY ─────────────────────────────────────
function _fechaHoy() {
  const d = new Date();
  return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
}

// ─── REGISTRAR SALIDA ─────────────────────────────────────
window.registrarSalidaAlmuerzo = async () => {
  const empleado = document.getElementById('selectEmpleadoAlmuerzo')?.value;
  if (!empleado) { alert('⚠️ Selecciona un empleado.'); return; }

  try {
    // Verificar que no tenga salida activa sin regreso
    const snap = await getDocs(query(
      collection(db, 'control_almuerzo'),
      where('empleado', '==', empleado),
      where('fechaSimple', '==', _fechaHoy()),
      where('regreso', '==', null)
    ));
    if (!snap.empty) {
      alert('⚠️ ' + empleado + ' ya tiene una salida activa sin regreso registrado.');
      return;
    }

    await addDoc(collection(db, 'control_almuerzo'), {
      empleado,
      fechaSimple: _fechaHoy(),
      salida: serverTimestamp(),
      salidaLocal: new Date().toISOString(),
      regreso: null,
      regresoLocal: null,
      duracionMin: null,
      excedioMin: null,
      creadoEn: serverTimestamp()
    });

    await Swal.fire({
      icon: 'success',
      title: '🚪 Salida registrada',
      html: '<b>' + empleado + '</b><br><span style="font-size:11px;color:#64748b;">Límite: 1 hora</span>',
      timer: 2000,
      showConfirmButton: false
    });

    cargarHistorialAlmuerzo();
    cargarActivos();

  } catch(e) { console.error(e); alert('❌ Error: ' + e.message); }
};

// ─── REGISTRAR REGRESO ────────────────────────────────────
window.registrarRegresoAlmuerzo = async () => {
  const empleado = document.getElementById('selectEmpleadoAlmuerzo')?.value;
  if (!empleado) { alert('⚠️ Selecciona un empleado.'); return; }

  try {
    // Buscar salida activa
    const snap = await getDocs(query(
      collection(db, 'control_almuerzo'),
      where('empleado', '==', empleado),
      where('fechaSimple', '==', _fechaHoy()),
      where('regreso', '==', null)
    ));

    if (snap.empty) {
      alert('⚠️ No hay salida activa para ' + empleado + ' hoy.');
      return;
    }

    const docRef = snap.docs[0];
    const data   = docRef.data();
    const salida = new Date(data.salidaLocal);
    const ahora  = new Date();
    const durMin = Math.round((ahora - salida) / 60000);
    const excMin = Math.max(0, durMin - LIMITE_MIN);

    await updateDoc(doc(db, 'control_almuerzo', docRef.id), {
      regreso: serverTimestamp(),
      regresoLocal: ahora.toISOString(),
      duracionMin: durMin,
      excedioMin: excMin
    });

    const color  = excMin > 0 ? '#dc2626' : '#16a34a';
    const icono  = excMin > 0 ? '⚠️' : '✅';
    const msg    = excMin > 0
      ? 'Se excedió <b>' + _formatMin(excMin) + '</b> del límite'
      : 'Dentro del tiempo permitido';

    await Swal.fire({
      icon: excMin > 0 ? 'warning' : 'success',
      title: icono + ' Regreso registrado',
      html: '<b>' + empleado + '</b><br>' +
            '<span style="font-size:11px;color:#64748b;">Duración: ' + _formatMin(durMin) + '</span><br>' +
            '<span style="font-size:11px;color:' + color + ';font-weight:900;">' + msg + '</span>',
      timer: 3000,
      showConfirmButton: false
    });

    cargarHistorialAlmuerzo();
    cargarActivos();

  } catch(e) { console.error(e); alert('❌ Error: ' + e.message); }
};

// ─── CARGAR EMPLEADOS ACTIVOS (fuera ahora) ───────────────
async function cargarActivos() {
  const cont = document.getElementById('listaAlmuerzoActivo');
  if (!cont) return;

  try {
    const snap = await getDocs(query(
      collection(db, 'control_almuerzo'),
      where('fechaSimple', '==', _fechaHoy()),
      where('regreso', '==', null)
    ));

    if (snap.empty) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Nadie en almuerzo ahora</p>';
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const r = d.data();
      const salida = new Date(r.salidaLocal);
      const div = document.createElement('div');
      div.dataset.salida   = r.salidaLocal;
      div.dataset.empleado = r.empleado;
      div.dataset.id       = d.id;
      div.className = 'activo-almuerzo';
      div.style.cssText = 'background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;padding:10px;display:flex;align-items:center;justify-content:space-between;';

      div.innerHTML =
        '<div>' +
          '<p style="font-weight:900;font-size:11px;color:#92400e;">' + r.empleado + '</p>' +
          '<p style="font-size:9px;color:#78716c;">Salió: ' + salida.toLocaleTimeString('es-VE', {hour:'2-digit',minute:'2-digit'}) + '</p>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<p class="contador-vivo" style="font-weight:900;font-size:14px;color:#dc2626;">00:00</p>' +
          '<p style="font-size:8px;color:#78716c;">tiempo fuera</p>' +
        '</div>';

      cont.appendChild(div);
    });

  } catch(e) { console.error(e); }
}

// ─── ACTUALIZAR CONTADORES EN TIEMPO REAL ─────────────────
function _actualizarContadoresVivos() {
  const ahora = new Date();
  document.querySelectorAll('.activo-almuerzo').forEach(div => {
    const salida  = new Date(div.dataset.salida);
    const minutos = Math.floor((ahora - salida) / 60000);
    const segundos= Math.floor(((ahora - salida) % 60000) / 1000);
    const excede  = minutos >= LIMITE_MIN;
    const display = String(minutos).padStart(2,'0') + ':' + String(segundos).padStart(2,'0');
    const counter = div.querySelector('.contador-vivo');
    if (counter) {
      counter.textContent = display;
      counter.style.color = excede ? '#dc2626' : '#16a34a';
    }
    div.style.borderColor   = excede ? '#dc2626' : '#fbbf24';
    div.style.background    = excede ? '#fef2f2' : '#fef3c7';
  });
}

// ─── HISTORIAL DEL DÍA ────────────────────────────────────
window.cargarHistorialAlmuerzo = async () => {
  const cont = document.getElementById('historialAlmuerzo');
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;">Cargando...</p>';

  try {
    const snap = await getDocs(query(
      collection(db, 'control_almuerzo'),
      where('fechaSimple', '==', _fechaHoy())
    ));

    if (snap.empty) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin registros hoy</p>';
      _actualizarResumenExcesos([]);
      return;
    }

    const registros = [];
    snap.forEach(d => registros.push({ id: d.id, ...d.data() }));
    registros.sort((a,b) => new Date(a.salidaLocal) - new Date(b.salidaLocal));

    cont.innerHTML = '';
    registros.forEach(r => {
      const salida  = new Date(r.salidaLocal);
      const regreso = r.regresoLocal ? new Date(r.regresoLocal) : null;
      const excede  = r.excedioMin > 0;
      const activo  = !r.regresoLocal;

      const div = document.createElement('div');
      div.style.cssText = 'border-radius:10px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;' +
        (activo  ? 'background:#fef3c7;border:1px solid #fbbf24;' :
         excede  ? 'background:#fef2f2;border:1px solid #fca5a5;' :
                   'background:#f0fdf4;border:1px solid #86efac;');

      const estado = activo
        ? '<span style="font-size:9px;font-weight:900;color:#d97706;">EN ALMUERZO</span>'
        : excede
          ? '<span style="font-size:9px;font-weight:900;color:#dc2626;">+' + _formatMin(r.excedioMin) + ' EXCEDIDO</span>'
          : '<span style="font-size:9px;font-weight:900;color:#16a34a;">OK</span>';

      div.innerHTML =
        '<div>' +
          '<p style="font-weight:900;font-size:11px;color:#1e293b;">' + r.empleado + '</p>' +
          '<p style="font-size:9px;color:#64748b;">' +
            'Salida: ' + salida.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) +
            (regreso ? ' · Regreso: ' + regreso.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) : '') +
          '</p>' +
        '</div>' +
        '<div style="text-align:right;">' +
          (r.duracionMin !== null ? '<p style="font-size:11px;font-weight:900;color:#475569;">' + _formatMin(r.duracionMin) + '</p>' : '') +
          estado +
        '</div>';

      cont.appendChild(div);
    });

    _actualizarResumenExcesos(registros);

  } catch(e) {
    console.error(e);
    cont.innerHTML = '<p style="font-size:10px;color:#dc2626;text-align:center;">Error al cargar</p>';
  }
};

// ─── RESUMEN DE EXCESOS ACUMULADOS ────────────────────────
function _actualizarResumenExcesos(registros) {
  const cont = document.getElementById('resumenExcesos');
  if (!cont) return;

  // Agrupar excesos por empleado
  const excesos = {};
  registros.forEach(r => {
    if (r.excedioMin > 0) {
      if (!excesos[r.empleado]) excesos[r.empleado] = 0;
      excesos[r.empleado] += r.excedioMin;
    }
  });

  if (Object.keys(excesos).length === 0) {
    cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;">Sin excesos hoy ✅</p>';
    return;
  }

  cont.innerHTML = '';
  Object.entries(excesos).sort((a,b) => b[1]-a[1]).forEach(([nombre, min]) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fff;border-radius:10px;border:1px solid #fca5a5;margin-bottom:4px;';
    div.innerHTML =
      '<p style="font-weight:900;font-size:11px;color:#1e293b;">' + nombre + '</p>' +
      '<p style="font-weight:900;font-size:13px;color:#dc2626;">+' + _formatMin(min) + '</p>';
    cont.appendChild(div);
  });
}

// ─── INICIALIZAR ──────────────────────────────────────────
window.iniciarControlAlmuerzo = () => {
  _iniciarReloj();
  cargarActivos();
  cargarHistorialAlmuerzo();
};

console.log("✅ almuerzo.js v1 — control de tiempo de almuerzo");
