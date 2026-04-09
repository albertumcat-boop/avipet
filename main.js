// =========================================================
// AVIPET — main.js  v4  CORREGIDO
// FIXES:
//   • ajustarTasaDolar NO bloquea al inicio (sin prompt)
//   • ejecutarCambioDeTab usa mapa de IDs explícito
//   • Todo el init va dentro de DOMContentLoaded
//   • Manejo de errores robusto para no romper la app
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

// ─── MAPA DE IDs DE SECCIONES (evita errores de capitalización) ───
const SECTION_IDS = {
  'historia':      'sectionHistoria',
  'buscador':      'sectionBuscador',
  'peluqueria':    'sectionPeluqueria',
  'reporte':       'sectionReporte',
  'inventario':    'sectionInventario',
  'config_precios':'sectionConfig_precios',
  'espera':        'sectionEspera',
  'hojavacunas':   'sectionHojaVacunas',
};

// ─── NAVEGACIÓN ───
window.showTab = (tabId) => {
  if (!tabId) return;
  if (TABS_PROTEGIDAS.includes(tabId) && !window.doctorVerificado) {
    window._tabPendiente = tabId;
    _abrirModalLogin();
    return;
  }
  window.ejecutarCambioDeTab(tabId);
};

window.ejecutarCambioDeTab = (tabId) => {
  if (!tabId) return;

  // Ocultar todas las secciones navegables (NO la hoja de vacunas)
  Object.values(SECTION_IDS).forEach(id => {
    if (id === 'sectionHojaVacunas') return; // la maneja abrirHojaVacunas
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Mostrar la sección destino
  const sectionId = SECTION_IDS[tabId];
  if (sectionId) {
    const seccion = document.getElementById(sectionId);
    if (seccion) {
      seccion.classList.remove('hidden');
    } else {
      console.warn(`[AVIPET] Sección no encontrada: #${sectionId}`);
    }
  }

  // Actualizar estilos de botones de navegación
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const activo = btn.dataset.tab === tabId;
    if (activo) {
      btn.classList.add('bg-blue-600', 'text-white');
      btn.classList.remove('bg-slate-100', 'text-slate-600', 'text-gray-500');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-600');
    }
  });

  // Acciones post-navegación
  try {
    if (tabId === 'reporte'       && typeof window.cargarReporte      === 'function') window.cargarReporte();
    if (tabId === 'peluqueria'    && typeof window.cargarBitacoraHoy  === 'function') window.cargarBitacoraHoy();
    if (tabId === 'historia'      && typeof window.cargarListaEspera  === 'function') window.cargarListaEspera();
    if (tabId === 'inventario'    && typeof window.cargarInventario   === 'function') window.cargarInventario();
    if (tabId === 'config_precios'&& typeof window.cambiarSubTabConfig=== 'function') window.cambiarSubTabConfig('servicios');
  } catch (e) {
    console.warn('[AVIPET] Error en acción post-navegación:', e);
  }
};

// ─── MODAL LOGIN ───
function _abrirModalLogin() {
  const modal = document.getElementById('modalLoginAcceso');
  if (!modal) { console.warn('[AVIPET] Modal login no encontrado'); return; }
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

  if (pin === window.MASTER_KEY_SISTEMA) {
    autenticado = true;
    nombreDoc   = "Administrador";
  } else {
    for (const nombre of ["Darwin Sandoval", "Joan Silva"]) {
      try {
        if (typeof window.validarDoctorConMaster === 'function') {
          const ok = await window.validarDoctorConMaster(nombre, pin);
          if (ok) { autenticado = true; nombreDoc = nombre; break; }
        }
      } catch (e) { console.warn('[AVIPET] Error validando:', e); }
    }
  }

  if (autenticado) {
    window.doctorVerificado = nombreDoc;
    window.cerrarModalLogin();
    if (typeof window._actualizarBadgeSesion === 'function') window._actualizarBadgeSesion();
    const tab = window._tabPendiente;
    if (tab) { window._tabPendiente = null; window.ejecutarCambioDeTab(tab); }
    try { window.registrarLogAuditoria("ACCESO", `${nombreDoc} accedió al sistema.`); } catch {}
  } else {
    const inp = document.getElementById('modalPinInput');
    if (inp) {
      inp.style.borderColor = '#ef4444';
      inp.classList.add('shake');
      setTimeout(() => { inp.style.borderColor = ''; inp.classList.remove('shake'); }, 1500);
    }
    alert("❌ PIN incorrecto.");
  }
};

window.recuperarPin = () => {
  alert("Para recuperar tu PIN, contacta al administrador.\nLlave Maestra: Solo el administrador la conoce.");
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

// ─── TASA DEL DÓLAR (NO BLOQUEA al inicio) ───
window.ajustarTasaDolar = async (silencioso = false) => {
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
  } catch { /* sin conexión, usar tasa por defecto */ }

  // Si es llamado manualmente (no al inicio), pedir manual
  if (!silencioso) {
    const manual = prompt("💵 Tasa BCV no disponible.\nIngresa la tasa actual (Bs por $1):");
    if (manual && !isNaN(parseFloat(manual)) && parseFloat(manual) > 1) {
      window.tasaDolarHoy = parseFloat(manual);
      const el = document.getElementById('tasaDolarMostrar');
      if (el) el.innerText = `Bs ${parseFloat(manual).toFixed(2)} / USD`;
      return parseFloat(manual);
    }
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
    set('hCI', d.cedula); set('hProp', d.propietario); set('hNombre', d.paciente);
    set('hEspecie', d.especie); set('hRaza', d.raza); set('hEdad', d.edad);
    set('hSexo', d.sexo); set('hPeso', d.peso); set('hColor', d.color);
    set('hTlf', d.telefono); set('hMail', d.correo); set('hDir', d.direccion);
    set('hTratamiento', d.tratamiento);
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
window.convertirBs    = (m) => (parseFloat(m) || 0) * window.tasaDolarHoy;
window.formatearMonto = (m, moneda) => moneda === 'BS'
  ? `Bs ${((parseFloat(m) || 0) * window.tasaDolarHoy).toFixed(2)}`
  : `$ ${(parseFloat(m) || 0).toFixed(2)}`;

// ─── INICIAR APP ───
const _iniciarAppNormal = async () => {
  // 1. Tasa del dólar en SILENCIO (sin prompt bloqueante al abrir)
  try { await window.ajustarTasaDolar(true); } catch { /* silencioso */ }

  // 2. Config de porcentaje global
  try {
    const snap = await getDoc(doc(db, "configuracion", "tarifas"));
    if (snap.exists()) {
      window.porcGlobalCache = snap.data().porcentajeDoc ?? snap.data().porcDoc ?? null;
    }
  } catch { /* silencioso */ }

  // 3. Mostrar tab inicial (pequeño delay para que todos los módulos carguen)
  setTimeout(() => window.ejecutarCambioDeTab('historia'), 300);

  // 4. Verificar respaldo local (solo si hay datos recientes)
  try {
    const raw = localStorage.getItem('respaldo_historia_activa');
    if (raw) {
      const d = JSON.parse(raw);
      const hace = Math.round((Date.now() - d.timestamp) / 60000);
      if (hace < 120 && d.cedula) {
        const ok = confirm(
          `⚠️ RESPALDO ENCONTRADO\n\nPaciente: ${d.paciente || '---'} · CI: ${d.cedula}\nGuardado hace ${hace} minuto(s).\n\n¿Restaurar la historia en progreso?`
        );
        if (ok) window.restaurarRespaldoLocal();
        else localStorage.removeItem('respaldo_historia_activa');
      }
    }
  } catch { /* silencioso */ }

  // 5. Enter en modal
  document.getElementById('modalPinInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.validarAcceso();
  });

  // 6. Actualizar badge de sesión inicial
  try {
    if (typeof window._actualizarBadgeSesion === 'function') window._actualizarBadgeSesion();
  } catch {}
};

// ─── DETECTOR DE MODOS URL ───
const _inicializarModo = () => {
  try {
    const params   = new URLSearchParams(window.location.search);
    const mode     = params.get('mode');
    const ci       = params.get('ci')       || "";
    const tipo     = params.get('tipo')     || "historia";
    const paciente = params.get('paciente') || "";
    const doctor   = params.get('doctor')   || "";

    if (mode === 'mobile') {
      // Esperar a que historia.js cargue
      setTimeout(() => {
        if (typeof window.mostrarInterfazSoloCamara === 'function') {
          window.mostrarInterfazSoloCamara(ci, tipo);
        }
      }, 500);
      return;
    }

    if (mode === 'encuesta') {
      setTimeout(() => {
        if (typeof window.mostrarEncuesta === 'function') {
          window.mostrarEncuesta(ci, paciente, doctor);
        }
      }, 500);
      return;
    }

    _iniciarAppNormal();

  } catch (e) {
    console.error('[AVIPET] Error al inicializar:', e);
    // Intentar iniciar de todas formas
    _iniciarAppNormal();
  }
};

document.addEventListener('DOMContentLoaded', _inicializarModo);

console.log("✅ main.js v4 cargado");
