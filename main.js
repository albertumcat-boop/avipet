// ============================================================
// AVIPET — main.js
// Responsabilidades:
//   • Importaciones Firebase
//   • Estado global (appState, doctorVerificado, etc.)
//   • Detector de modo (encuesta / móvil)
//   • Tasa del dólar BCV
//   • Logos de doctores
//   • Seguridad: login modal, showTab, ejecutarCambioDeTab
//   • Registro de auditoría
//   • Sala de espera (cargar, atender, eliminar)
//   • Respaldo local automático
// ============================================================

import { db } from './firebase-config.js';

import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, onSnapshot, deleteDoc,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Persistencia manejada por firebase-config.js

// ============================================================
// ESTADO GLOBAL
// ============================================================
window.appState               = { doctor: "" };
window.doctorVerificado       = "";
window.doctorActivoId         = null;
window.MASTER_KEY_SISTEMA     = crypto.randomUUID(); // sustituido por Firestore antes de cualquier login
window.vacunaPagadaAnteriormente = false;

// Cargar MASTER_KEY desde Firestore — la Promise se usa para bloquear login hasta que cargue
window._masterKeyLoaded = false;
window._masterKeyReady = getDoc(doc(db, "configuracion", "sistema")).then(snap => {
  if (snap.exists() && snap.data().masterKey) {
    window.MASTER_KEY_SISTEMA = snap.data().masterKey;
    window._masterKeyLoaded = true;
  } else {
    console.warn("[AVIPET] configuracion/sistema sin masterKey — usa Ajustes para configurarla.");
  }
}).catch(err => {
  console.warn("[AVIPET] Error cargando clave maestra:", err.message);
});
window.usuarioActivoSistema   = "";
window.sesionAdminActiva      = false;  // true cuando entra con clave maestra

// ============================================================
// CONFIG DOCTORES
// ============================================================
window.CONFIG_DOCTORES = {
  "DR_DARWIN": {
    nombre:  "Dr. Darwin Sandoval",
    clinica: "AVIPET - Medicina Veterinaria",
    logo:    "https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg"
  },
  "DR_JOAN": {
    nombre:  "Dr. Joan Silva",
    clinica: "AVIPET - Medicina Veterinaria",
    logo:    "avipet.png"
  }
};

const _doctores = {
  "Darwin Sandoval": { logo: "https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg" },
  "Joan Silva":      { logo: "avipet.png" }
};

// ============================================================
// LOGOS
// ============================================================
function actualizarLogoDoctor() {
  const logo = document.getElementById("logoDerechoVacuna");
  if (!logo) return;
  logo.src = "";
  logo.classList.add("hidden");
  const doctor = window.appState.doctor;
  if (doctor && _doctores[doctor]) {
    logo.src = _doctores[doctor].logo;
    logo.classList.remove("hidden");
  }
}

function limpiarLogoHistoria() {
  const logo = document.getElementById("logoDerechoVacuna");
  if (logo) { logo.src = ""; logo.classList.add("hidden"); }
}

// ============================================================
// TASA DEL DÓLAR BCV — sincronizada en Firestore configuracion/tasa
// ============================================================
window.tasaDolarHoy = parseFloat(localStorage.getItem('tasaDolarAvipet')) || 440.97;

// Cargar tasa desde Firestore al iniciar y suscribirse a cambios en tiempo real
(async () => {
  try {
    const refTasa = doc(db, "configuracion", "tasa");
    onSnapshot(refTasa, (snap) => {
      if (snap.exists()) {
        const tasaFS = parseFloat(snap.data().valor || 0);
        if (tasaFS > 0 && tasaFS !== window.tasaDolarHoy) {
          window.tasaDolarHoy = tasaFS;
          localStorage.setItem('tasaDolarAvipet', tasaFS);
          const d = document.getElementById('displayTasa');
          if (d) d.innerText = tasaFS.toFixed(2);
          if (typeof window.calcularPrecioFinalAvipet === 'function') window.calcularPrecioFinalAvipet();
          if (window.inventarioCache && typeof window.renderListaInventario === 'function')
            window.renderListaInventario(window.inventarioCache);
        }
      }
    });
  } catch (_) {}
})();

window.ajustarTasaDolar = async () => {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const res  = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv', { signal: controller.signal });
    clearTimeout(tid);
    const data = await res.json();
    if (data?.monitors?.bcv) {
      const tasaBCV = parseFloat(data.monitors.bcv.price);
      if (confirm(`📡 Tasa BCV detectada: ${tasaBCV}\n¿Deseas aplicarla?`)) {
        window.tasaDolarHoy = tasaBCV;
        _aplicarYGuardarTasa();
        return;
      }
    }
  } catch (_) {}
  const manual = prompt("Ingrese la tasa del dólar manualmente:", window.tasaDolarHoy);
  if (manual !== null && manual !== "" && !isNaN(manual)) {
    window.tasaDolarHoy = parseFloat(manual);
    _aplicarYGuardarTasa();
  }
};

function _aplicarYGuardarTasa() {
  localStorage.setItem('tasaDolarAvipet', window.tasaDolarHoy);
  // Persistir en Firestore para sincronizar todos los dispositivos
  setDoc(doc(db, "configuracion", "tasa"), { valor: window.tasaDolarHoy, actualizado: serverTimestamp() })
    .catch(e => console.warn('[AVIPET] Error guardando tasa en Firestore:', e));
  const d = document.getElementById('displayTasa');
  if (d) d.innerText = window.tasaDolarHoy.toFixed(2);
  if (typeof window.calcularPrecioFinalAvipet === 'function') window.calcularPrecioFinalAvipet();
  if (window.inventarioCache && typeof window.renderListaInventario === 'function')
    window.renderListaInventario(window.inventarioCache);
}

// ============================================================
// SELECTOR DE DOCTOR + PIN
// ============================================================
document.getElementById("selectDoctor")?.addEventListener("change", async function () {
  window.appState.doctor = this.value;
  if (typeof window.validarAccesoDoctor === "function")
    await window.validarAccesoDoctor(this.value);
  actualizarLogoDoctor();
});

// window.validarAccesoDoctor — implementación completa en seguridad.js

window.onDoctorAutenticado = (id) => {
  window.doctorActivoId = id;
  // Si es un doctor (no null/admin), ocultar tabs restringidos
  if (id) {
    _aplicarPermisoDoctor(true);
  } else {
    _aplicarPermisoDoctor(false);
  }
};

// Mostrar/ocultar tabs según si hay un doctor activo — expuesto en window para seguridad.js
function _aplicarPermisoDoctor(soloDoctor) {
  // Tabs que el doctor NO puede ver
  const tabsRestringidos = [
    '[data-tab="reporte"]',      // Finanzas
    '[data-tab="inventario"]',   // Inventario
    '[data-tab="config_precios"]' // Ajustes
  ];
  tabsRestringidos.forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(btn) {
      btn.style.display = soloDoctor ? 'none' : '';
    });
  });
  // También el botón de Ajustes que no tiene data-tab
  const btnAjustes = document.querySelector('button[onclick*="config_precios"]');
  if (btnAjustes) btnAjustes.style.display = soloDoctor ? 'none' : '';
  // Botón flotante Facturación — se oculta cuando hay doctor activo
  const btnFact = document.getElementById('btnFacturacionFloat');
  if (btnFact) btnFact.style.display = soloDoctor ? 'none' : '';
}
window._aplicarPermisoDoctor = _aplicarPermisoDoctor;

// ============================================================
// VALIDACIÓN PIN DOCTORES
// (implementación real en seguridad.js — esta es sólo un fallback
//  hasta que seguridad.js termine de cargarse)
// ============================================================
if (typeof window.validarDoctorConMaster !== 'function') {
  window.validarDoctorConMaster = async (nombreDoc, pin) => {
    await window._masterKeyReady;
    if (pin === window.MASTER_KEY_SISTEMA) return true;
    try {
      const snap = await getDoc(doc(db, "doctores", nombreDoc));
      if (snap.exists()) return pin === snap.data().pin;
    } catch (_) {}
    return false; // sin fallback hardcodeado
  };
}

window.cambiarPinDoctor = async (nombreDoc) => {
  if (!nombreDoc) return alert("Seleccione un doctor primero.");
  const pinActual = prompt(`🔐 [${nombreDoc}] PIN actual o Llave Maestra:`);
  if (!pinActual) return;
  if (!await window.validarDoctorConMaster(nombreDoc, pinActual))
    return alert("🚫 Validación fallida.");
  const nuevoPin = prompt("🆕 NUEVO PIN (mín. 4 dígitos):");
  if (nuevoPin && nuevoPin.length >= 4) {
    await setDoc(doc(db, "doctores", nombreDoc),
      { pin: nuevoPin, ultimaActualizacion: serverTimestamp() }, { merge: true });
    alert("✅ PIN actualizado.");
  } else alert("⚠️ PIN inválido.");
};

// window.solicitarCambioPinDoctor — implementación completa en seguridad.js

window.recuperarPin = () => {
  window.cerrarModalLogin();
  window.solicitarCambioPinDoctor();
};

// ============================================================
// LOGIN MODAL + TABS
// ============================================================
if (typeof window.tabPendiente === 'undefined') window.tabPendiente = '';

window.validarAcceso = async () => {
  await window._masterKeyReady;
  const pass = document.getElementById('modalPinInput').value;
  let responsable = null;
  if (pass && pass === window.MASTER_KEY_SISTEMA) responsable = 'Administrador';

  try {
    if (!responsable) {
      const snap = await getDoc(doc(db, "configuracion", "seguridad"));
      const pinG = snap.exists() ? (snap.data().pin || "") : "";
      if (pinG && pass === pinG) responsable = "Personal General";
    }
    if (!responsable) {
      const snapEmp = await getDocs(query(collection(db, "empleados"), where("PIN", "==", pass)));
      if (!snapEmp.empty) {
        const empData = snapEmp.docs[0].data();
        responsable = empData.nombreEmpleado || snapEmp.docs[0].id;
      }
    }

    if (responsable) {
      window.usuarioActivoSistema = responsable;
      // Si es clave maestra o Aiby → sesión admin activa (no vuelve a pedir PIN)
      if (pass === window.MASTER_KEY_SISTEMA) {
        window.sesionAdminActiva = true;
        _mostrarBannerAdmin(responsable);
      }
      await window.registrarLogAuditoria("ACCESO PROTEGIDO",
        `Entró a ${window.tabPendiente} como ${responsable}`);
      window.cerrarModalLogin();
      window.ejecutarCambioDeTab(window.tabPendiente);
    } else {
      alert("🚫 PIN Incorrecto.");
    }
  } catch (_) {
    if (responsable) {
      window.usuarioActivoSistema = responsable;
      if (pass === window.MASTER_KEY_SISTEMA) {
        window.sesionAdminActiva = true;
        _mostrarBannerAdmin(window.usuarioActivoSistema);
      }
      window.cerrarModalLogin();
      window.ejecutarCambioDeTab(window.tabPendiente);
    } else {
      alert("🚫 PIN incorrecto o sin conexión.");
    }
  }
  document.getElementById('modalPinInput').value = "";
};

window.cerrarModalLogin = () => {
  document.getElementById('modalLoginAcceso')?.classList.add('hidden');
  const i = document.getElementById('modalPinInput');
  if (i) i.value = "";
};

window.showTab = async (t) => {
  if (['config_precios', 'reporte', 'inventario'].includes(t)) {
    // Si hay sesión admin activa, entrar directo sin pedir PIN
    if (window.sesionAdminActiva) {
      window.ejecutarCambioDeTab(t);
      return;
    }
    window.tabPendiente = t;
    const m = document.getElementById('modalLoginAcceso');
    if (m) { m.classList.remove('hidden'); document.getElementById('modalPinInput')?.focus(); }
    else window.ejecutarCambioDeTab(t);
    return;
  }
  window.ejecutarCambioDeTab(t);
};

// Cerrar sesión admin
window.cerrarSesionAdmin = () => {
  window.sesionAdminActiva = false;
  window.usuarioActivoSistema = "";
  document.getElementById('bannerSesionAdmin')?.remove();
  window.ejecutarCambioDeTab('historia');
};

// Mostrar banner de sesión activa
function _mostrarBannerAdmin(nombre) {
  // Evitar duplicados
  document.getElementById('bannerSesionAdmin')?.remove();
  const banner = document.createElement('div');
  banner.id = 'bannerSesionAdmin';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e293b;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:6px 16px;font-size:11px;font-weight:900;font-family:sans-serif;';
  banner.innerHTML =
    '<span style="display:flex;align-items:center;gap:8px;">' +
    '<span style="background:#16a34a;border-radius:50%;width:8px;height:8px;display:inline-block;"></span>' +
    'SESIÓN ACTIVA: ' + nombre.toUpperCase() + ' — Acceso total</span>' +
    '<button onclick="window.cerrarSesionAdmin()" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:900;cursor:pointer;text-transform:uppercase;">Cerrar sesión</button>';
  document.body.prepend(banner);
}

window.ejecutarCambioDeTab = async (t) => {
  // Si hay edición de consulta activa y el usuario cambia de tab, advertir y cancelar
  if (window._editandoConsultaId && t !== 'historia') {
    const ok = confirm('⚠️ Hay una edición de consulta en curso.\n¿Salir y cancelar la edición?');
    if (!ok) return;
    window._editandoConsultaId = null;
    document.getElementById('bannerModoEdicion')?.classList.add('hidden');
  }
  if (t === 'historia') limpiarLogoHistoria();

  ['sectionHistoria','sectionBuscador','sectionReporte','sectionEspera',
   'sectionHojaVacunas','sectionConfig_precios','sectionPeluqueria','sectionInventario','sectionAlmuerzo']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const mapa = {
    historia:'sectionHistoria', buscador:'sectionBuscador',
    reporte:'sectionReporte',   espera:'sectionEspera',
    vacunas:'sectionHojaVacunas', config_precios:'sectionConfig_precios',
    peluqueria:'sectionPeluqueria', inventario:'sectionInventario',
    personal:'sectionAlmuerzo'
  };
  document.getElementById(mapa[t])?.classList.remove('hidden');

  const tabs = { historia:'tabH', buscador:'tabB', reporte:'tabR',
                 espera:'tabE', peluqueria:'tabP', inventario:'tabInv', personal:'tabPersonal' };
  Object.keys(tabs).forEach(k => {
    const b = document.getElementById(tabs[k]);
    if (!b) return;
    b.classList.toggle('tab-active',   t === k);
    b.classList.toggle('text-blue-600', t === k);
    b.classList.toggle('text-gray-500', t !== k);
  });

  if (t==='reporte'        && typeof window.cargarReporte         ==='function') window.cargarReporte();
  if (t==='espera'         && typeof window.cargarListaEspera     ==='function') window.cargarListaEspera();
  if (t==='config_precios' && typeof window.cambiarSubTabConfig   ==='function') window.cambiarSubTabConfig('servicios');
  if (t==='inventario') {
    typeof window.cargarInventario              ==='function' && window.cargarInventario();
    typeof window.actualizarSelectorProveedores ==='function' && window.actualizarSelectorProveedores();
  }
  if (t==='peluqueria') {
    if (typeof window.cargarBitacoraHoy    ==='function') window.cargarBitacoraHoy();
    if (typeof window.recalcularTotalPelu  ==='function') window.recalcularTotalPelu();
  }
  if (t==='personal'   && typeof window._initAlmuerzoModule==='function') window._initAlmuerzoModule();

  const nav = document.getElementById('navMobile');
  if (nav) nav.value = t;

  if (t==="vacunas") actualizarLogoDoctor();
};

// ============================================================
// AUDITORÍA
// ============================================================
window.registrarLogAuditoria = async (accion, detalle) => {
  try {
    await addDoc(collection(db, "auditoria_sistema"), {
      usuario: window.usuarioActivoSistema || "Desconocido",
      accion, detalle,
      fecha:     new Date().toLocaleString(),
      timestamp: serverTimestamp()
    });
  } catch (e) { console.error("Bitácora:", e); }
};

// ============================================================
// SALA DE ESPERA
// ============================================================
window.enviarAColaEspera = async () => {
  const dVal = id => document.getElementById(id)?.value.trim() || "";
  const data = {
    cedula: dVal('hCI'), propietario: dVal('hProp'), paciente: dVal('hNombre'),
    especie: dVal('hEspecie'), raza: dVal('hRaza'), edad: dVal('hEdad'),
    sexo: dVal('hSexo'), peso: dVal('hPeso'), telefono: dVal('hTlf'),
    correo: dVal('hMail'), direccion: dVal('hDir'), color: dVal('hColor'),
    fechaIngreso: serverTimestamp(),
    fechaSimple: `${new Date().getDate()}/${new Date().getMonth()+1}/${new Date().getFullYear()}`,
    estado: "en_espera"
  };
  if (!data.cedula || !data.paciente || !data.propietario)
    return alert("⚠️ Cédula, Propietario y Paciente son obligatorios.");
  try {
    await addDoc(collection(db, "espera"), data);
    alert("✅ Paciente enviado a cola de espera.");
  } catch (e) { alert("❌ Error: " + e.message); }
};

let _unsubEspera = null;
window.cargarListaEspera = () => {
  const cont = document.getElementById('listaEspera');
  if (!cont) return;
  // Cancelar listener anterior si existe
  if (_unsubEspera) { _unsubEspera(); _unsubEspera = null; }
  cont.innerHTML = "<p class='text-center text-slate-400 text-[10px]'>Cargando...</p>";
  const _renderEspera = (snap) => {
    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items = items.filter(i => i.estado === "en_espera")
                 .sort((a,b) => (a.fechaIngreso?.seconds||0) - (b.fechaIngreso?.seconds||0));
    if (!items.length) {
      cont.innerHTML = "<p class='text-center text-slate-400 text-[10px]'>Sin pacientes en espera.</p>";
      return;
    }
    cont.innerHTML = "";
    items.forEach(p => {
      const div = document.createElement('div');
      div.className = "border rounded-lg p-2 bg-slate-50 flex justify-between items-center gap-2 mb-2";
      div.innerHTML = `
        <div>
          <p class="font-bold uppercase text-[11px] text-slate-700">${p.paciente}</p>
          <p class="text-[9px] text-slate-500">${p.propietario} · CI: ${p.cedula}</p>
          <p class="text-[9px] text-slate-400">${p.telefono || ''} ${p.especie ? '· '+p.especie : ''}</p>
        </div>
        <div class="flex gap-2">
          <button class="bg-blue-600 text-white text-[10px] px-3 py-1 rounded font-black uppercase"
                  onclick="window.abrirPacienteDesdeEspera('${p.id}')">Atender</button>
          <button class="bg-red-500 text-white text-[10px] px-3 py-1 rounded font-black uppercase"
                  onclick="window.eliminarDeSalaEspera('${p.id}')">Eliminar</button>
        </div>`;
      cont.appendChild(div);
    });
  };
  try {
    _unsubEspera = onSnapshot(collection(db, "espera"), _renderEspera, (e) => {
      cont.innerHTML = "<p class='text-red-500 text-[10px] text-center'>Error al cargar.</p>";
    });
  } catch(e) {
    cont.innerHTML = "<p class='text-red-500 text-[10px] text-center'>Error al cargar.</p>";
  }
};

window.abrirPacienteDesdeEspera = async (id) => {
  try {
    const snap = await getDoc(doc(db, "espera", id));
    if (!snap.exists()) return alert("Registro no encontrado.");
    const d   = snap.data();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    set('hCI',d.cedula); set('hProp',d.propietario); set('hNombre',d.paciente);
    set('hEspecie',d.especie); set('hRaza',d.raza);   set('hEdad',d.edad);
    set('hSexo',d.sexo); set('hPeso',d.peso);         set('hTlf',d.telefono);
    set('hMail',d.correo); set('hDir',d.direccion);   set('hColor',d.color);
    if (d.motivoConsulta) {
      set('hTratamiento', 'MOTIVO DE CONSULTA:\n' + d.motivoConsulta);
    }
    if (d.esReferido && typeof window._mostrarBannerReferido === 'function') {
      window._esConsultaReferida = true;
      window._mostrarBannerReferido();
    }
    // Si ya existe una consulta creada por recepcionista, abrirla en modo edición
    if (d.consultaId && typeof window.abrirConsultaParaEditar === 'function') {
      await updateDoc(doc(db,"espera",id),{estado:"atendiendo",fechaAtencion:serverTimestamp()});
      await window.abrirConsultaParaEditar(d.consultaId);
      return;
    }

    // Asignar doctor pre-seleccionado
    if (d.doctor) {
      const selDoc = document.getElementById('selectDoctor');
      if (selDoc) selDoc.value = d.doctor;
    }
    // Preset forma de pago para saltar el Swal en guardarFirebase
    if (d.formaPago) {
      window._formaPagoPreset = { value: d.formaPago, label: d.formaPagoLabel || d.formaPago };
    }
    // Pre-cargar servicios del referido en la tabla de historia
    if (Array.isArray(d.serviciosReferido) && d.serviciosReferido.length > 0 && typeof window.insertarServicioReferido === 'function') {
      for (const s of d.serviciosReferido) {
        await window.insertarServicioReferido(s.nombre, s.precio, s.porc);
      }
    }
    await updateDoc(doc(db,"espera",id),{estado:"atendiendo",fechaAtencion:serverTimestamp()});
    window.showTab('historia');
    alert(`✅ ${d.paciente} cargado en historia clínica.`);
  } catch (e) { alert("❌ Error: " + e.message); }
};

// ── FICHA REFERIDO — modal completo con servicios ─────────
let _rfServicios = [];
const _rfFP_LABELS = { dolares:'Dólares', movil:'Pago Móvil / Tarjeta', cashea:'Cashea' };

function _rfCrearModal() {
  const el = document.createElement('div');
  el.id = 'modalFichaReferido';
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.65);overflow-y:auto;padding:16px;';
  el.innerHTML = `
  <div style="background:#fff;max-width:580px;margin:0 auto;border-radius:20px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <h2 style="font-size:14px;font-weight:900;color:#1e293b;text-transform:uppercase;margin:0;">🔗 Ficha de Paciente Referido</h2>
      <button onclick="document.getElementById('modalFichaReferido').style.display='none'"
              style="background:#f1f5f9;border:none;border-radius:8px;width:28px;height:28px;font-size:14px;cursor:pointer;color:#64748b;">✕</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <div style="grid-column:1/-1;">
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Nombre Mascota *</label>
        <input id="rf_paciente" type="text" placeholder="LUNA, THOR..."
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:700;text-transform:uppercase;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Especie</label>
        <input id="rf_especie" type="text" placeholder="CANINO / FELINO"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;text-transform:uppercase;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Raza</label>
        <input id="rf_raza" type="text" placeholder="MESTIZO..."
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;text-transform:uppercase;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Propietario *</label>
        <input id="rf_propietario" type="text" placeholder="NOMBRE APELLIDO"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;text-transform:uppercase;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Cédula</label>
        <input id="rf_cedula" type="text" placeholder="V12345678"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Teléfono</label>
        <input id="rf_telefono" type="text" placeholder="04XX-XXXXXXX"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;outline:none;">
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Doctor Asignado</label>
        <select id="rf_doctor"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;outline:none;background:#fff;">
          <option value="">-- Seleccionar --</option>
          <option value="Darwin Sandoval">Dr. Darwin Sandoval</option>
          <option value="Joan Silva">Dr. Joan Silva</option>
        </select>
      </div>
      <div>
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Forma de Pago</label>
        <select id="rf_formaPago"
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;outline:none;background:#fff;">
          <option value="dolares">💵 Dólares</option>
          <option value="movil">📲 Pago Móvil / Tarjeta</option>
          <option value="cashea">🟣 Cashea</option>
        </select>
      </div>
      <div style="grid-column:1/-1;">
        <label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Motivo / Síntomas *</label>
        <textarea id="rf_motivo" rows="2" placeholder="Describir síntomas o motivo..."
          style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;resize:vertical;outline:none;font-family:inherit;"></textarea>
      </div>
    </div>

    <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0;">Servicios</p>
        <p style="font-size:12px;font-weight:900;color:#2563eb;margin:0;">Total: <span id="rf_total">$0.00</span></p>
      </div>
      <select id="rf_selectorServicio" onchange="window._rfAgregarServicio(this)"
        style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:700;outline:none;background:#fff;margin-bottom:8px;">
        <option value="">+ Agregar servicio...</option>
      </select>
      <div id="rf_listaServicios"></div>
    </div>

    <div id="rf_error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:700;color:#dc2626;margin-bottom:10px;"></div>

    <div style="display:flex;gap:10px;">
      <button onclick="document.getElementById('modalFichaReferido').style.display='none'"
        style="flex:1;padding:12px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-size:12px;font-weight:900;cursor:pointer;color:#64748b;">
        Cancelar
      </button>
      <button id="rf_btnGuardar" onclick="window._rfGuardar()"
        style="flex:2;padding:12px;border:none;border-radius:12px;background:#7c3aed;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">
        ✅ Registrar en Espera
      </button>
    </div>
  </div>`;
  document.body.appendChild(el);
}

window.abrirFichaReferido = async () => {
  if (!document.getElementById('modalFichaReferido')) _rfCrearModal();
  _rfServicios = [];

  // Reset campos
  ['rf_paciente','rf_especie','rf_raza','rf_propietario','rf_cedula','rf_telefono','rf_motivo']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const elDoc = document.getElementById('rf_doctor');
  if (elDoc) elDoc.value = '';
  const elFP = document.getElementById('rf_formaPago');
  if (elFP) elFP.value = 'dolares';
  document.getElementById('rf_listaServicios').innerHTML = '';
  document.getElementById('rf_total').textContent = '$0.00';
  document.getElementById('rf_error').style.display = 'none';

  // Cargar servicios desde Firestore
  const sel = document.getElementById('rf_selectorServicio');
  sel.innerHTML = '<option value="">⏳ Cargando servicios...</option>';
  try {
    const snap = await getDocs(collection(db, 'servicios_maestro'));
    const grupos = {};
    snap.forEach(d => {
      const dat = d.data();
      if (dat.activo === false) return;
      const cat = (dat.categoria || 'OTROS').toUpperCase();
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push({ nombre: d.id, precio: parseFloat(dat.precioVenta || 0), porc: parseFloat(dat.porcDoc || 30) });
    });
    sel.innerHTML = '<option value="">+ Agregar servicio...</option>';
    Object.entries(grupos).sort().forEach(([cat, servicios]) => {
      const grp = document.createElement('optgroup');
      grp.label = cat;
      servicios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).forEach(s => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(s);
        opt.textContent = `${s.nombre}  —  $${s.precio.toFixed(2)}`;
        grp.appendChild(opt);
      });
      sel.appendChild(grp);
    });
  } catch(e) {
    sel.innerHTML = '<option value="">Error cargando servicios</option>';
    console.warn('Error cargando servicios referido:', e);
  }

  document.getElementById('modalFichaReferido').style.display = 'block';
  setTimeout(() => document.getElementById('rf_paciente')?.focus(), 100);
};

window._rfAgregarServicio = (sel) => {
  if (!sel.value) return;
  try {
    const s = JSON.parse(sel.value);
    _rfServicios.push({ ...s });
    _rfRenderServicios();
  } catch(e) { console.warn(e); }
  sel.value = '';
};

window._rfQuitarServicio = (idx) => {
  _rfServicios.splice(idx, 1);
  _rfRenderServicios();
};

function _rfRenderServicios() {
  const lista = document.getElementById('rf_listaServicios');
  if (!lista) return;
  let total = 0;
  lista.innerHTML = '';
  _rfServicios.forEach((s, i) => {
    total += s.precio;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:6px;';
    div.innerHTML = `
      <span style="font-size:11px;font-weight:700;color:#1e293b;flex:1;">${s.nombre}</span>
      <span style="font-size:13px;font-weight:900;color:#2563eb;margin-right:10px;">$${s.precio.toFixed(2)}</span>
      <button onclick="window._rfQuitarServicio(${i})"
        style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;width:22px;height:22px;font-weight:900;cursor:pointer;font-size:13px;line-height:1;">×</button>`;
    lista.appendChild(div);
  });
  const totalEl = document.getElementById('rf_total');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

window._rfGuardar = async () => {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const paciente    = get('rf_paciente').toUpperCase();
  const propietario = get('rf_propietario').toUpperCase();
  const motivo      = get('rf_motivo');
  const errEl = document.getElementById('rf_error');

  if (!paciente || !propietario || !motivo) {
    errEl.textContent = !paciente ? 'El nombre de la mascota es obligatorio.'
                      : !propietario ? 'El nombre del propietario es obligatorio.'
                      : 'Describe el motivo de la consulta.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const formaPago      = get('rf_formaPago') || 'dolares';
  const montoReferido  = _rfServicios.reduce((s, x) => s + x.precio, 0);

  const btn = document.getElementById('rf_btnGuardar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
  try {
    const cedula      = get('rf_cedula') || 'REFERIDO';
    const especie     = get('rf_especie').toUpperCase();
    const raza        = get('rf_raza').toUpperCase();
    const telefono    = get('rf_telefono');
    const doctor      = get('rf_doctor');
    const fpLabel     = _rfFP_LABELS[formaPago] || formaPago;
    const now         = new Date();
    const fechaSimple = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

    // Calcular montos desde servicios
    let totalGastos = 0, pagoDoctorTotal = 0;
    const serviciosRealizados = _rfServicios.map(s => {
      const porc  = parseFloat(s.porc) || 30;
      const precio = parseFloat(s.precio) || 0;
      const doc   = precio * porc / 100;
      const gas   = precio - doc;
      pagoDoctorTotal += doc;
      totalGastos     += gas;
      return { nombre: s.nombre, precio, porcDoc: porc };
    });
    const pagoAvipet = montoReferido - totalGastos - pagoDoctorTotal;

    // 1. Crear historia en "consultas" visible en buscador
    const dataConsulta = {
      cedula, propietario, paciente, especie, raza, telefono,
      doctor,
      formaPago,
      formaPagoLabel: fpLabel,
      serviciosRealizados,
      montoVenta:    montoReferido,
      montoInsumos:  totalGastos,
      pagoDoctor:    pagoDoctorTotal,
      pagoAvipet,
      tratamiento:   motivo,
      esReferido:    true,
      estadoReferido: 'pendiente',
      fecha:         serverTimestamp(),
      fechaSimple,
    };
    const consultaRef = await addDoc(collection(db, 'consultas'), dataConsulta);

    // 2. Guardar en "espera" (sala de espera) con referencia a la consulta
    await addDoc(collection(db, 'espera'), {
      cedula, propietario, paciente, especie, raza, telefono,
      motivoConsulta:  motivo,
      doctor,
      formaPago,
      formaPagoLabel:  fpLabel,
      serviciosReferido: _rfServicios,
      montoReferido,
      consultaId:      consultaRef.id,
      esReferido:      true,
      fechaIngreso:    serverTimestamp(),
      fechaSimple,
      estado:          'en_espera'
    });

    document.getElementById('modalFichaReferido').style.display = 'none';
    await Swal.fire({ icon:'success', title:'✅ Registrado', text:`${paciente} está en sala de espera y aparece en el buscador.`, timer:2500, showConfirmButton:false });
  } catch(e) {
    errEl.textContent = 'Error al guardar: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar en Espera'; }
  }
};

window.eliminarDeSalaEspera = async (id) => {
  if (!confirm("¿Eliminar de la cola?")) return;
  try {
    await updateDoc(doc(db,"espera",id),{estado:"eliminado",fechaEliminacion:serverTimestamp()});
    alert("✅ Eliminado.");
    window.cargarListaEspera();
  } catch (e) { alert("❌ Error: " + e.message); }
};

// ============================================================
// LISTENER COLA DE ESPERA — ALERTA SONORA EN TIEMPO REAL
// ============================================================
let _unsubListenerCola = null;
window.iniciarListenerCola = () => {
  if (_unsubListenerCola) return; // ya activo, no duplicar
  let primera = true;
  _unsubListenerCola = onSnapshot(collection(db,"espera"), snap => {
    if (primera) { primera = false; return; }
    snap.docChanges().forEach(change => {
      if (change.type==="added" && change.doc.data().estado==="en_espera") _sonarAlerta();
    });
  });
};

function _sonarAlerta() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [440,550,660].forEach((f,i) => {
      const osc=ctx.createOscillator(), g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value=f; osc.type="sine";
      const t=ctx.currentTime+i*0.18;
      osc.start(t); g.gain.setValueAtTime(0.3,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.35); osc.stop(t+0.35);
    });
  } catch(_) {}
}

// ============================================================
// DETECTOR MÓVIL / ENCUESTA
// ============================================================
const _ejecutarDetectorMovil = () => {
  const p = new URLSearchParams(window.location.search);
  if (p.get('mode')==='encuesta') {
    const ci=p.get('ci')||"", pac=p.get('paciente')||"", doc2=p.get('doctor')||"";
    const chk=setInterval(()=>{ if(window.mostrarEncuesta){window.mostrarEncuesta(ci,pac,doc2);clearInterval(chk);} },100);
    return;
  }
  if (p.get('mode')==='mobile') {
    const ci=p.get('ci'), tipo=p.get('tipo')||'historia';
    const chk=setInterval(()=>{ if(window.mostrarInterfazSoloCamara){window.mostrarInterfazSoloCamara(ci,tipo);clearInterval(chk);} },100);
  }
};
_ejecutarDetectorMovil();
window.addEventListener('popstate', _ejecutarDetectorMovil);
if ('navigation' in window)
  window.navigation.addEventListener('navigate', ()=>setTimeout(_ejecutarDetectorMovil,100));

// RESPALDO LOCAL — definido en historia.js (incluye todos los campos del paciente)
// main.js NO sobreescribe esa función — solo se asegura que exista como no-op hasta que cargue historia.js
if (typeof window.respaldarProgresoLocal !== 'function') {
  window.respaldarProgresoLocal = () => {};
}

// ============================================================
// ARRANQUE DOMContentLoaded
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const f = new Date();
  const cf = document.getElementById('fechaDoc');
  if (cf) cf.value = `${f.getDate()}/${f.getMonth()+1}/${f.getFullYear()}`;

  // Verificar permisos/documentos próximos a vencer (5s para que Firebase esté listo)
  setTimeout(() => window.permisosChequearVencimientos?.(), 5000);

  const dt = document.getElementById('displayTasa');
  if (dt) dt.innerText = window.tasaDolarHoy.toFixed(2);

  // Restaurar sesión del doctor si recargó la página — requiere reconfirmar PIN
  const _doctorGuardado = sessionStorage.getItem('avipet_doctor');
  if (_doctorGuardado) {
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = _doctorGuardado;
    // Mostrar banner de confirmación — NO activar privilegios aún
    const _bannerPendiente = document.createElement('div');
    _bannerPendiente.id = 'bannerSesionPendiente';
    _bannerPendiente.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e40af;color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.35);';
    _bannerPendiente.innerHTML = `
      <span>🔒 Sesión del Dr. <strong>${_doctorGuardado}</strong> detectada. Confirma tu PIN para continuar.</span>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <input id="pinConfirmSesion" type="password" maxlength="6" placeholder="PIN"
          style="width:80px;padding:4px 8px;border-radius:6px;border:none;color:#000;font-size:14px;">
        <button id="btnConfirmSesion"
          style="background:#22c55e;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:13px;">Confirmar</button>
        <button id="btnCancelarSesion"
          style="background:#ef4444;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:13px;">✕</button>
      </div>`;
    document.body.prepend(_bannerPendiente);

    const _confirmarSesionPendiente = async () => {
      const pin = document.getElementById('pinConfirmSesion')?.value?.trim();
      if (!pin) {
        const inp = document.getElementById('pinConfirmSesion');
        if (inp) { inp.placeholder = '⚠️ Escribe tu PIN'; inp.style.borderColor = '#f59e0b'; inp.focus(); }
        return;
      }
      const ok = await window.validarDoctorConMaster(_doctorGuardado, pin);
      if (!ok) {
        const inp = document.getElementById('pinConfirmSesion');
        inp.value = '';
        inp.placeholder = '❌ PIN incorrecto';
        return;
      }
      // PIN correcto — activar sesión completa
      window.doctorVerificado  = _doctorGuardado;
      window.appState.doctor   = _doctorGuardado;
      const dp = document.getElementById('doctorPrint');
      if (dp) dp.innerText = 'DR. ' + _doctorGuardado.toUpperCase();
      if (_doctorGuardado === 'Darwin Sandoval') {
        const logoD  = document.getElementById('logoDerechoVacuna');
        const spacer = document.getElementById('spacerDerechoVacuna');
        if (logoD)  { logoD.src = 'https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg'; logoD.classList.remove('hidden'); }
        if (spacer) spacer.classList.add('hidden');
        window.doctorActivoId = 'DR_DARWIN';
      } else if (_doctorGuardado === 'Joan Silva') {
        window.doctorActivoId = 'DR_JOAN';
      }
      _aplicarPermisoDoctor(true);
      _bannerPendiente.remove();
      console.log('[AVIPET] Sesión del doctor reconfirmada:', _doctorGuardado);
    };

    document.getElementById('btnConfirmSesion').addEventListener('click', _confirmarSesionPendiente);
    document.getElementById('pinConfirmSesion').addEventListener('keydown', e => { if (e.key === 'Enter') _confirmarSesionPendiente(); });
    document.getElementById('btnCancelarSesion').addEventListener('click', () => {
      sessionStorage.removeItem('avipet_doctor');
      if (sel) sel.value = '';
      _bannerPendiente.remove();
    });
  }

  window.ejecutarCambioDeTab('historia');
  window.iniciarListenerCola();

  // Recuperar respaldo
  try {
    const raw = localStorage.getItem('respaldo_historia_activa');
    if (!raw) return;
    const datos = JSON.parse(raw);
    // Recuperar si hay cualquier campo relevante (no solo tratamiento)
    const hayDatos = (datos.cedula||datos.paciente||datos.propietario||datos.diagnostico||datos.tratamiento||'').trim().length > 0;
    const ok = datos.timestamp > Date.now()-(24*60*60*1000) && hayDatos;
    if (!ok) return;
    if (confirm("⚠ Historia no guardada detectada.\n¿Deseas recuperar los datos?")) {
      const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      set('hCI',       datos.cedula);
      set('hProp',     datos.propietario);
      set('hNombre',   datos.paciente);
      set('hEspecie',  datos.especie);
      set('hRaza',     datos.raza);
      set('hEdad',     datos.edad);
      set('hSexo',     datos.sexo);
      set('hPeso',     datos.peso);
      set('hColor',    datos.color);
      set('hTlf',      datos.telefono);
      set('hMail',     datos.correo);
      set('hDir',      datos.direccion);
      set('hTratamiento', datos.tratamiento);
      set('hFechaNac', datos.fechaNac);
      const prt = document.getElementById('hTratamientoPrint');
      if (prt && datos.tratamiento) prt.innerText = datos.tratamiento;
      // Reinsertar servicios (restaura listeners y atributos data-precio correctamente)
      if (Array.isArray(datos.servicios) && datos.servicios.length > 0) {
        const chk = setInterval(() => {
          if (typeof window.insertarServicio === 'function') {
            clearInterval(chk);
            datos.servicios.forEach(s => { if (s.nombre) window.insertarServicio(s.nombre); });
          }
        }, 200);
      }
    } else {
      localStorage.removeItem('respaldo_historia_activa');
    }
  } catch(_) { localStorage.removeItem('respaldo_historia_activa'); }

  // Auto-backup cada 30 segundos para no perder datos aunque no se toque CI o tratamiento
  setInterval(() => { window.respaldarProgresoLocal?.(); }, 30000);
});

console.log("✅ main.js v15 — auto-backup 30s, banner offline/online");
