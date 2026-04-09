// =========================================================
// AVIPET — main.js
// =========================================================

import { db } from '../firebase-config.js';
import {
  doc, getDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── ESTADO GLOBAL ───
window.doctorVerificado          = "";
window.MASTER_KEY_SISTEMA        = "AVIPET2026";
window.tasaDolarHoy              = 36;
window.vacunaPagadaAnteriormente = false;
window.porcGlobalCache           = undefined;
window._inventarioCache          = [];
window._buscadorResultados       = {};
window.doctorActivoId            = null;

const TABS_PROTEGIDAS = ['config_precios', 'reporte', 'inventario'];

// ─── NAVEGACIÓN ───
window.showTab = (tabId) => {
  if (TABS_PROTEGIDAS.includes(tabId) && !window.doctorVerificado) {
    window._tabPendiente = tabId;
    _abrirModalLogin();
    return;
  }
  window.ejecutarCambioDeTab(tabId);
};

window.ejecutarCambioDeTab = (tabId) => {
  document.querySelectorAll('[id^="section"]').forEach(s => s.classList.add('hidden'));
  const nombre  = tabId.charAt(0).toUpperCase() + tabId.slice(1);
  const seccion = document.getElementById('section' + nombre);
  if (seccion) seccion.classList.remove('hidden');

  document.querySelectorAll('[data-tab]').forEach(btn => {
    const activo = btn.dataset.tab === tabId;
    btn.classList.toggle('bg-blue-600',    activo);
    btn.classList.toggle('text-white',     activo);
    btn.classList.toggle('bg-slate-100',  !activo);
    btn.classList.toggle('text-slate-600',!activo);
  });

  if (tabId === 'reporte'    && typeof window.cargarReporte      === 'function') window.cargarReporte();
  if (tabId === 'peluqueria' && typeof window.cargarBitacoraHoy  === 'function') window.cargarBitacoraHoy();
  if (tabId === 'historia'   && typeof window.cargarListaEspera  === 'function') window.cargarListaEspera();
  if (tabId === 'inventario' && typeof window.cargarInventario   === 'function') window.cargarInventario();
  if (tabId === 'config_precios' && typeof window.cambiarSubTabConfig === 'function') window.cambiarSubTabConfig('servicios');
};

// ─── MODAL LOGIN ───
function _abrirModalLogin() {
  const modal = document.getElementById('modalLoginAcceso');
  if (!modal) return;
  modal.classList.remove('hidden');
  const inp = document.getElementById('modalPinInput');
  if (inp) { inp.value = ""; setTimeout(() => inp.focus(), 100); }
}

window.cerrarModalLogin = () => {
  document.getElementById('modalLoginAcceso')?.classList.add('hidden');
  window._tabPendiente = null;
};

window.validarAcceso = async () => {
  const pin = document.getElementById('modalPinInput')?.value.trim();
  if (!pin) return;

  let autenticado = false, nombreDoc = "";
  if (pin === window.MASTER_KEY_SISTEMA) { autenticado = true; nombreDoc = "Administrador"; }
  else {
    for (const nombre of ["Darwin Sandoval","Joan Silva"]) {
      if (typeof window.validarDoctorConMaster === 'function') {
        const ok = await window.validarDoctorConMaster(nombre, pin);
        if (ok) { autenticado = true; nombreDoc = nombre; break; }
      }
    }
  }

  if (autenticado) {
    window.doctorVerificado = nombreDoc;
    window.cerrarModalLogin();
    const tab = window._tabPendiente;
    if (tab) { window._tabPendiente = null; window.ejecutarCambioDeTab(tab); }
    window.registrarLogAuditoria("ACCESO", `${nombreDoc} accedió al sistema.`);
  } else {
    const inp = document.getElementById('modalPinInput');
    if (inp) { inp.style.borderColor = '#ef4444'; setTimeout(() => inp.style.borderColor = '', 1500); }
    alert("❌ PIN incorrecto.");
  }
};

window.recuperarPin = () => {
  alert("Para recuperar tu PIN, contacta al administrador del sistema AVIPET.\nSolo accesible con la Llave Maestra.");
};

// ─── AUDITORÍA ───
export const registrarLogAuditoria = async (accion, descripcion) => {
  try {
    await addDoc(collection(db, "auditoria_sistema"), {
      accion, descripcion,
      usuario:     window.doctorVerificado || "Sistema",
      fecha:       serverTimestamp(),
      fechaSimple: new Date().toLocaleDateString()
    });
  } catch (e) { console.warn("Error bitácora:", e); }
};
window.registrarLogAuditoria = registrarLogAuditoria;

// ─── TASA DEL DÓLAR ───
window.ajustarTasaDolar = async () => {
  try {
    const res  = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv");
    const json = await res.json();
    const tasa = parseFloat(json?.monitors?.usd?.price || json?.price) || 0;
    if (tasa > 10) {
      window.tasaDolarHoy = tasa;
      const el = document.getElementById('tasaDolarMostrar');
      if (el) el.innerText = `Bs ${tasa.toFixed(2)} / USD`;
      return tasa;
    }
  } catch { /* fallback */ }

  const manual = prompt("💵 Tasa BCV no disponible.\nIngresa la tasa actual (Bs por $1):");
  if (manual && !isNaN(parseFloat(manual)) && parseFloat(manual) > 1) {
    window.tasaDolarHoy = parseFloat(manual);
    const el = document.getElementById('tasaDolarMostrar');
    if (el) el.innerText = `Bs ${parseFloat(manual).toFixed(2)} / USD`;
    return parseFloat(manual);
  }
  return window.tasaDolarHoy;
};

window.guardarTasaManual = () => {
  const input = document.getElementById('tasaDolarManual');
  const tasa  = parseFloat(input?.value);
  if (!tasa || tasa < 1) { alert("⚠️ Ingresa una tasa válida."); return; }
  window.tasaDolarHoy = tasa;
  const el = document.getElementById('tasaDolarMostrar');
  if (el) el.innerText = `Bs ${tasa.toFixed(2)} / USD`;
  alert(`✅ Tasa: Bs ${tasa.toFixed(2)} / $1`);
  if (input) input.value = "";
};

// ─── RESPALDO LOCAL ───
export const respaldarProgresoLocal = () => {
  try {
    const leer = (id) => document.getElementById(id)?.value || "";
    const servicios = [];
    document.querySelectorAll('.servicio-principal').forEach(f => {
      servicios.push({
        nombre: f.querySelector('td')?.innerText || "",
        precio: f.getAttribute('data-precio') || 0,
        porc:   f.getAttribute('data-porc')   || 30,
        grupo:  f.getAttribute('data-grupo')  || ""
      });
    });
    localStorage.setItem('respaldo_historia_activa', JSON.stringify({
      cedula: leer('hCI'), propietario: leer('hProp'), paciente: leer('hNombre'),
      especie: leer('hEspecie'), raza: leer('hRaza'), edad: leer('hEdad'),
      sexo: leer('hSexo'), peso: leer('hPeso'), color: leer('hColor'),
      telefono: leer('hTlf'), correo: leer('hMail'), direccion: leer('hDir'),
      tratamiento: leer('hTratamiento'), servicios, timestamp: Date.now()
    }));
  } catch (e) { console.warn("Respaldo fallido:", e); }
};

window.restaurarRespaldoLocal = () => {
  try {
    const raw = localStorage.getItem('respaldo_historia_activa');
    if (!raw) { alert("Sin respaldo disponible."); return; }
    const d   = JSON.parse(raw);
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('hCI',d.cedula); set('hProp',d.propietario); set('hNombre',d.paciente);
    set('hEspecie',d.especie); set('hRaza',d.raza); set('hEdad',d.edad);
    set('hSexo',d.sexo); set('hPeso',d.peso); set('hColor',d.color);
    set('hTlf',d.telefono); set('hMail',d.correo); set('hDir',d.direccion);
    set('hTratamiento',d.tratamiento);
    const hace = Math.round((Date.now() - d.timestamp) / 60000);
    alert(`✅ Respaldo restaurado (hace ${hace} min).`);
  } catch { alert("❌ Error restaurando respaldo."); }
};

// ─── CALLBACK DOCTOR ───
window.onDoctorAutenticado = (doctorID) => {
  window.doctorActivoId = doctorID;
  const logo = document.getElementById('logoDarwinHeader');
  if (logo) logo.classList.toggle('hidden', doctorID !== 'DR_DARWIN');
};

// ─── HELPERS ───
window.convertirBs     = (m) => (parseFloat(m)||0) * window.tasaDolarHoy;
window.formatearMonto  = (m, moneda) => moneda === 'BS'
  ? `Bs ${((parseFloat(m)||0)*window.tasaDolarHoy).toFixed(2)}`
  : `$ ${(parseFloat(m)||0).toFixed(2)}`;

// ─── INICIALIZAR APP NORMAL ───
const _iniciarAppNormal = async () => {
  try { await window.ajustarTasaDolar(); } catch { /* silencioso */ }

  try {
    const snap = await getDoc(doc(db, "configuracion", "tarifas"));
    if (snap.exists()) window.porcGlobalCache = snap.data().porcentajeDoc ?? snap.data().porcDoc ?? null;
  } catch { /* silencioso */ }

  window.showTab('historia');

  try {
    const raw = localStorage.getItem('respaldo_historia_activa');
    if (raw) {
      const d = JSON.parse(raw);
      const hace = Math.round((Date.now() - d.timestamp) / 60000);
      if (hace < 120 && d.cedula) {
        const ok = confirm(`⚠️ RESPALDO ENCONTRADO\nPaciente: ${d.paciente||'---'} · CI: ${d.cedula}\nHace ${hace} min.\n\n¿Restaurar historia?`);
        if (ok) window.restaurarRespaldoLocal();
        else localStorage.removeItem('respaldo_historia_activa');
      }
    }
  } catch { /* silencioso */ }

  document.getElementById('modalPinInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.validarAcceso();
  });
};

// ─── DETECTOR DE MODOS URL ───
const _inicializarModo = () => {
  const params   = new URLSearchParams(window.location.search);
  const mode     = params.get('mode');
  const ci       = params.get('ci')       || "";
  const tipo     = params.get('tipo')     || "historia";
  const paciente = params.get('paciente') || "";
  const doctor   = params.get('doctor')   || "";

  if (mode === 'mobile') {
    if (typeof window.mostrarInterfazSoloCamara === 'function') {
      window.mostrarInterfazSoloCamara(ci, tipo);
    }
    return;
  }
  if (mode === 'encuesta') {
    if (typeof window.mostrarEncuesta === 'function') {
      window.mostrarEncuesta(ci, paciente, doctor);
    }
    return;
  }
  _iniciarAppNormal();
};

document.addEventListener('DOMContentLoaded', _inicializarModo);

console.log("✅ main.js cargado");
