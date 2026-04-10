// =========================================================
// AVIPET — buscador.js  v4
// Búsqueda por cédula, nombre de mascota o todo el historial
// Botón Editar → carga en Historia Clínica
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where,
  deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || "AVIPET2026";

// ─── BUSCAR ───────────────────────────────────────────────
window.buscarPorCedula = async () => {
  const inputCI     = document.getElementById('buscadorCI');
  const inputNombre = document.getElementById('buscadorNombre');
  const resultDiv   = document.getElementById('resultadoBusqueda');
  if (!resultDiv) return;

  const ci     = inputCI?.value.trim()     || "";
  const nombre = inputNombre?.value.trim().toUpperCase() || "";

  resultDiv.innerHTML = '<p class="text-blue-500 text-[10px] font-black uppercase italic text-center py-8 animate-pulse">🔍 Buscando...</p>';

  try {
    let registros = [];

    if (!ci && !nombre) {
      const snap = await getDocs(collection(db, "consultas"));
      snap.forEach(d => registros.push({ id: d.id, ...d.data() }));
    } else if (ci) {
      const snap = await getDocs(query(collection(db, "consultas"), where("cedula", "==", ci)));
      snap.forEach(d => registros.push({ id: d.id, ...d.data() }));
    } else {
      const snap = await getDocs(collection(db, "consultas"));
      snap.forEach(d => {
        const r = d.data();
        if ((r.paciente || "").toUpperCase().includes(nombre)) {
          registros.push({ id: d.id, ...r });
        }
      });
    }

    registros.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    _renderResultados(registros, ci || nombre || "TODOS", resultDiv);

  } catch (e) {
    console.error("Error buscando:", e);
    resultDiv.innerHTML = '<div class="text-center py-8 border-2 border-red-100 rounded-2xl bg-red-50"><p class="text-red-500 text-[9px] font-black uppercase">❌ Error de conexión</p></div>';
  }
};

// ─── RENDERIZAR RESULTADOS ────────────────────────────────
function _renderResultados(registros, termino, resultDiv) {
  if (!registros.length) {
    resultDiv.innerHTML = '<div class="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white"><p class="text-5xl mb-3">🔍</p><p class="text-slate-400 text-[10px] font-black uppercase italic">Sin resultados para: <b>' + termino + '</b></p></div>';
    return;
  }

  resultDiv.innerHTML = '<p class="text-[9px] font-black text-slate-400 uppercase italic mb-3 tracking-widest">' + registros.length + ' registro(s) — <b class="text-blue-600">' + termino + '</b></p>';

  window._buscadorResultados = window._buscadorResultados || {};

  registros.forEach(function(consulta) {
    var fecha    = consulta.fechaSimple    || "---";
    var paciente = consulta.paciente       || "---";
    var prop     = consulta.propietario    || "---";
    var doctor   = consulta.doctor         || "---";
    var cedula   = consulta.cedula         || "---";
    var telefono = consulta.telefono       || "---";
    var fechaNac = consulta.fechaNacimiento|| "";
    var trat     = consulta.tratamiento    || "";
    var venta    = parseFloat(consulta.montoVenta   || 0).toFixed(2);
    var insumos  = parseFloat(consulta.montoInsumos || 0).toFixed(2);
    var pagoDoc  = parseFloat(consulta.pagoDoctor   || 0).toFixed(2);
    var urlFoto  = consulta.urlExamen      || "";
    var cid      = consulta.id;

    window._buscadorResultados[cid] = consulta;

    var card = document.createElement('div');
    card.className = "bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-400 transition-all p-4 mb-3";
    card.dataset.consultaId = cid;

    var fotoHtml = urlFoto
      ? '<div class="mt-2"><img src="' + urlFoto + '" onclick="window.verFotoGrande(\'' + urlFoto + '\')" class="w-16 h-16 object-cover rounded-lg border border-blue-200 cursor-pointer hover:scale-105 transition-transform"></div>'
      : "";

    var nacHtml = fechaNac ? '<p class="text-[9px] text-slate-400">🎂 ' + fechaNac + '</p>' : "";
    var tratHtml = trat ? '<p class="italic text-slate-400 truncate text-[9px]">💊 ' + trat.substring(0, 80) + (trat.length > 80 ? "..." : "") + '</p>' : "";

    card.innerHTML =
      '<div class="flex justify-between items-start mb-2">' +
        '<div>' +
          '<p class="font-black text-slate-800 uppercase text-xs">' + paciente + '</p>' +
          '<p class="text-[9px] text-slate-400 font-bold">👤 ' + prop + ' · CI: ' + cedula + '</p>' +
          nacHtml +
        '</div>' +
        '<span class="text-[8px] font-bold text-slate-400">' + fecha + '</span>' +
      '</div>' +
      '<div class="text-[9px] text-slate-500 font-bold space-y-0.5 mb-2">' +
        '<p>🩺 <span class="text-blue-600">' + doctor + '</span></p>' +
        '<p>📞 ' + telefono + '</p>' +
        tratHtml +
      '</div>' +
      fotoHtml +
      '<div class="grid grid-cols-3 gap-1 mt-2 text-center">' +
        '<div class="bg-slate-50 rounded-lg py-1"><p class="text-[7px] font-black text-slate-400 uppercase">Venta</p><p class="text-[10px] font-black text-slate-700">$' + venta + '</p></div>' +
        '<div class="bg-slate-50 rounded-lg py-1"><p class="text-[7px] font-black text-slate-400 uppercase">Insumos</p><p class="text-[10px] font-black text-slate-700">$' + insumos + '</p></div>' +
        '<div class="bg-blue-50 rounded-lg py-1"><p class="text-[7px] font-black text-blue-400 uppercase">Doctor</p><p class="text-[10px] font-black text-blue-700">$' + pagoDoc + '</p></div>' +
      '</div>' +
      '<div class="flex gap-1.5 mt-3 flex-wrap">' +
        '<button type="button" onclick="window.imprimirConsultaBuscador(\'' + cid + '\')" class="text-[8px] px-3 py-1.5 rounded-lg font-black uppercase bg-blue-600 text-white hover:bg-blue-700">🖨 Imprimir</button>' +
        '<button type="button" onclick="window.abrirConsultaParaEditar(\'' + cid + '\')" class="text-[8px] px-3 py-1.5 rounded-lg font-black uppercase bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white">✏️ Editar</button>' +
        '<button type="button" onclick="window.enviarEncuestaDesdeCard_buscador(\'' + telefono + '\',\'' + paciente + '\',\'' + cedula + '\',\'' + doctor + '\')" class="text-[8px] px-3 py-1.5 rounded-lg font-black uppercase bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white">📲 Encuesta</button>' +
        '<button type="button" onclick="window.eliminarConsultaDesdeCard(\'' + cid + '\',\'' + paciente + '\')" class="text-[8px] px-3 py-1.5 rounded-lg font-black uppercase bg-red-100 text-red-600 hover:bg-red-600 hover:text-white">🗑 Eliminar</button>' +
      '</div>';

    resultDiv.appendChild(card);
  });
}

// ─── IMPRIMIR ─────────────────────────────────────────────
window.imprimirConsultaBuscador = function(idConsulta) {
  var consulta = window._buscadorResultados && window._buscadorResultados[idConsulta];
  if (!consulta) { alert("No se pudo recuperar los datos."); return; }

  Swal.fire({
    title: '🖨 Opciones de Impresión',
    html: '<div class="flex flex-col gap-2 mt-2 text-left"><label class="flex items-center gap-2 text-[11px]"><input type="radio" name="tipoPrint" value="completa" checked><span class="font-bold">Historia Completa</span></label><label class="flex items-center gap-2 text-[11px]"><input type="radio" name="tipoPrint" value="receta"><span class="font-bold">Solo Receta</span></label></div>',
    showCancelButton: true,
    confirmButtonText: 'Imprimir',
    cancelButtonText: 'Cancelar'
  }).then(function(res) {
    if (!res.isConfirmed) return;
    var tipo = document.querySelector('input[name="tipoPrint"]:checked') ? document.querySelector('input[name="tipoPrint"]:checked').value : "completa";
    _abrirVentanaImpresion(consulta, tipo);
  });
};

function _abrirVentanaImpresion(c, tipo) {
  var fecha    = c.fechaSimple    || new Date().toLocaleDateString();
  var paciente = c.paciente       || "---";
  var prop     = c.propietario    || "---";
  var cedula   = c.cedula         || "---";
  var especie  = c.especie        || "---";
  var raza     = c.raza           || "---";
  var edad     = c.edad           || "---";
  var sexo     = c.sexo           || "---";
  var peso     = c.peso           || "---";
  var telefono = c.telefono       || "---";
  var direccion= c.direccion      || "---";
  var fechaNac = c.fechaNacimiento|| "---";
  var doctor   = c.doctor         || "---";
  var trat     = c.tratamiento    || "Sin tratamiento.";
  var urlFoto  = c.urlExamen      || "";
  var venta    = parseFloat(c.montoVenta   || 0).toFixed(2);
  var insumos  = parseFloat(c.montoInsumos || 0).toFixed(2);
  var pagoDoc  = parseFloat(c.pagoDoctor   || 0).toFixed(2);

  var finHtml = tipo === "completa"
    ? '<div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc;"><b style="font-size:10px;text-transform:uppercase;color:#64748b;">Resumen Financiero</b><br><span style="font-size:11px;">Venta: <b>$' + venta + '</b> &nbsp;·&nbsp; Insumos: <b>$' + insumos + '</b> &nbsp;·&nbsp; Doctor: <b>$' + pagoDoc + '</b></span></div>'
    : "";

  var fotoHtml = urlFoto
    ? '<div style="margin-top:12px;text-align:center;"><img src="' + urlFoto + '" style="max-width:340px;border-radius:10px;border:1px solid #ddd;max-height:280px;object-fit:contain;"></div>'
    : "";

  var win = window.open("", "_blank");
  if (!win) { alert("Habilita ventanas emergentes."); return; }

  win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + (tipo === "receta" ? "Receta" : "Historia") + ' - ' + paciente + '</title><style>@page{size:letter;margin:1.5cm 1cm;}body{font-family:"Segoe UI",Arial,sans-serif;color:#0f172a;font-size:12px;}h1{font-size:20px;margin:0 0 2px;color:#1d4ed8;}h2{font-size:12px;color:#64748b;margin:0 0 8px;}.bloque{border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-top:10px;background:#f9fafb;}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:4px;}.label{font-size:9px;font-weight:900;text-transform:uppercase;color:#94a3b8;}.value{font-size:11px;font-weight:700;color:#1e293b;}@media print{.no-print{display:none!important;}}</style></head><body>');
  win.document.write('<div style="border-bottom:3px solid #2563eb;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;"><div><h1>AVIPET — Centro Veterinario</h1><h2>' + (tipo === "receta" ? "Receta / Tratamiento" : "Historia Clínica") + '</h2></div><div style="text-align:right;font-size:10px;color:#6b7280;"><b>' + fecha + '</b><br>Dr. ' + doctor + '</div></div>');
  win.document.write('<div class="bloque"><b style="font-size:10px;text-transform:uppercase;color:#64748b;display:block;margin-bottom:6px;">Datos del Paciente</b><div class="grid-2"><div><span class="label">Nombre</span><p class="value" style="margin:0;">' + paciente + '</p></div><div><span class="label">Especie / Raza</span><p class="value" style="margin:0;">' + especie + ' · ' + raza + '</p></div><div><span class="label">Propietario</span><p class="value" style="margin:0;">' + prop + '</p></div><div><span class="label">Cédula</span><p class="value" style="margin:0;">' + cedula + '</p></div><div><span class="label">F. Nacimiento</span><p class="value" style="margin:0;">' + fechaNac + '</p></div><div><span class="label">Edad / Sexo / Peso</span><p class="value" style="margin:0;">' + edad + ' · ' + sexo + ' · ' + peso + ' kg</p></div><div><span class="label">Teléfono</span><p class="value" style="margin:0;">' + telefono + '</p></div><div><span class="label">Dirección</span><p class="value" style="margin:0;">' + direccion + '</p></div></div></div>');
  win.document.write('<div class="bloque"><b style="font-size:10px;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Tratamiento / Receta</b><pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;margin:0;">' + trat + '</pre></div>');
  win.document.write(finHtml + fotoHtml);
  win.document.write('<div style="margin-top:30px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px;">AVIPET · ' + fecha + '</div>');
  win.document.write('<div class="no-print" style="text-align:center;margin-top:16px;"><button onclick="window.print()" style="padding:10px 24px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:900;">IMPRIMIR</button></div>');
  win.document.write('</body></html>');
  win.document.close();
  win.onload = function() { setTimeout(function() { win.focus(); win.print(); }, 400); };
}

// ─── ELIMINAR ─────────────────────────────────────────────
window.eliminarConsultaDesdeCard = async function(idConsulta, nombrePaciente) {
  var clave = prompt('🔐 Eliminar historial de: "' + nombrePaciente + '"\nIngresa la CLAVE MAESTRA:');
  if (!clave) return;
  if (clave.trim() !== MASTER_KEY()) { alert("🚫 Clave incorrecta."); return; }
  if (!confirm('⚠️ Eliminar permanentemente el historial de "' + nombrePaciente + '".\n¿Confirmas?')) return;
  try {
    await deleteDoc(doc(db, "consultas", idConsulta));
    if (typeof window.registrarLogAuditoria === "function") {
      await window.registrarLogAuditoria("ELIMINACIÓN", "Eliminó historial de " + nombrePaciente);
    }
    await Swal.fire({ icon: "success", title: "✅ Eliminado", timer: 1500, showConfirmButton: false });
    var card = document.querySelector('[data-consulta-id="' + idConsulta + '"]');
    if (card) card.remove();
    if (window._buscadorResultados) delete window._buscadorResultados[idConsulta];
  } catch (e) {
    console.error(e);
    alert("❌ Error: " + e.message);
  }
};

// ─── ENCUESTA ─────────────────────────────────────────────
window.enviarEncuestaDesdeCard_buscador = function(telefonoRaw, paciente, cedula, doctor) {
  var telefono = (telefonoRaw || "").replace(/\D/g, "");
  if (!telefono || telefono.length < 7) { alert("⚠️ Sin teléfono válido."); return; }
  if (telefono.startsWith("0")) telefono = "58" + telefono.substring(1);
  if (!telefono.startsWith("58") && telefono.length === 10) telefono = "58" + telefono;
  var base = window.location.origin + window.location.pathname;
  var url  = base + "?mode=encuesta&ci=" + encodeURIComponent(cedula) + "&paciente=" + encodeURIComponent(paciente) + "&doctor=" + encodeURIComponent(doctor);
  var msg  = encodeURIComponent("🐾 Hola, propietario/a de *" + paciente + "*.\n\nGracias por confiar en *AVIPET*.\nResponde nuestra encuesta:\n👉 " + url + "\n\n¡Tu opinión nos ayuda! 🙏");
  window.open("https://wa.me/" + telefono + "?text=" + msg, "_blank");
};

// ─── VER FOTO GRANDE ──────────────────────────────────────
window.verFotoGrande = function(url) {
  var modal = document.getElementById("modalFotoGrande");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalFotoGrande";
    modal.className = "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4";
    modal.onclick = function(e) { if (e.target === modal) window.cerrarModalFoto(); };
    modal.innerHTML = '<div class="relative max-w-3xl w-full"><button onclick="window.cerrarModalFoto()" class="absolute -top-4 -right-4 bg-white text-slate-800 rounded-full w-9 h-9 font-black text-lg flex items-center justify-center shadow-lg hover:bg-red-100 z-10">✕</button><img id="fotoGrandeImg" src="" class="w-full rounded-2xl border-4 border-white shadow-2xl object-contain max-h-[80vh]"></div>';
    document.body.appendChild(modal);
  }
  document.getElementById("fotoGrandeImg").src = url;
  modal.classList.remove("hidden");
};

window.cerrarModalFoto = function() {
  document.getElementById("modalFotoGrande") && document.getElementById("modalFotoGrande").classList.add("hidden");
};

console.log("✅ buscador.js v4 cargado — sintaxis limpia");
