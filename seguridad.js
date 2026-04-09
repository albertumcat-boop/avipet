// =========================================================
// AVIPET — seguridad.js  v3
// NUEVO: cerrarSesion(), botón de cierre de sesión
// =========================================================

import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── VALIDAR DOCTOR ───
window.validarDoctorConMaster = async (nombreDoc, pinIngresado) => {
  if (pinIngresado === window.MASTER_KEY_SISTEMA) return true;
  try {
    const snap = await getDoc(doc(db, "doctores", nombreDoc));
    if (snap.exists()) return pinIngresado === snap.data().pin;
    const backup = { "Darwin Sandoval": "1111", "Joan Silva": "2222" };
    return pinIngresado === backup[nombreDoc];
  } catch {
    const backup = { "Darwin Sandoval": "1111", "Joan Silva": "2222" };
    return pinIngresado === backup[nombreDoc];
  }
};

// ─── CAMBIAR PIN ───
window.cambiarPinDoctor = async (nombreDoc) => {
  if (!nombreDoc) return alert("Seleccione un doctor primero.");
  const pinActual = prompt(`🔐 [${nombreDoc}] Ingrese PIN actual o Llave Maestra:`);
  if (!pinActual) return;
  const esValido = await window.validarDoctorConMaster(nombreDoc, pinActual);
  if (esValido) {
    const nuevoPin = prompt("🆕 Nuevo PIN (mínimo 4 dígitos):");
    if (nuevoPin && nuevoPin.length >= 4) {
      await setDoc(doc(db, "doctores", nombreDoc), { pin: nuevoPin, ultimaActualizacion: serverTimestamp() }, { merge: true });
      alert("✅ PIN actualizado.");
    } else alert("⚠️ El PIN debe tener al menos 4 dígitos.");
  } else alert("🚫 Validación fallida.");
};

window.solicitarCambioPinDoctor = async () => {
  const nombreDoc = prompt("Ingrese su nombre (Darwin Sandoval / Joan Silva):");
  if (!nombreDoc) return;
  const claveAdmin = prompt("🔐 Ingrese la Llave Maestra:");
  if (!claveAdmin) return;
  if (claveAdmin === window.MASTER_KEY_SISTEMA) {
    const nuevoPin = prompt(`Nuevo PIN para ${nombreDoc} (mínimo 4 dígitos):`);
    if (nuevoPin && nuevoPin.length >= 4) {
      await setDoc(doc(db, "doctores", nombreDoc), { pin: nuevoPin }, { merge: true });
      alert(`✅ PIN de ${nombreDoc} actualizado.`);
    }
    return;
  }
  try {
    const snapSeg  = await getDoc(doc(db, "configuracion", "seguridad"));
    const pinAdmin = snapSeg.exists() ? (snapSeg.data().pin || "AVIPET2026") : "AVIPET2026";
    if (claveAdmin === pinAdmin) {
      const nuevoPin = prompt(`Nuevo PIN para ${nombreDoc} (mínimo 4 dígitos):`);
      if (nuevoPin && nuevoPin.length >= 4) {
        await setDoc(doc(db, "doctores", nombreDoc), { pin: nuevoPin }, { merge: true });
        alert(`✅ PIN de ${nombreDoc} actualizado.`);
      }
    } else alert("🚫 Clave incorrecta.");
  } catch (e) { console.error(e); alert("❌ Error al validar clave."); }
};

// ─── ACCESO DOCTOR (con logos) ───
window.validarAccesoDoctor = async (nombre) => {
  const logoD  = document.getElementById("logoDerechoVacuna");
  const spacer = document.getElementById("spacerDerechoVacuna");

  if (!nombre) {
    window.doctorVerificado = "";
    const dPrint = document.getElementById('doctorPrint');
    if (dPrint) dPrint.innerText = "SELECCIONE DOCTOR";
    if (logoD)  { logoD.src = ""; logoD.classList.add("hidden"); }
    if (spacer) spacer.classList.remove("hidden");
    window.doctorActivoId = null;
    _actualizarBadgeSesion();
    return;
  }

  const pinIngresado = prompt(`ACCESO RESTRINGIDO: PIN para ${nombre.toUpperCase()}:`);
  if (!pinIngresado) {
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = "";
    return;
  }

  const esValido = await window.validarDoctorConMaster(nombre, pinIngresado);

  if (esValido) {
    window.doctorVerificado = nombre;
    const dPrint = document.getElementById('doctorPrint');
    if (dPrint) dPrint.innerText = "DR. " + nombre.toUpperCase();

    if (nombre === "Darwin Sandoval") {
      const urlDarwin = "https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg";
      if (logoD)  { logoD.src = urlDarwin; logoD.classList.remove("hidden"); }
      if (spacer) spacer.classList.add("hidden");
      window.onDoctorAutenticado("DR_DARWIN");
    } else {
      if (logoD)  { logoD.src = ""; logoD.classList.add("hidden"); }
      if (spacer) spacer.classList.remove("hidden");
      window.onDoctorAutenticado(nombre === "Joan Silva" ? "DR_JOAN" : null);
    }

    _actualizarBadgeSesion();
    if (typeof window.registrarLogAuditoria === 'function')
      await window.registrarLogAuditoria("ACCESO", `${nombre} inició sesión.`);
    alert(`✅ Bienvenido, DR. ${nombre}`);
    if (typeof window.calcularTodo === 'function') await window.calcularTodo();
  } else {
    alert("❌ PIN INCORRECTO.");
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = "";
    if (logoD)  { logoD.src = ""; logoD.classList.add("hidden"); }
    if (spacer) spacer.classList.remove("hidden");
  }
};

// ─── CERRAR SESIÓN ───
window.cerrarSesion = async () => {
  if (!window.doctorVerificado) { alert("No hay sesión activa."); return; }

  const res = await Swal.fire({
    title: '🔒 Cerrar Sesión',
    html: `<p class="text-[12px] text-slate-600">¿Cerrar la sesión de <b>${window.doctorVerificado}</b>?</p>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });

  if (!res.isConfirmed) return;

  if (typeof window.registrarLogAuditoria === 'function')
    await window.registrarLogAuditoria("CIERRE SESIÓN", `${window.doctorVerificado} cerró sesión.`);

  const nombre = window.doctorVerificado;
  window.doctorVerificado = "";
  window.doctorActivoId   = null;

  // Limpiar selector doctor
  const sel = document.getElementById('selectDoctor');
  if (sel) sel.value = "";

  // Limpiar logos
  const logoD  = document.getElementById("logoDerechoVacuna");
  const spacer = document.getElementById("spacerDerechoVacuna");
  if (logoD)  { logoD.src = ""; logoD.classList.add("hidden"); }
  if (spacer) spacer.classList.remove("hidden");

  const logoCabecera = document.getElementById('logoDarwinHeader');
  if (logoCabecera) logoCabecera.classList.add('hidden');

  // Limpiar badge de sesión
  _actualizarBadgeSesion();

  // Redirigir a tab sin protección
  window.ejecutarCambioDeTab('historia');

  await Swal.fire({
    icon: 'success',
    title: 'Sesión cerrada',
    text: `Hasta luego, Dr. ${nombre}`,
    timer: 1800,
    showConfirmButton: false
  });
};

// ─── BADGE DE SESIÓN ACTIVA ───
function _actualizarBadgeSesion() {
  const badge = document.getElementById('badgeSesionActiva');
  const btnCerrar = document.getElementById('btnCerrarSesion');
  if (!badge) return;

  if (window.doctorVerificado) {
    badge.innerHTML = `
      <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-[9px] font-black text-emerald-700 uppercase">DR. ${window.doctorVerificado.split(' ')[0]}</span>
      </div>`;
    if (btnCerrar) btnCerrar.classList.remove('hidden');
  } else {
    badge.innerHTML = `
      <div class="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span class="text-[9px] font-black text-slate-500 uppercase">Sin sesión</span>
      </div>`;
    if (btnCerrar) btnCerrar.classList.add('hidden');
  }
}

// Exponer para que main.js lo llame al inicio
window._actualizarBadgeSesion = _actualizarBadgeSesion;

console.log("✅ seguridad.js v3 cargado — cerrarSesion, badge sesión");
