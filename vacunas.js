// =========================================================
// AVIPET — vacunas.js
// CAMBIOS v2:
//   • Fecha de nacimiento aparece y se autorrellena
//     en hojas de vacunación y test rápido
//   • cambiarTipoFormato
//   • agregarFilaTest
//   • imprimirHojaVacunas / imprimirHojaTest
//   • volverAHistoriaDesdeVacunas
// =========================================================

// ─────────────────────────────────────────────
// CAMBIAR TIPO DE FORMATO
// ─────────────────────────────────────────────
window.cambiarTipoFormato = (valor) => {
  const tituloDoc = document.getElementById('tituloDocumentoDinámico');
  const subtitulo = document.getElementById('tituloFormatoDinamico');
  const bloqVac   = document.getElementById('bloqueVacunas');
  const bloqTests = document.getElementById('bloqueTests');
  if (!bloqVac || !bloqTests) return;

  if (valor === 'vacunas') {
    if (tituloDoc) tituloDoc.innerText = 'Tarjeta de Vacunación y Desparasitación';
    if (subtitulo) subtitulo.innerText = 'CONTROL DE VACUNAS';
    bloqVac.classList.remove('hidden');
    bloqTests.classList.add('hidden');
  } else if (valor === 'test_rapido') {
    if (tituloDoc) tituloDoc.innerText = 'Certificado de Diagnóstico Rápido';
    if (subtitulo) subtitulo.innerText = 'RESULTADOS DE LABORATORIO';
    bloqVac.classList.add('hidden');
    bloqTests.classList.remove('hidden');
  }
};

// ─────────────────────────────────────────────
// AGREGAR FILA DE TEST
// ─────────────────────────────────────────────
window.agregarFilaTest = (nombre) => {
  if (!nombre) return;
  const tabla = document.getElementById('cuerpoTablaCertificado');
  if (!tabla) return;
  const fila = document.createElement('tr');
  fila.className = "h-14 border-b border-slate-400 bg-white";
  fila.innerHTML = `
    <td class="px-3 font-bold uppercase italic text-slate-800">
      ${nombre === "OTRO"
        ? `<input type="text" class="w-full border-b border-blue-300 outline-none bg-transparent" placeholder="NOMBRE DEL TEST...">`
        : `<span>${nombre}</span>`}
    </td>
    <td class="px-2 text-center border-l border-r border-slate-200 relative">
      <select class="print:hidden font-black text-[11px] border rounded p-1 uppercase outline-none bg-white w-full cursor-pointer"
              onchange="
                const espejo = this.parentElement.querySelector('.resultado-print');
                const valor  = this.value;
                espejo.innerText = valor;
                const color  = valor.includes('POSITIVO') ? '#dc2626' : valor.includes('NEGATIVO') ? '#16a34a' : 'black';
                this.style.color = color; espejo.style.color = color;">
        <option value="---">---</option>
        <option value="NEGATIVO (-)">NEGATIVO (-)</option>
        <option value="POSITIVO (+)">POSITIVO (+)</option>
        <option value="INVALIDO">INVALIDO</option>
      </select>
      <span class="resultado-print font-black text-[12px] uppercase text-center" style="display:none;">---</span>
    </td>
    <td class="px-2 border-l border-slate-300">
      <input type="text" class="w-full outline-none text-[10px] bg-transparent italic" placeholder="Nota...">
    </td>
    <td class="no-print px-2 text-center">
      <button onclick="this.closest('tr').remove()" class="text-red-500 font-bold">✕</button>
    </td>`;
  tabla.appendChild(fila);
};

// ─────────────────────────────────────────────
// IMPRIMIR HOJA DE VACUNAS
// (con fecha de nacimiento)
// ─────────────────────────────────────────────
window.imprimirHojaVacunas = () => {
  // Autorrelleno de fecha de nacimiento antes de imprimir
  const fechaNac = document.getElementById('hFechaNac')?.value || "";
  const elFechaNacVac = document.getElementById('hv_fechaNacimiento');
  if (elFechaNacVac && !elFechaNacVac.value && fechaNac) {
    elFechaNacVac.value = fechaNac;
  }

  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  if (hv)   hv.classList.remove('hidden');
  if (hist) hist.classList.add('hidden');
  window.print();
  setTimeout(() => {
    if (hist) hist.classList.remove('hidden');
    if (hv)   hv.classList.add('hidden');
  }, 500);
};

// ─────────────────────────────────────────────
// IMPRIMIR HOJA DE TEST RÁPIDO
// (con fecha de nacimiento incluida)
// ─────────────────────────────────────────────
window.imprimirHojaTest = () => {
  const paciente    = document.getElementById('hNombre')?.value     || "";
  const propietario = document.getElementById('hProp')?.value       || "";
  const cedula      = document.getElementById('hCI')?.value         || "";
  const especie     = document.getElementById('hEspecie')?.value    || "";
  const raza        = document.getElementById('hRaza')?.value       || "";
  const edad        = document.getElementById('hEdad')?.value       || "";
  const sexo        = document.getElementById('hSexo')?.value       || "";
  const peso        = document.getElementById('hv_peso')?.value || document.getElementById('hPeso')?.value || "";
  const color       = document.getElementById('hColor')?.value      || "";
  const telefono    = document.getElementById('hTlf')?.value        || "";
  const direccion   = document.getElementById('hDir')?.value        || "";
  const doctor      = document.getElementById('selectDoctor')?.value || "";
  const fechaNac    = document.getElementById('hv_fechaNacimiento')?.value || document.getElementById('hFechaNac')?.value || "";
  const fecha       = new Date().toLocaleDateString();

  const filas = [];
  document.getElementById('cuerpoTablaCertificado')?.querySelectorAll('tr').forEach(tr => {
    const tdNombre    = tr.cells[0];
    const tdResultado = tr.cells[1];
    const tdNota      = tr.cells[2];
    if (!tdNombre || !tdResultado || !tdNota) return;
    const nombreTest = tdNombre.querySelector('input')?.value?.trim() || tdNombre.querySelector('span')?.innerText?.trim() || "";
    const sel        = tdResultado.querySelector('select');
    const resultado  = sel ? sel.options[sel.selectedIndex].text.toUpperCase() : "---";
    const nota       = tdNota.querySelector('input')?.value?.trim() || "";
    if (nombreTest) filas.push({ nombre: nombreTest.toUpperCase(), resultado, nota });
  });

  const fotos = [];
  document.getElementById('previewTestGallery')?.querySelectorAll('img').forEach(img => {
    if (img.src) fotos.push(img.src);
  });

  const filasHtml = filas.map(f => {
    const color = f.resultado.includes("POSITIVO") ? "#dc2626" : f.resultado.includes("NEGATIVO") ? "#16a34a" : "#334155";
    return `<tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:bold;text-transform:uppercase;background:#f8fafc;">${f.nombre}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:900;font-size:14px;color:${color};">${f.resultado}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-style:italic;color:#475569;font-size:11px;">${f.nota || '-'}</td>
    </tr>`;
  }).join("");

  const fotosHtml = fotos.length ? `
    <div style="margin-top:10px;page-break-inside:avoid;">
      <b style="font-size:11px;display:block;margin-bottom:6px;color:#1e293b;text-transform:uppercase;">Registro Fotográfico</b>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        ${fotos.map(src => `<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;text-align:center;">
          <img src="${src}" style="width:100%;height:240px;object-fit:contain;display:block;"></div>`).join("")}
      </div>
    </div>` : "";

  const win = window.open("", "_blank");
  if (!win) { alert("Habilita las ventanas emergentes para imprimir."); return; }

  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Certificado Test - ${paciente}</title>
    <style>
      @page{size:letter;margin:1.2cm 0.8cm 0.8cm 0.8cm;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:12px;padding:16px;margin:0;}
      h1{font-size:18px;margin:0;color:#7c3aed;}
      h2{font-size:13px;margin:2px 0 0;color:#64748b;}
      table{width:100%;border-collapse:collapse;}
      .bloque{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;background:#f9fafb;}
      .bloque b{display:block;margin-bottom:6px;color:#1e293b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
      .grid-info{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
      .info-item{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;}
      .info-label{font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;}
      .info-value{font-size:11px;font-weight:700;color:#1e293b;}
      @media print{.no-print{display:none!important;}}
    </style></head><body>
    <div style="border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <h1>AVIPET — Certificado de Diagnóstico Rápido</h1>
        <h2>Paciente: <b>${paciente.toUpperCase()}</b> · Propietario: ${propietario} · CI: ${cedula}</h2>
      </div>
      <div style="text-align:right;font-size:10px;color:#6b7280;">
        <div><b>${fecha}</b></div>
        <div style="color:#7c3aed;font-weight:bold;">${doctor ? "Dr(a). " + doctor : ""}</div>
      </div>
    </div>

    <div class="bloque">
      <b>Ficha del Paciente</b>
      <div class="grid-info">
        <div class="info-item"><span class="info-label">Especie</span><span class="info-value">${especie}</span></div>
        <div class="info-item"><span class="info-label">Raza</span><span class="info-value">${raza}</span></div>
        <div class="info-item"><span class="info-label">Fecha de Nac.</span><span class="info-value">${fechaNac || '---'}</span></div>
        <div class="info-item"><span class="info-label">Edad</span><span class="info-value">${edad}</span></div>
        <div class="info-item"><span class="info-label">Sexo</span><span class="info-value">${sexo}</span></div>
        <div class="info-item"><span class="info-label">Peso</span><span class="info-value">${peso} kg</span></div>
        <div class="info-item"><span class="info-label">Color</span><span class="info-value">${color}</span></div>
        <div class="info-item"><span class="info-label">Teléfono</span><span class="info-value">${telefono}</span></div>
        <div class="info-item"><span class="info-label">Dirección</span><span class="info-value">${direccion}</span></div>
      </div>
    </div>

    ${filas.length
      ? `<div class="bloque"><b>Resultados de Tests Rápidos</b>
          <table><thead><tr style="background:#ede9fe;">
            <th style="padding:8px;border:1px solid #c4b5fd;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase;">Prueba</th>
            <th style="padding:8px;border:1px solid #c4b5fd;text-align:center;font-size:11px;color:#5b21b6;text-transform:uppercase;width:140px;">Resultado</th>
            <th style="padding:8px;border:1px solid #c4b5fd;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase;">Observaciones</th>
          </tr></thead><tbody>${filasHtml}</tbody></table></div>`
      : `<div class="bloque"><p style="color:#94a3b8;font-style:italic;margin:0;">Sin tests registrados.</p></div>`}

    ${fotosHtml ? `<div class="bloque"><b>Anexos Fotográficos</b>${fotosHtml}</div>` : ""}

    <div style="margin-top:30px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">
      Documento emitido por el sistema integral AVIPET.${doctor ? ` · Médico Veterinario: <b>${doctor}</b>` : ""}
    </div>
    <div class="no-print" style="text-align:center;margin-top:20px;">
      <button onclick="window.print()" style="padding:10px 28px;background:#7c3aed;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:900;font-size:13px;">IMPRIMIR CERTIFICADO</button>
    </div>
    </body></html>`);
  win.document.close();
  win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 600);
};

// ─────────────────────────────────────────────
// VOLVER A HISTORIA
// ─────────────────────────────────────────────
window.volverAHistoriaDesdeVacunas = () => {
  document.getElementById('sectionHojaVacunas')?.classList.add('hidden');
  const hist = document.getElementById('sectionHistoria');
  if (hist) hist.classList.remove('hidden');
  else if (typeof window.showTab === 'function') window.showTab('historia');
};

// ─── BORRAR FECHA DE NACIMIENTO ───
window.borrarFechaNacVacuna = () => {
  const el = document.getElementById('hv_fechaNacimiento');
  if (!el) return;
  el.value = "";
  el.type  = "text";   // cambiar a texto para poder dejarlo vacío visualmente
  el.type  = "date";   // volver a date
  // Forzar limpieza con valueAsDate
  try { el.valueAsDate = null; } catch {}
  el.removeAttribute('value');
  el.dispatchEvent(new Event('change'));
};

console.log("✅ vacunas.js v2 cargado — fecha de nacimiento incluida");
