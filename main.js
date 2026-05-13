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

import { db } from '../firebase-config.js';

import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, onSnapshot, deleteDoc,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { enableIndexedDbPersistence }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── PERSISTENCIA OFFLINE ────────────────────────────────────
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition')
    console.warn("Persistencia: múltiples pestañas abiertas.");
});

// ============================================================
// ESTADO GLOBAL
// ============================================================
window.appState               = { doctor: "" };
window.doctorVerificado       = "";
window.doctorActivoId         = null;
window.MASTER_KEY_SISTEMA     = "AVIPET2026";
window.vacunaPagadaAnteriormente = false;
window.usuarioActivoSistema   = "";

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
    logo:    "logo_joan.png"
  }
};

const _doctores = {
  "Darwin Sandoval": { logo: "https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg" },
  "Joan Silva":      { logo: "logo_joan.png" }
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
// TASA DEL DÓLAR BCV
// ============================================================
window.tasaDolarHoy = parseFloat(localStorage.getItem('tasaDolarAvipet')) || 440.97;

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

window.validarAccesoDoctor = async (nombre) => {
  const logoD = document.getElementById('logoDerechoVacuna');
  const spacer = document.getElementById('spacerDerechoVacuna');

  if (!nombre) {
    window.doctorVerificado = "";
    const dp = document.getElementById('doctorPrint');
    if (dp) dp.innerText = "SELECCIONE DOCTOR";
    if (logoD)  { logoD.classList.add('hidden'); logoD.src = ""; }
    if (spacer) spacer.classList.remove('hidden');
    window.doctorActivoId = null;
    _aplicarPermisoDoctor(false); // Restaurar tabs al deseleccionar doctor
    return;
  }

  const pin = prompt(`ACCESO RESTRINGIDO: PIN para ${nombre.toUpperCase()}:`);
  if (!pin) {
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = "";
    return;
  }

  const ok = await window.validarDoctorConMaster(nombre, pin);
  if (ok) {
    window.doctorVerificado = nombre;
    const dp = document.getElementById('doctorPrint');
    if (dp) dp.innerText = "DR. " + nombre.toUpperCase();

    if (nombre === "Darwin Sandoval") {
      const url = "https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg";
      if (logoD)  { logoD.src = url; logoD.classList.remove('hidden'); }
      if (spacer) spacer.classList.add('hidden');
      window.onDoctorAutenticado("DR_DARWIN");
    } else {
      if (logoD)  logoD.classList.add('hidden');
      if (spacer) spacer.classList.remove('hidden');
      window.onDoctorAutenticado(nombre === "Joan Silva" ? "DR_JOAN" : null);
    }

    alert(`✅ Identidad confirmada: DR. ${nombre}`);
    if (typeof window.calcularTodo === 'function') await window.calcularTodo();
  } else {
    alert("❌ PIN INCORRECTO.");
    const sel = document.getElementById('selectDoctor');
    if (sel) sel.value = "";
    if (logoD)  logoD.classList.add('hidden');
    if (spacer) spacer.classList.remove('hidden');
  }
};

window.onDoctorAutenticado = (id) => {
  window.doctorActivoId = id;
  // Si es un doctor (no null/admin), ocultar tabs restringidos
  if (id) {
    _aplicarPermisoDoctor(true);
  } else {
    _aplicarPermisoDoctor(false);
  }
};

// Mostrar/ocultar tabs según si hay un doctor activo
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
}

// ============================================================
// VALIDACIÓN PIN DOCTORES
// ============================================================
window.validarDoctorConMaster = async (nombreDoc, pin) => {
  if (pin === window.MASTER_KEY_SISTEMA) return true;
  try {
    const snap = await getDoc(doc(db, "doctores", nombreDoc));
    if (snap.exists()) return pin === snap.data().pin;
  } catch (_) {}
  return pin === { "Darwin Sandoval": "1111", "Joan Silva": "2222" }[nombreDoc];
};

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

window.solicitarCambioPinDoctor = async () => {
  const nombre = prompt("Ingrese su nombre (Darwin Sandoval / Joan Silva):");
  if (!nombre) return;
  const clave  = prompt("🔐 Llave Maestra o PIN administrativo:");
  if (!clave) return;
  if (clave === window.MASTER_KEY_SISTEMA) {
    const np = prompt(`NUEVO PIN para ${nombre}:`);
    if (np?.length >= 4) {
      await setDoc(doc(db, "doctores", nombre), { pin: np }, { merge: true });
      alert("✅ PIN actualizado.");
    }
    return;
  }
  try {
    const s = await getDoc(doc(db, "configuracion", "seguridad"));
    const pa = s.exists() ? (s.data().pin || "AVIPET2026") : "AVIPET2026";
    if (clave === pa) {
      const np = prompt(`NUEVO PIN para ${nombre}:`);
      if (np?.length >= 4) {
        await setDoc(doc(db, "doctores", nombre), { pin: np }, { merge: true });
        alert("✅ PIN actualizado.");
      }
    } else alert("🚫 Clave incorrecta.");
  } catch (_) { alert("❌ Error al validar."); }
};

window.recuperarPin = () => {
  window.cerrarModalLogin();
  window.solicitarCambioPinDoctor();
};

// ============================================================
// LOGIN MODAL + TABS
// ============================================================
if (typeof window.tabPendiente === 'undefined') window.tabPendiente = '';

window.validarAcceso = async () => {
  const pass = document.getElementById('inputPass').value;
  const clavesPersonal = { "AVIPET2026": "Albert Peña (Master)", "2021": "daniel", "2022": "carlos" };
  let responsable = clavesPersonal[pass] || null;

  try {
    const snap = await getDoc(doc(db, "configuracion", "seguridad"));
    const pinG = snap.exists() ? (snap.data().pin || "AVIPET2026") : "AVIPET2026";
    if (!responsable && pass === pinG) responsable = "Personal General";

    if (responsable) {
      window.usuarioActivoSistema = responsable;
      await window.registrarLogAuditoria("ACCESO PROTEGIDO",
        `Entró a ${window.tabPendiente} como ${responsable}`);
      window.cerrarModalLogin();
      window.ejecutarCambioDeTab(window.tabPendiente);
    } else {
      alert("🚫 PIN Incorrecto.");
    }
  } catch (_) {
    if (responsable || pass === window.MASTER_KEY_SISTEMA) {
      window.usuarioActivoSistema = responsable || "Albert Peña (Master)";
      window.cerrarModalLogin();
      window.ejecutarCambioDeTab(window.tabPendiente);
    } else {
      alert("🚫 PIN incorrecto o sin conexión.");
    }
  }
  document.getElementById('inputPass').value = "";
};

window.cerrarModalLogin = () => {
  document.getElementById('modalLogin')?.classList.add('hidden');
  const i = document.getElementById('inputPass');
  if (i) i.value = "";
};

window.showTab = async (t) => {
  if (['config_precios', 'reporte', 'inventario'].includes(t)) {
    window.tabPendiente = t;
    const m = document.getElementById('modalLogin');
    if (m) { m.classList.remove('hidden'); document.getElementById('inputPass')?.focus(); }
    else window.ejecutarCambioDeTab(t);
    return;
  }
  window.ejecutarCambioDeTab(t);
};

window.ejecutarCambioDeTab = async (t) => {
  if (t === 'historia') limpiarLogoHistoria();

  ['sectionHistoria','sectionBuscador','sectionReporte','sectionEspera',
   'sectionHojaVacunas','sectionConfigPrecios','sectionPeluqueria','sectionInventario']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const mapa = {
    historia:'sectionHistoria', buscador:'sectionBuscador',
    reporte:'sectionReporte',   espera:'sectionEspera',
    vacunas:'sectionHojaVacunas', config_precios:'sectionConfigPrecios',
    peluqueria:'sectionPeluqueria', inventario:'sectionInventario'
  };
  document.getElementById(mapa[t])?.classList.remove('hidden');

  const tabs = { historia:'tabH', buscador:'tabB', reporte:'tabR',
                 espera:'tabE', peluqueria:'tabP', inventario:'tabInv' };
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
  if (t==='peluqueria' && typeof window.cargarBitacoraHoy ==='function') window.cargarBitacoraHoy();

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

window.cargarListaEspera = async () => {
  const cont = document.getElementById('listaEspera');
  if (!cont) return;
  cont.innerHTML = "<p class='text-center text-slate-400 text-[10px]'>Cargando...</p>";
  try {
    const snap = await getDocs(collection(db, "espera"));
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
  } catch (e) {
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
    await updateDoc(doc(db,"espera",id),{estado:"atendiendo",fechaAtencion:serverTimestamp()});
    window.showTab('historia');
    alert(`✅ ${d.paciente} cargado en historia clínica.`);
  } catch (e) { alert("❌ Error: " + e.message); }
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
window.iniciarListenerCola = () => {
  let primera = true;
  onSnapshot(collection(db,"espera"), snap => {
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

// ============================================================
// RESPALDO LOCAL
// ============================================================
window.respaldarProgresoLocal = () => {
  const area=document.getElementById('hTratamiento');
  const vis =document.getElementById('visualizacionServicios');
  if (!area||!vis) return;
  localStorage.setItem('respaldo_historia_activa', JSON.stringify({
    diagnostico: area.value, serviciosVisuales: vis.innerHTML, timestamp: Date.now()
  }));
};
document.getElementById('hTratamiento')?.addEventListener('input', window.respaldarProgresoLocal);

// ============================================================
// ARRANQUE DOMContentLoaded
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const f = new Date();
  const cf = document.getElementById('fechaDoc');
  if (cf) cf.value = `${f.getDate()}/${f.getMonth()+1}/${f.getFullYear()}`;

  const dt = document.getElementById('displayTasa');
  if (dt) dt.innerText = window.tasaDolarHoy.toFixed(2);

  window.ejecutarCambioDeTab('historia');
  window.iniciarListenerCola();

  // Recuperar respaldo
  try {
    const raw = localStorage.getItem('respaldo_historia_activa');
    if (!raw) return;
    const datos = JSON.parse(raw);
    const ok = datos.timestamp > Date.now()-(24*60*60*1000) && datos.diagnostico?.trim().length>0;
    if (!ok) return;
    if (confirm("⚠ Historia no guardada detectada.\n¿Deseas recuperar los datos?")) {
      const area=document.getElementById('hTratamiento');
      const vis =document.getElementById('visualizacionServicios');
      const prt =document.getElementById('hTratamientoPrint');
      if (area) area.value      = datos.diagnostico;
      if (vis)  vis.innerHTML   = datos.serviciosVisuales;
      if (prt)  prt.innerText   = datos.diagnostico;
    } else {
      localStorage.removeItem('respaldo_historia_activa');
    }
  } catch(_) { localStorage.removeItem('respaldo_historia_activa'); }
});
