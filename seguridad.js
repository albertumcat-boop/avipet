// =========================================================
// AVIPET — seguridad.js  v4
// USUARIOS INVENTARIO: Daniel y Carlos (con PIN propio)
// Auditoría completa: quién, qué, cuándo
// =========================================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── USUARIOS DEL SISTEMA ───────────────────────────────
// Doctores: acceso general
// Inventario: Daniel y Carlos (solo inventario + auditoría)
// ────────────────────────────────────────────────────────

const USUARIOS_INVENTARIO = {
  "Daniel": { pinDefault: "3333", rol: "inventario" },
  "Carlos": { pinDefault: "4444", rol: "inventario" }
};

// PIN activo del usuario de inventario logueado
window.usuarioInventarioActivo = null; // { nombre, rol }

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

// ─── VALIDAR USUARIO DE INVENTARIO ───────────────────────
window.validarUsuarioInventario = async (pinIngresado) => {
  if (!pinIngresado) return null;

  // Intentar con llave maestra
  if (pinIngresado === window.MASTER_KEY_SISTEMA) {
    return { nombre: "Administrador", rol: "admin" };
  }

  // Buscar en Firebase primero
  for (const [nombre, cfg] of Object.entries(USUARIOS_INVENTARIO)) {
    try {
      const snap = await getDoc(doc(db, "usuarios_inventario", nombre));
      const pinGuardado = snap.exists() ? snap.data().pin : cfg.pinDefault;
      if (pinIngresado === pinGuardado) {
        return { nombre, rol: cfg.rol };
      }
    } catch {
      // Fallback a pin por defecto
      if (pinIngresado === cfg.pinDefault) {
        return { nombre, rol: cfg.rol };
      }
    }
  }

  // También permitir doctores en inventario
  for (const nombre of ["Darwin Sandoval", "Joan Silva"]) {
    const esValido = await window.validarDoctorConMaster(nombre, pinIngresado);
    if (esValido) return { nombre, rol: "doctor" };
  }

  return null; // PIN no reconocido
};

// ─── MODAL DE ACCESO A INVENTARIO ────────────────────────
window.pedirAccesoInventario = () => {
  return new Promise((resolve) => {
    Swal.fire({
      title: '🔐 Acceso a Inventario',
      html: `
        <p class="text-[11px] text-slate-500 mb-4">Ingresa tu PIN para continuar</p>
        <div class="space-y-3">
          <div>
            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 text-left">Usuario</label>
            <select id="swal_inv_usuario"
                    class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-500 bg-white">
              <option value="">-- Selecciona tu usuario --</option>
              <option value="Daniel">Daniel</option>
              <option value="Carlos">Carlos</option>
              <option value="Darwin Sandoval">Dr. Darwin Sandoval</option>
              <option value="Joan Silva">Dr. Joan Silva</option>
              <option value="Administrador">Administrador</option>
            </select>
          </div>
          <div>
            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 text-left">PIN</label>
            <input type="password" id="swal_inv_pin" maxlength="20"
                   class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[14px] font-black text-slate-800 outline-none focus:border-blue-500 text-center tracking-widest"
                   placeholder="••••">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: '🔓 Entrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d4ed8',
      focusConfirm: false,
      didOpen: () => {
        document.getElementById('swal_inv_pin')?.addEventListener('keydown', e => {
          if (e.key === 'Enter') Swal.clickConfirm();
        });
      },
      preConfirm: async () => {
        const usuario  = document.getElementById('swal_inv_usuario')?.value;
        const pin      = document.getElementById('swal_inv_pin')?.value.trim();
        if (!usuario)  { Swal.showValidationMessage('⚠️ Selecciona tu usuario'); return false; }
        if (!pin)      { Swal.showValidationMessage('⚠️ Ingresa tu PIN'); return false; }

        // Validar según tipo de usuario
        let acceso = null;
        if (usuario === 'Administrador') {
          if (pin === window.MASTER_KEY_SISTEMA) acceso = { nombre: 'Administrador', rol: 'admin' };
        } else if (usuario === 'Darwin Sandoval' || usuario === 'Joan Silva') {
          const ok = await window.validarDoctorConMaster(usuario, pin);
          if (ok) acceso = { nombre: usuario, rol: 'doctor' };
        } else {
          // Daniel o Carlos
          try {
            const snap = await getDoc(doc(db, "usuarios_inventario", usuario));
            const pinGuardado = snap.exists() ? snap.data().pin : USUARIOS_INVENTARIO[usuario]?.pinDefault;
            if (pin === pinGuardado || pin === window.MASTER_KEY_SISTEMA) {
              acceso = { nombre: usuario, rol: 'inventario' };
            }
          } catch {
            const pinDef = USUARIOS_INVENTARIO[usuario]?.pinDefault;
            if (pin === pinDef || pin === window.MASTER_KEY_SISTEMA) {
              acceso = { nombre: usuario, rol: 'inventario' };
            }
          }
        }

        if (!acceso) { Swal.showValidationMessage('❌ PIN incorrecto'); return false; }
        return acceso;
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const usuario = result.value;
        window.usuarioInventarioActivo = usuario;
        _actualizarBadgeSesion();

        // Registrar ingreso en auditoría
        await _registrarAuditoriaInventario('ACCESO INVENTARIO', `${usuario.nombre} ingresó al inventario.`);

        await Swal.fire({
          icon: 'success',
          title: `✅ Bienvenido, ${usuario.nombre}`,
          text: `Rol: ${usuario.rol.toUpperCase()}`,
          timer: 1500,
          showConfirmButton: false
        });

        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
};

// ─── AUDITORÍA DE INVENTARIO ──────────────────────────────
window.registrarAuditoriaInventario = async (accion, descripcion) => {
  await _registrarAuditoriaInventario(accion, descripcion);
};

async function _registrarAuditoriaInventario(accion, descripcion) {
  try {
    const usuario = window.usuarioInventarioActivo?.nombre
      || window.doctorVerificado
      || "Sistema";
    const ahora = new Date();
    await addDoc(collection(db, "auditoria_inventario"), {
      usuario,
      rol:         window.usuarioInventarioActivo?.rol || "doctor",
      accion,
      descripcion,
      fecha:       serverTimestamp(),
      fechaSimple: ahora.toLocaleDateString('es-VE'),
      hora:        ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      fechaISO:    ahora.toISOString()
    });
  } catch (e) { console.warn("Error auditoría inventario:", e); }
}

// ─── VER AUDITORÍA (para el admin) ───────────────────────
window.verAuditoriaInventario = async () => {
  try {
    const { getDocs, query, orderBy, limit } =
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const snap = await getDocs(
      query(collection(db, "auditoria_inventario"), orderBy("fecha", "desc"), limit(50))
    );

    if (snap.empty) { Swal.fire('Sin registros', 'No hay actividad registrada aún.', 'info'); return; }

    let rows = '';
    snap.forEach(d => {
      const r = d.data();
      const colorRol = r.rol === 'admin' ? 'text-red-600' : r.rol === 'doctor' ? 'text-blue-600' : 'text-emerald-600';
      rows += `<tr class="border-b border-slate-100 hover:bg-slate-50 text-[10px]">
        <td class="px-2 py-1.5 font-bold text-slate-700">${r.fechaSimple || '---'}</td>
        <td class="px-2 py-1.5 font-mono text-slate-500">${r.hora || '---'}</td>
        <td class="px-2 py-1.5 font-black ${colorRol}">${r.usuario || '---'}</td>
        <td class="px-2 py-1.5 font-bold text-slate-600 uppercase">${r.accion || '---'}</td>
        <td class="px-2 py-1.5 text-slate-500 italic">${r.descripcion || '---'}</td>
      </tr>`;
    });

    Swal.fire({
      title: '📋 Auditoría de Inventario',
      html: `
        <div style="max-height:400px;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#1e293b;color:#fff;font-size:9px;text-transform:uppercase;">
                <th style="padding:6px 8px;text-align:left;">Fecha</th>
                <th style="padding:6px 8px;text-align:left;">Hora</th>
                <th style="padding:6px 8px;text-align:left;">Usuario</th>
                <th style="padding:6px 8px;text-align:left;">Acción</th>
                <th style="padding:6px 8px;text-align:left;">Detalle</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
      width: 800,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#1d4ed8'
    });
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo cargar la auditoría.', 'error');
  }
};

// ─── CAMBIAR PIN USUARIO INVENTARIO ──────────────────────
window.cambiarPinUsuarioInventario = async (nombreUsuario) => {
  const nombre = nombreUsuario || window.usuarioInventarioActivo?.nombre;
  if (!nombre || !USUARIOS_INVENTARIO[nombre]) {
    alert("⚠️ Solo Daniel o Carlos pueden cambiar su PIN aquí."); return;
  }

  const res = await Swal.fire({
    title: `🔑 Cambiar PIN — ${nombre}`,
    html: `<div class="space-y-3 text-left mt-2">
      <div>
        <label class="text-[9px] font-black text-slate-500 uppercase block mb-1">PIN actual o Llave Maestra</label>
        <input type="password" id="swal_pin_actual" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-center font-black text-[14px] outline-none focus:border-blue-500" placeholder="••••">
      </div>
      <div>
        <label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Nuevo PIN (mínimo 4 dígitos)</label>
        <input type="password" id="swal_pin_nuevo" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-center font-black text-[14px] outline-none focus:border-blue-500" placeholder="••••">
      </div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: '✅ Cambiar PIN',
    confirmButtonColor: '#1d4ed8',
    preConfirm: async () => {
      const actual = document.getElementById('swal_pin_actual')?.value.trim();
      const nuevo  = document.getElementById('swal_pin_nuevo')?.value.trim();
      if (!actual) { Swal.showValidationMessage('Ingresa el PIN actual'); return false; }
      if (!nuevo || nuevo.length < 4) { Swal.showValidationMessage('El PIN debe tener al menos 4 dígitos'); return false; }

      // Verificar PIN actual
      let valido = actual === window.MASTER_KEY_SISTEMA;
      if (!valido) {
        try {
          const snap = await getDoc(doc(db, "usuarios_inventario", nombre));
          const pinGuardado = snap.exists() ? snap.data().pin : USUARIOS_INVENTARIO[nombre]?.pinDefault;
          valido = actual === pinGuardado;
        } catch {
          valido = actual === USUARIOS_INVENTARIO[nombre]?.pinDefault;
        }
      }
      if (!valido) { Swal.showValidationMessage('❌ PIN actual incorrecto'); return false; }
      return nuevo;
    }
  });

  if (res.isConfirmed && res.value) {
    await setDoc(doc(db, "usuarios_inventario", nombre),
      { pin: res.value, actualizadoEn: serverTimestamp(), nombre }, { merge: true });
    await _registrarAuditoriaInventario("CAMBIO PIN", `${nombre} cambió su PIN de acceso.`);
    Swal.fire({ icon: 'success', title: '✅ PIN actualizado', timer: 1800, showConfirmButton: false });
  }
};

// ─── CAMBIAR PIN DOCTOR ───────────────────────────────────
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
  alert("🚫 Clave incorrecta.");
};

// ─── ACCESO DOCTOR (Historia Clínica) ────────────────────
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

// ─── CERRAR SESIÓN ────────────────────────────────────────
window.cerrarSesion = async () => {
  const quien = window.doctorVerificado || window.usuarioInventarioActivo?.nombre;
  if (!quien) { alert("No hay sesión activa."); return; }

  const res = await Swal.fire({
    title: '🔒 Cerrar Sesión',
    html: `<p class="text-[12px] text-slate-600">¿Cerrar la sesión de <b>${quien}</b>?</p>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });

  if (!res.isConfirmed) return;

  if (window.usuarioInventarioActivo) {
    await _registrarAuditoriaInventario("CIERRE SESIÓN", `${window.usuarioInventarioActivo.nombre} cerró sesión de inventario.`);
    window.usuarioInventarioActivo = null;
  }
  if (window.doctorVerificado) {
    if (typeof window.registrarLogAuditoria === 'function')
      await window.registrarLogAuditoria("CIERRE SESIÓN", `${window.doctorVerificado} cerró sesión.`);
    window.doctorVerificado = "";
    window.doctorActivoId   = null;
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = "";
    const logoD  = document.getElementById("logoDerechoVacuna");
    const spacer = document.getElementById("spacerDerechoVacuna");
    if (logoD)  { logoD.src = ""; logoD.classList.add("hidden"); }
    if (spacer) spacer.classList.remove("hidden");
  }

  _actualizarBadgeSesion();
  window.ejecutarCambioDeTab('historia');
  await Swal.fire({ icon:'success', title:'Sesión cerrada', text:`Hasta luego, ${quien}`, timer:1800, showConfirmButton:false });
};

// ─── BADGE DE SESIÓN ──────────────────────────────────────
function _actualizarBadgeSesion() {
  const badge    = document.getElementById('badgeSesionActiva');
  const btnCerrar= document.getElementById('btnCerrarSesion');
  if (!badge) return;

  const inv    = window.usuarioInventarioActivo;
  const doctor = window.doctorVerificado;

  if (doctor) {
    badge.innerHTML = `
      <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-[9px] font-black text-emerald-700 uppercase">🩺 ${doctor.split(' ')[0]}</span>
      </div>`;
    if (btnCerrar) btnCerrar.classList.remove('hidden');
  } else if (inv) {
    const colorMap = { inventario:'bg-blue-50 border-blue-200 text-blue-700', admin:'bg-red-50 border-red-200 text-red-700', doctor:'bg-emerald-50 border-emerald-200 text-emerald-700' };
    const cls = colorMap[inv.rol] || 'bg-slate-100 border-slate-200 text-slate-600';
    badge.innerHTML = `
      <div class="flex items-center gap-2 ${cls} border rounded-full px-3 py-1">
        <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
        <span class="text-[9px] font-black uppercase">📦 ${inv.nombre}</span>
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

window._actualizarBadgeSesion = _actualizarBadgeSesion;

console.log("✅ seguridad.js v4 — usuarios inventario: Daniel, Carlos + auditoría completa");
