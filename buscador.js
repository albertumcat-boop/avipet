// He mantenido tu lógica de búsqueda, pero optimicé el renderizado
function _renderResultados(registros, termino, resultDiv) {
  if (!registros.length) {
    resultDiv.innerHTML = `
      <div class="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
        <p class="text-5xl mb-3">🔍</p>
        <p class="text-slate-500 text-[11px] font-black uppercase">Sin resultados para: <b class="text-blue-500">${termino}</b></p>
      </div>`;
    return;
  }

  // Encabezado de resultados
  resultDiv.innerHTML = `
    <div class="flex items-center justify-between mb-4 px-1">
      <p class="text-sm font-black text-slate-700">
        <span class="text-blue-600 text-xl">${registros.length}</span> registro(s) encontrado(s)
      </p>
      <p class="text-[9px] font-bold text-slate-400 italic">Búsqueda: <b class="text-blue-500">${termino}</b></p>
    </div>`;

  registros.forEach(consulta => {
    const fecha = consulta.fechaSimple || "---";
    const paciente = consulta.paciente || "---";
    const prop = consulta.propietario || "---";
    const doctor = consulta.doctor || "---";
    const cedula = consulta.cedula || "---";
    
    // Formateo de precios con validación
    const venta = parseFloat(consulta.montoVenta || 0).toFixed(2);
    const insumos = parseFloat(consulta.montoInsumos || 0).toFixed(2);
    const pagoDoc = parseFloat(consulta.pagoDoctor || 0).toFixed(2);
    
    const urlFoto = consulta.urlExamen || "";
    const urlTest = consulta.urlFotoTest || "";
    const trat = consulta.tratamiento || "";
    const telefono = (consulta.telefono || "").trim();
    const fechaNac = consulta.fechaNacimiento || "";
    const inicial = paciente.charAt(0).toUpperCase();

    // Color según doctor
    const colorDoc = doctor.includes("Darwin")
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : doctor.includes("Joan")
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : "bg-slate-100 text-slate-600 border-slate-300";

    let fotosHtml = "";
    if (urlFoto || urlTest) {
      fotosHtml = `<div class="flex gap-2 mt-3 flex-wrap">`;
      if (urlFoto) fotosHtml += `<div class="relative"><img src="${urlFoto}" onclick="window.verFotoGrande('${urlFoto}')" class="w-24 h-24 object-cover rounded-xl border-2 border-blue-400 cursor-pointer hover:scale-105 transition-transform shadow-md"><span class="absolute -top-1 -right-1 bg-blue-600 text-white text-[7px] font-black px-1 rounded-full">📎</span></div>`;
      if (urlTest) fotosHtml += `<div class="relative"><img src="${urlTest}" onclick="window.verFotoGrande('${urlTest}')" class="w-24 h-24 object-cover rounded-xl border-2 border-purple-400 cursor-pointer hover:scale-105 transition-transform shadow-md"><span class="absolute -top-1 -right-1 bg-purple-600 text-white text-[7px] font-black px-1 rounded-full">🧪</span></div>`;
      fotosHtml += `</div>`;
    }

    const card = document.createElement('div');
    card.className = "bg-white border-2 border-slate-200 rounded-2xl shadow-md hover:shadow-xl hover:border-blue-400 transition-all mb-5 overflow-hidden";
    card.dataset.consultaId = consulta.id;

    card.innerHTML = `
      <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-black text-white text-xl shadow-lg border-2 border-blue-400">
            ${inicial}
          </div>
          <div>
            <p class="font-black text-white uppercase text-[15px] tracking-tight leading-none">${paciente}</p>
            <p class="text-[10px] text-slate-400 font-bold mt-0.5">${consulta.especie || ""}${consulta.raza ? " · " + consulta.raza : ""}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-[11px] font-black text-white font-mono">${fecha}</p>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-3">
          <span class="text-2xl">👤</span>
          <div class="flex-1 min-w-0">
            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Propietario</p>
            <p class="font-black text-slate-800 text-[13px] uppercase truncate">${prop}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              <span class="text-[10px] font-bold text-slate-600">🪪 CI: <b class="text-slate-800">${cedula}</b></span>
              ${telefono ? `<span class="text-[10px] font-bold text-blue-600">📞 ${telefono}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-lg"></span>
          <span class="text-[10px] font-black text-slate-500 uppercase">Atendido por:</span>
          <span class="px-3 py-1.5 rounded-full border-2 text-[11px] font-black uppercase ${colorDoc}">${doctor}</span>
        </div>

        ${trat ? `
        <div class="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-3">
          <p class="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">💊 Diagnóstico / Tratamiento</p>
          <p class="text-[11px] text-slate-700 font-bold leading-relaxed">${trat.length > 150 ? trat.substring(0,150)+"..." : trat}</p>
        </div>` : ""}

        ${fotosHtml}

        <div class="grid grid-cols-3 gap-2">
          <div class="text-center bg-slate-50 rounded-xl py-3 px-2 border border-slate-200">
            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">💰 Venta</p>
            <p class="text-[14px] font-black text-slate-800 font-mono">$${venta}</p>
          </div>
          <div class="text-center bg-amber-50 rounded-xl py-3 px-2 border border-amber-200">
            <p class="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">📦 Insumos</p>
            <p class="text-[14px] font-black text-amber-700 font-mono">$${insumos}</p>
          </div>
          <div class="text-center bg-blue-50 rounded-xl py-3 px-2 border border-blue-200">
            <p class="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">🩺 Doctor</p>
            <p class="text-[14px] font-black text-blue-700 font-mono">$${pagoDoc}</p>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button onclick="window.imprimirConsultaBuscador('${consulta.id}')" class="flex-1 text-[10px] px-4 py-2.5 rounded-xl font-black uppercase bg-slate-800 text-white hover:bg-blue-700 transition-all shadow-sm">🖨 Imprimir</button>
          <button onclick="window.enviarEncuestaDesdeCard_buscador('${telefono}','${paciente}','${cedula}','${doctor}')" class="flex-1 text-[10px] px-4 py-2.5 rounded-xl font-black uppercase bg-emerald-500 text-white hover:bg-emerald-700 transition-all shadow-sm">📲 Encuesta</button>
          <button onclick="window.eliminarConsultaDesdeCard('${consulta.id}','${paciente}')" class="text-[10px] px-4 py-2.5 rounded-xl font-black uppercase bg-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-all">🗑</button>
        </div>
      </div>`;

    window._buscadorResultados = window._buscadorResultados || {};
    window._buscadorResultados[consulta.id] = consulta;
    resultDiv.appendChild(card);
  });
}
