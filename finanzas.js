// =========================================================
// AVIPET — finanzas.js  v2
// CÁLCULOS COMPLETOS:
//   Veterinaria: Venta - Insumos - Pago Doctor = Neto Avipet
//   Peluquería:  Precio × 40% Peluquera, 60% Avipet
//   Desglose individual por consulta y servicio
//   Vista: Hoy / Semana / Mes
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let _chartDist = null, _chartDoc = null, _chartServ = null;
let _periodoActual = 'hoy';

function _destroyCharts() {
  if (_chartDist) { _chartDist.destroy(); _chartDist = null; }
  if (_chartDoc)  { _chartDoc.destroy();  _chartDoc  = null; }
  if (_chartServ) { _chartServ.destroy(); _chartServ = null; }
}

window.cambiarPeriodoFinanzas = (periodo) => {
  _periodoActual = periodo;
  ['hoy','semana','mes'].forEach(p => {
    const btn = document.getElementById('btnPeriodo_' + p);
    if (btn) btn.className = p === periodo
      ? 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase bg-blue-600 text-white transition-all'
      : 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
  });
  window.cargarReporte();
};

function _getFechasRango() {
  const hoy = new Date();
  const fmt  = d => d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
  if (_periodoActual === 'hoy') return [fmt(hoy)];
  if (_periodoActual === 'semana') {
    const fechas = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(hoy); d.setDate(hoy.getDate()-i); fechas.push(fmt(d)); }
    return fechas;
  }
  if (_periodoActual === 'mes') {
    const fechas = [];
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
    for (let i = 1; i <= diasMes; i++) fechas.push(i + '/' + (hoy.getMonth()+1) + '/' + hoy.getFullYear());
    return fechas;
  }
  return [fmt(hoy)];
}

window.cargarReporte = async () => {
  const listaDiv = document.getElementById('listaReporte');
  const netoDiv  = document.getElementById('repNeto');
  if (!listaDiv) return;

  const tituloP = { hoy:'Hoy', semana:'Últimos 7 días', mes:'Este mes' };
  listaDiv.innerHTML = "<p class='text-center animate-pulse py-4 font-bold text-slate-400 text-[10px] uppercase'>🔄 Cargando " + tituloP[_periodoActual] + "...</p>";
  _destroyCharts();

  try {
    const fechas = _getFechasRango();
    const snapMedAll  = await getDocs(collection(db, "consultas"));
    const snapPeluAll = await getDocs(collection(db, "servicios_estetica"));

    const consultas = [];
    const servicios = [];
    snapMedAll.forEach(d  => { const r=d.data(); if (fechas.includes(r.fechaSimple)) consultas.push(r); });
    snapPeluAll.forEach(d => { const r=d.data(); if (fechas.includes(r.fechaSimple)) servicios.push(r); });

    listaDiv.innerHTML = '';

    // ── VETERINARIA ──
    let brutoVet=0, insumosVet=0, pagoSandoval=0, pagoSilva=0;
    const serviciosConteo = {};

    if (consultas.length > 0) {
      listaDiv.innerHTML += "<p class='text-[8px] font-black text-blue-500 uppercase tracking-widest mt-2 mb-1 px-1'>🩺 VETERINARIA (" + consultas.length + " consulta" + (consultas.length>1?'s':'') + ")</p>";
      consultas.forEach(r => {
        const venta   = parseFloat(r.montoVenta   || 0);
        const gasto   = parseFloat(r.montoInsumos || 0);
        const docPago = parseFloat(r.pagoDoctor   || 0);
        const neto    = venta - gasto - docPago;
        brutoVet += venta; insumosVet += gasto;
        if (r.doctor && r.doctor.includes('Darwin')) pagoSandoval += docPago;
        else pagoSilva += docPago;
        if (r.paciente) serviciosConteo[r.paciente] = (serviciosConteo[r.paciente]||0) + venta;
        const colorDoc = r.doctor && r.doctor.includes('Darwin') ? 'border-l-blue-500' : 'border-l-emerald-500';
        listaDiv.innerHTML +=
          "<div class='py-2 border-b bg-white px-3 mb-1 rounded-lg shadow-sm border-l-4 " + colorDoc + "'>" +
            "<div class='flex justify-between items-start'>" +
              "<div><p class='font-black text-[10px] uppercase text-slate-700'>" + (r.paciente||'---') + "</p>" +
              "<p class='text-[8px] font-bold text-slate-400'>🩺 " + (r.doctor||'---') + " · " + (r.fechaSimple||'') + "</p></div>" +
              "<div class='text-right'><p class='font-black text-[10px] text-slate-800'>$" + venta.toFixed(2) + "</p>" +
              "<p class='text-[8px] text-slate-400'>Insumos: $" + gasto.toFixed(2) + "</p></div>" +
            "</div>" +
            "<div class='flex gap-3 mt-1 text-[8px]'>" +
              "<span class='text-blue-600 font-bold'>Doc: $" + docPago.toFixed(2) + "</span>" +
              "<span class='text-emerald-600 font-bold'>Neto Avipet: $" + neto.toFixed(2) + "</span>" +
            "</div>" +
          "</div>";
      });
    }

    // ── PELUQUERÍA ──
    let brutoPelu=0, pagoPeluquera=0, pagoAyu1=0, pagoAyuExt=0, netoAviPelu=0;
    let peluUSD=0, peluBS=0, peluPendiente=0;

    if (servicios.length > 0) {
      listaDiv.innerHTML += "<p class='text-[8px] font-black text-purple-500 uppercase tracking-widest mt-3 mb-1 px-1'>✂️ PELUQUERÍA (" + servicios.length + " servicio" + (servicios.length>1?'s':'') + ")</p>";
      servicios.forEach(r => {
        const precio  = parseFloat(r.precioTotal       || 0);
        const pagPelu = parseFloat(r.pagoPeluquera     || 0);
        const pagA1   = parseFloat(r.pagoAyudante1     || 0);
        const pagAx   = parseFloat(r.pagoAyudanteExtra || 0);
        const neto    = parseFloat(r.ingresoAvipet     || 0);
        const estatus = r.estatusPago || 'pendiente';
        const modo    = r.modoPago    || '';
        const usd     = parseFloat(r.montoPagadoUSD || 0);
        const bs      = parseFloat(r.montoPagadoBS  || 0);
        brutoPelu += precio; pagoPeluquera += pagPelu; pagoAyu1 += pagA1; pagoAyuExt += pagAx; netoAviPelu += neto;
        if (estatus === 'pagado') {
          if (modo === 'bs') peluBS += bs;
          else if (modo === 'mixto') { peluUSD += usd; peluBS += bs; }
          else peluUSD += usd;
        } else peluPendiente += precio;

        const colorEst = estatus === 'pagado' ? 'text-emerald-600' : 'text-red-500';
        const iconPago = modo==='bs' ? '🟡 Bs' : modo==='mixto' ? '🔀 Mixto' : '💵 USD';
        const ayuStr = (pagA1+pagAx) > 0 ? " Ayudantes: $" + (pagA1+pagAx).toFixed(2) : '';
        listaDiv.innerHTML +=
          "<div class='py-2 border-b bg-slate-50 px-3 mb-1 rounded-lg border-l-4 border-l-purple-400'>" +
            "<div class='flex justify-between items-start'>" +
              "<div><p class='font-black text-[10px] uppercase text-slate-700'>" + (r.paciente||'---') + "</p>" +
              "<p class='text-[8px] font-bold text-slate-400'>✂️ " + (r.duenio||'') + " · " + (r.fechaSimple||'') + "</p></div>" +
              "<div class='text-right'><p class='font-black text-[10px] text-slate-800'>$" + precio.toFixed(2) + "</p>" +
              "<p class='text-[8px] font-bold " + colorEst + "'>" + (estatus==='pagado'?'✅ '+iconPago:'⏳ Pendiente') + "</p></div>" +
            "</div>" +
            "<div class='flex gap-2 mt-1 text-[8px] flex-wrap'>" +
              "<span class='text-purple-600 font-bold'>Peluquera: $" + pagPelu.toFixed(2) + "</span>" +
              (pagA1+pagAx > 0 ? "<span class='text-blue-500 font-bold'>Ayudantes: $" + (pagA1+pagAx).toFixed(2) + "</span>" : '') +
              "<span class='text-emerald-600 font-bold'>Avipet: $" + neto.toFixed(2) + "</span>" +
            "</div>" +
          "</div>";
      });
    }

    if (consultas.length === 0 && servicios.length === 0) {
      listaDiv.innerHTML = "<div class='text-center py-8 text-slate-400 text-[10px] font-black uppercase italic'>Sin registros para este período</div>";
    }

    // ── TOTALES ──
    const totalDoctores = pagoSandoval + pagoSilva;
    const netoAviVet    = brutoVet - insumosVet - totalDoctores;
    const totalBruto    = brutoVet + brutoPelu;
    const netoTotal     = netoAviVet + netoAviPelu;

    const set = (id, v) => { const el=document.getElementById(id); if(el) el.innerText=v; };
    set('repBruto',           '$' + totalBruto.toFixed(2));
    set('repBrutoVet',        '$' + brutoVet.toFixed(2));
    set('repBrutoPelu',       '$' + brutoPelu.toFixed(2));
    set('repGastos',          '$' + insumosVet.toFixed(2));
    set('repDocSandoval',     '$' + pagoSandoval.toFixed(2));
    set('repDocSilva',        '$' + pagoSilva.toFixed(2));
    set('fPeluTotal',         '$' + brutoPelu.toFixed(2));
    set('fPeluPagos',         '$' + pagoPeluquera.toFixed(2));
    set('fPeluAyudantes',     '$' + pagoAyu1.toFixed(2));
    set('fPeluAyudantesExtra','$' + pagoAyuExt.toFixed(2));
    set('fPeluCajaUsd',       '$' + peluUSD.toFixed(2));
    set('fPeluCajaBs',        '$' + peluBS.toFixed(2) + ' (en Bs)');
    set('fPeluPendiente',     '$' + peluPendiente.toFixed(2));
    set('fNetoVet',           '$' + netoAviVet.toFixed(2));
    set('fNetoPelu',          '$' + netoAviPelu.toFixed(2));

    if (netoDiv) {
      netoDiv.innerText = '$' + netoTotal.toFixed(2);
      netoDiv.className = netoTotal >= 0
        ? 'text-4xl font-black text-emerald-700 font-mono'
        : 'text-4xl font-black text-red-600 font-mono';
    }

    _renderCharts({ brutoVet, brutoPelu, insumosVet, pagoSandoval, pagoSilva,
                    netoAviVet, netoAviPelu, pagoPeluquera, pagoAyu1, pagoAyuExt, serviciosConteo });

  } catch(e) {
    console.error('Error reporte:', e);
    listaDiv.innerHTML = "<p class='text-center text-red-500 font-bold text-[10px]'>❌ ERROR: " + e.message + "</p>";
  }
};

function _renderCharts({ brutoVet, brutoPelu, insumosVet, pagoSandoval, pagoSilva,
                         netoAviVet, netoAviPelu, pagoPeluquera, pagoAyu1, pagoAyuExt, serviciosConteo }) {
  const opts = { responsive:true, plugins:{ legend:{ labels:{ font:{ family:"'Segoe UI',sans-serif", weight:'bold', size:10 }, color:'#334155' } } } };

  const c1 = document.getElementById('chartDistribucion');
  if (c1) _chartDist = new Chart(c1, {
    type: 'doughnut',
    data: {
      labels: ['Avipet Vet','Avipet Pelu','Insumos','Dr. Darwin','Dr. Joan','Peluquera','Ayudantes'],
      datasets: [{ data: [
        Math.max(0, parseFloat(netoAviVet.toFixed(2))),
        Math.max(0, parseFloat(netoAviPelu.toFixed(2))),
        parseFloat(insumosVet.toFixed(2)),
        parseFloat(pagoSandoval.toFixed(2)),
        parseFloat(pagoSilva.toFixed(2)),
        parseFloat(pagoPeluquera.toFixed(2)),
        parseFloat((pagoAyu1+pagoAyuExt).toFixed(2))
      ], backgroundColor:['#1d4ed8','#7c3aed','#f59e0b','#0ea5e9','#10b981','#ec4899','#94a3b8'],
      borderWidth:2, borderColor:'#fff' }]
    },
    options: { ...opts, cutout:'60%' }
  });

  const c2 = document.getElementById('chartDoctores');
  if (c2) _chartDoc = new Chart(c2, {
    type: 'bar',
    data: { labels:['Dr. Darwin','Dr. Joan'],
      datasets:[{ label:'Comisión $', data:[parseFloat(pagoSandoval.toFixed(2)), parseFloat(pagoSilva.toFixed(2))],
      backgroundColor:['#2563eb','#10b981'], borderRadius:8 }] },
    options: { ...opts, scales:{
      y:{ beginAtZero:true, grid:{color:'#f1f5f9'}, ticks:{color:'#64748b',font:{size:9}} },
      x:{ grid:{display:false}, ticks:{color:'#334155',font:{weight:'bold',size:10}} }
    }, plugins:{ legend:{display:false} } }
  });

  const c3 = document.getElementById('chartServicios');
  if (c3 && Object.keys(serviciosConteo).length > 0) {
    const sorted = Object.entries(serviciosConteo).sort((a,b) => b[1]-a[1]).slice(0,6);
    _chartServ = new Chart(c3, {
      type: 'bar',
      data: { labels: sorted.map(([k]) => k.length>14?k.substring(0,14)+'…':k),
        datasets:[{ label:'Ingreso $', data: sorted.map(([,v]) => parseFloat(v.toFixed(2))),
        backgroundColor:'#2563eb', borderRadius:6 }] },
      options: { indexAxis:'y', ...opts,
        scales:{ x:{ beginAtZero:true, grid:{color:'#f1f5f9'}, ticks:{color:'#64748b',font:{size:9}} },
                 y:{ grid:{display:false}, ticks:{color:'#334155',font:{weight:'bold',size:9}} } },
        plugins:{ legend:{display:false} } }
    });
  }
}

window.guardarResumenDelDia = async () => {
  try {
    const hoy = new Date();
    const fechaSimple = hoy.getDate() + '/' + (hoy.getMonth()+1) + '/' + hoy.getFullYear();
    const snapV = await getDocs(query(collection(db,"consultas"),          where("fechaSimple","==",fechaSimple)));
    const snapP = await getDocs(query(collection(db,"servicios_estetica"), where("fechaSimple","==",fechaSimple)));
    let brutoVet=0,insumosVet=0,pagoDoc=0,netoVet=0,cntVet=0;
    let brutoPelu=0,pagoPelu=0,pagoAyus=0,netoPelu=0,cntPelu=0;
    snapV.forEach(d=>{ const r=d.data(); const b=parseFloat(r.montoVenta||0),g=parseFloat(r.montoInsumos||0),p=parseFloat(r.pagoDoctor||0); brutoVet+=b;insumosVet+=g;pagoDoc+=p;netoVet+=(b-g-p);cntVet++; });
    snapP.forEach(d=>{ const r=d.data(); brutoPelu+=parseFloat(r.precioTotal||0);pagoPelu+=parseFloat(r.pagoPeluquera||0);pagoAyus+=(parseFloat(r.pagoAyudante1||0)+parseFloat(r.pagoAyudanteExtra||0));netoPelu+=parseFloat(r.ingresoAvipet||0);cntPelu++; });
    await addDoc(collection(db,"resumen_caja"),{
      fecha:serverTimestamp(),fechaSimple,
      veterinaria:{pacientes:cntVet,bruto:brutoVet,insumos:insumosVet,doctores:pagoDoc,netoAvipet:netoVet},
      peluqueria:{servicios:cntPelu,bruto:brutoPelu,peluquera:pagoPelu,ayudantes:pagoAyus,netoAvipet:netoPelu},
      totales:{bruto:brutoVet+brutoPelu,netoAvipet:netoVet+netoPelu}
    });
    await Swal.fire({icon:'success',title:'✅ Resumen guardado',text:fechaSimple,timer:2000,showConfirmButton:false});
  } catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

window.descargarReporte = async () => {
  try {
    const hoy = new Date();
    const fechaSimple = hoy.getDate()+'/'+(hoy.getMonth()+1)+'/'+hoy.getFullYear();
    const snapV = await getDocs(query(collection(db,"consultas"),          where("fechaSimple","==",fechaSimple)));
    const snapP = await getDocs(query(collection(db,"servicios_estetica"), where("fechaSimple","==",fechaSimple)));
    if (snapV.empty && snapP.empty){alert("📅 No hay registros para hoy: "+fechaSimple);return;}
    let lineas=[],brutoVet=0,insumosVet=0,pagoSandoval=0,pagoSilva=0,cntVet=0;
    let brutoPelu=0,pagoPelu=0,pagoA1=0,pagoAx=0,netoPelu=0,cntPelu=0,pendiente=0;
    lineas.push("═══════════════════════════════════════════════════");
    lineas.push("        AVIPET — RESUMEN DE CAJA");
    lineas.push("        Fecha: "+fechaSimple);
    lineas.push("        Por: "+(window.doctorVerificado||"Administrador"));
    lineas.push("═══════════════════════════════════════════════════\n");
    lineas.push("─── 🩺 VETERINARIA ─────────────────────────────────");
    snapV.forEach(d=>{
      const r=d.data();const venta=parseFloat(r.montoVenta||0),gasto=parseFloat(r.montoInsumos||0),doc=parseFloat(r.pagoDoctor||0),neto=venta-gasto-doc;
      brutoVet+=venta;insumosVet+=gasto;cntVet++;
      if(r.doctor&&r.doctor.includes('Darwin'))pagoSandoval+=doc;else pagoSilva+=doc;
      lineas.push("  "+( r.paciente||'---')+" | Dr. "+(r.doctor||'---'));
      lineas.push("    Venta: $"+venta.toFixed(2)+"  Insumos: $"+gasto.toFixed(2)+"  Doc: $"+doc.toFixed(2)+"  Neto: $"+neto.toFixed(2));
    });
    const netoVet=brutoVet-insumosVet-pagoSandoval-pagoSilva;
    lineas.push("\n  SUBTOTAL VETERINARIA:");
    lineas.push("    Consultas:     "+cntVet);
    lineas.push("    Bruto:         $"+brutoVet.toFixed(2));
    lineas.push("    Insumos:       $"+insumosVet.toFixed(2));
    lineas.push("    Dr. Darwin:    $"+pagoSandoval.toFixed(2));
    lineas.push("    Dr. Joan:      $"+pagoSilva.toFixed(2));
    lineas.push("    NETO AVIPET:   $"+netoVet.toFixed(2));
    lineas.push("\n─── ✂️  PELUQUERÍA ──────────────────────────────────");
    snapP.forEach(d=>{
      const r=d.data();const precio=parseFloat(r.precioTotal||0),pPelu=parseFloat(r.pagoPeluquera||0),pA1=parseFloat(r.pagoAyudante1||0),pAx=parseFloat(r.pagoAyudanteExtra||0),neto=parseFloat(r.ingresoAvipet||0);
      const estatus=r.estatusPago||'pendiente',modo=r.modoPago||'usd';
      brutoPelu+=precio;pagoPelu+=pPelu;pagoA1+=pA1;pagoAx+=pAx;netoPelu+=neto;cntPelu++;
      if(estatus!=='pagado')pendiente+=precio;
      const iconPago=modo==='bs'?'Bs':modo==='mixto'?'Mixto':'USD';
      lineas.push("  "+(r.paciente||'---')+" | "+(r.duenio||''));
      lineas.push("    Precio: $"+precio.toFixed(2)+"  Pelu: $"+pPelu.toFixed(2)+"  Ayu: $"+(pA1+pAx).toFixed(2)+"  Avipet: $"+neto.toFixed(2)+"  ["+(estatus==='pagado'?'PAGADO '+iconPago:'PENDIENTE')+"]");
    });
    lineas.push("\n  SUBTOTAL PELUQUERÍA:");
    lineas.push("    Servicios:     "+cntPelu);
    lineas.push("    Bruto:         $"+brutoPelu.toFixed(2));
    lineas.push("    Peluquera:     $"+pagoPelu.toFixed(2));
    lineas.push("    Ayudantes:     $"+(pagoA1+pagoAx).toFixed(2));
    lineas.push("    Pendiente:     $"+pendiente.toFixed(2));
    lineas.push("    NETO AVIPET:   $"+netoPelu.toFixed(2));
    const netoTotal=netoVet+netoPelu;
    lineas.push("\n═══════════════════════════════════════════════════");
    lineas.push("  RESUMEN GENERAL");
    lineas.push("  Bruto total:    $"+(brutoVet+brutoPelu).toFixed(2));
    lineas.push("  Insumos vet:    $"+insumosVet.toFixed(2));
    lineas.push("  Dr. Darwin:     $"+pagoSandoval.toFixed(2));
    lineas.push("  Dr. Joan:       $"+pagoSilva.toFixed(2));
    lineas.push("  Peluquera:      $"+pagoPelu.toFixed(2));
    lineas.push("  Ayudantes:      $"+(pagoA1+pagoAx).toFixed(2));
    lineas.push("  ─────────────────────────────────────────────");
    lineas.push("  NETO AVIPET:    $"+netoTotal.toFixed(2));
    lineas.push("═══════════════════════════════════════════════════");
    const blob=new Blob([lineas.join("\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
    a.download="Caja_Avipet_"+fechaSimple.replace(/\//g,"-")+".txt";
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  }catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

window.enviarEncuestaWhatsapp=()=>{let telefono=document.getElementById('hTlf')?.value.replace(/\D/g,'')||"";const paciente=document.getElementById('hNombre')?.value||"",cedula=document.getElementById('hCI')?.value||"",doctor=document.getElementById('selectDoctor')?.value||"";if(!telefono||telefono.length<7){alert("⚠️ No hay teléfono registrado.");return;}if(telefono.startsWith('0'))telefono='58'+telefono.substring(1);if(!telefono.startsWith('58')&&telefono.length===10)telefono='58'+telefono;const base=window.location.origin+window.location.pathname;const url=base+"?mode=encuesta&ci="+encodeURIComponent(cedula)+"&paciente="+encodeURIComponent(paciente)+"&doctor="+encodeURIComponent(doctor);const msg=encodeURIComponent("🐾 Hola, estimado/a propietario/a de *"+paciente+"*.\n\nGracias por confiar en *AVIPET*.\n\nResponde nuestra encuesta:\n👉 "+url+"\n\n¡Tu opinión nos ayuda! 🙏");window.open("https://wa.me/"+telefono+"?text="+msg,'_blank');};
window.mostrarEncuesta=(ci,paciente,doctor)=>{document.body.innerHTML=`<div class="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 p-6 flex flex-col items-center justify-center font-sans"><div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="bg-blue-600 p-6 text-center"><img src="avipet.png" class="h-16 object-contain mx-auto mb-2"><h1 class="text-white font-black text-lg uppercase">Encuesta de Satisfacción</h1></div><div class="p-6 space-y-6"><div class="bg-blue-50 rounded-xl p-3 text-center border border-blue-100"><p class="text-[10px] font-bold text-slate-500 uppercase">Paciente</p><p class="font-black text-blue-700 uppercase">${paciente}</p><p class="text-[10px] text-slate-400">Dr. ${doctor}</p></div><div><label class="block text-[11px] font-black text-slate-700 uppercase mb-2">1. ¿Cómo calificarías el servicio?</label><div class="flex justify-around text-3xl" id="estrellasContainer">${[1,2,3,4,5].map(n=>`<span class="cursor-pointer hover:scale-125 estrella transition-transform" data-val="${n}" onclick="window.seleccionarEstrella(${n})">⭐</span>`).join('')}</div><p id="textoEstrella" class="text-center text-[10px] font-bold text-blue-600 mt-1 h-4"></p><input type="hidden" id="encCalificacion" value=""></div><div><label class="block text-[11px] font-black text-slate-700 uppercase mb-2">2. ¿Atención del Dr. ${doctor}?</label><div class="grid grid-cols-3 gap-2">${['Excelente 🌟','Buena 👍','Mejorable 💬'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encDoctor',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}</div><input type="hidden" id="encDoctor" value=""></div><div><label class="block text-[11px] font-black text-slate-700 uppercase mb-2">3. ¿Volvería a visitarnos?</label><div class="grid grid-cols-3 gap-2">${['Sí, seguro ✅','Tal vez 🤔','No por ahora ❌'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encVolveria',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}</div><input type="hidden" id="encVolveria" value=""></div><div><label class="block text-[11px] font-black text-slate-700 uppercase mb-2">4. ¿Cómo nos conociste?</label><div class="grid grid-cols-2 gap-2">${['Recomendación 🗣️','Redes Sociales 📱','Pasé por aquí 🚶','Ya era cliente ⭐'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encConocio',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}</div><input type="hidden" id="encConocio" value=""></div><div><label class="block text-[11px] font-black text-slate-700 uppercase mb-2">5. Comentario:</label><textarea id="encComentario" rows="3" class="w-full border-2 border-slate-200 rounded-xl p-3 text-[11px] outline-none focus:border-blue-500 bg-slate-50" placeholder="Escribe aquí..."></textarea></div><button onclick="window.enviarEncuesta('${ci}','${paciente}','${doctor}')" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95">Enviar mi Opinión 🚀</button></div></div></div>`;};
window.seleccionarEstrella=(n)=>{const textos=['','Muy malo 😞','Malo 😕','Regular 😐','Bueno 😊','Excelente 🤩'];document.getElementById('encCalificacion').value=n;document.getElementById('textoEstrella').innerText=textos[n];document.querySelectorAll('.estrella').forEach(s=>{s.style.filter=Number(s.dataset.val)<=n?'none':'grayscale(1)';s.style.opacity=Number(s.dataset.val)<=n?'1':'0.4';});};
window.seleccionarOpcion=(campoId,btn)=>{btn.closest('div').querySelectorAll('.opcion-btn').forEach(b=>{b.classList.remove('border-blue-500','bg-blue-50','text-blue-700');b.classList.add('border-slate-200','text-slate-600');});btn.classList.add('border-blue-500','bg-blue-50','text-blue-700');document.getElementById(campoId).value=btn.dataset.val;};
window.enviarEncuesta=async(ci,paciente,doctor)=>{const cal=document.getElementById('encCalificacion').value;if(!cal){alert("⭐ Selecciona una calificación.");return;}const btn=document.querySelector('button[onclick^="window.enviarEncuesta"]');if(btn){btn.disabled=true;btn.innerText="⏳ Enviando...";}try{await addDoc(collection(db,"encuestas"),{ci,paciente,doctor,calificacion:Number(cal),atencionDoctor:document.getElementById('encDoctor')?.value||"",volveria:document.getElementById('encVolveria')?.value||"",comoNosConocio:document.getElementById('encConocio')?.value||"",comentario:document.getElementById('encComentario')?.value.trim()||"",fecha:new Date().toLocaleDateString(),timestamp:serverTimestamp()});document.body.innerHTML=`<div class="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-6"><div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"><div class="text-6xl mb-4">🎉</div><h2 class="text-2xl font-black text-blue-700 uppercase mb-2">¡Gracias!</h2><p class="text-slate-600 font-bold text-sm">Tu opinión fue registrada.</p><img src="avipet.png" class="h-16 object-contain mx-auto mt-6"></div></div>`;}catch(e){if(btn){btn.disabled=false;btn.innerText="Enviar mi Opinión 🚀";}alert("❌ Error: "+e.message);}};

window._calcModoActual='usdToBS';
window.setCalcModo=(modo)=>{window._calcModoActual=modo;const btnUsd=document.getElementById('btnUsdToBS'),btnBs=document.getElementById('btnBsToUSD'),simbolo=document.getElementById('calcSimbolo'),modoEl=document.getElementById('calcModo');if(modoEl)modoEl.value=modo;if(btnUsd&&btnBs){if(modo==='usdToBS'){btnUsd.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all bg-blue-600 text-white shadow-sm';btnBs.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all text-slate-500';if(simbolo)simbolo.innerText='$';}else{btnBs.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all bg-amber-500 text-white shadow-sm';btnUsd.className='flex-1 py-2 rounded-lg font-black text-[11px] uppercase transition-all text-slate-500';if(simbolo)simbolo.innerText='Bs';}}const inputEl=document.getElementById('calcInput');if(inputEl?.value)window.calcularConversor();};
window.calcularConversor=()=>{const tasa=window.tasaDolarHoy||36,modo=document.getElementById('calcModo')?.value||window._calcModoActual||'usdToBS',inputEl=document.getElementById('calcInput'),resultEl=document.getElementById('calcResultado'),tasaEl=document.getElementById('calcTasaMostrar');if(!inputEl||!resultEl)return;const monto=parseFloat(inputEl.value)||0;if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";if(monto<=0){resultEl.innerHTML=`<p class="text-[10px] text-slate-400 italic font-bold uppercase">Ingresa un monto arriba</p>`;return;}if(modo==='usdToBS'){const r=monto*tasa;resultEl.innerHTML=`<p class="text-[10px] text-slate-500 uppercase font-bold mb-1">$${monto.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})} equivale a:</p><p class="text-4xl font-black text-amber-600 font-mono">Bs ${r.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p><p class="text-[9px] text-slate-400 mt-2 italic">Tasa BCV: ${tasa.toFixed(2)}</p>`;}else{const r=monto/tasa;resultEl.innerHTML=`<p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Bs ${monto.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})} equivale a:</p><p class="text-4xl font-black text-emerald-600 font-mono">$ ${r.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p><p class="text-[9px] text-slate-400 mt-2 italic">Tasa BCV: ${tasa.toFixed(2)}</p>`;}};
window.aplicarTasaManualCalc=()=>{const inp=document.getElementById('calcTasaManual'),tasa=parseFloat(inp?.value);if(!tasa||tasa<1){alert('⚠️ Ingresa una tasa válida');return;}window.tasaDolarHoy=tasa;const tasaEl=document.getElementById('calcTasaMostrar');if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";if(inp)inp.value='';window.calcularConversor();};
window.inicializarCalculadora=()=>{const tasa=window.tasaDolarHoy||36,tasaEl=document.getElementById('calcTasaMostrar');if(tasaEl)tasaEl.innerText="Tasa: Bs "+tasa.toFixed(2)+" / $1";window.setCalcModo('usdToBS');};

// ─── AJUSTAR PAGO DESDE FINANZAS ─────────────────────────
// Permite marcar como pagado servicios de días anteriores
window.ajustarPagoPeluqueria = async () => {
  // Paso 1: pedir fecha
  const resFecha = await Swal.fire({
    title: '📅 Ajustar Pago — Seleccionar Fecha',
    html: `<p class="text-[11px] text-slate-500 mb-3">¿De qué fecha son los servicios a ajustar?</p>
           <input type="date" id="swal_fecha_ajuste"
                  class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">`,
    showCancelButton: true,
    confirmButtonText: 'Ver servicios →',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const val = document.getElementById('swal_fecha_ajuste')?.value;
      if (!val) { Swal.showValidationMessage('Selecciona una fecha'); return false; }
      const [yr,mo,dy] = val.split('-');
      return parseInt(dy)+'/'+parseInt(mo)+'/'+yr;
    }
  });
  if (!resFecha.isConfirmed) return;
  const fechaSimple = resFecha.value;

  // Paso 2: cargar servicios pendientes de esa fecha
  try {
    const { getDocs, query, where, collection, updateDoc, doc, serverTimestamp } =
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const snap = await getDocs(query(collection(db,"servicios_estetica"), where("fechaSimple","==",fechaSimple)));
    if (snap.empty) {
      Swal.fire({ icon:'info', title:'Sin registros', text:'No hay servicios para: '+fechaSimple, timer:2000, showConfirmButton:false });
      return;
    }

    const pendientes = [];
    const todos = [];
    snap.forEach(d => {
      const r = d.data();
      todos.push({ id:d.id, ...r });
      if ((r.estatusPago||'pendiente') !== 'pagado') pendientes.push({ id:d.id, ...r });
    });

    if (pendientes.length === 0) {
      // Todos están pagados — mostrar opción de revertir
      const rows = todos.map(r =>
        '<div class="flex justify-between items-center py-1.5 border-b border-slate-100 text-[10px]">' +
          '<span class="font-bold text-slate-700">' + (r.paciente||'---') + ' · ' + (r.duenio||'') + '</span>' +
          '<span class="text-emerald-600 font-black">✅ $' + parseFloat(r.precioTotal||0).toFixed(2) + '</span>' +
        '</div>'
      ).join('');
      Swal.fire({ title:'✅ Todo pagado', html:'<div class="max-h-48 overflow-y-auto">'+rows+'</div>', confirmButtonText:'OK' });
      return;
    }

    // Mostrar lista de pendientes para marcar
    const rows = pendientes.map(r =>
      '<label class="flex items-center gap-2 py-1.5 border-b border-slate-100 cursor-pointer">' +
        '<input type="checkbox" class="chk-ajuste w-4 h-4 accent-blue-600" value="' + r.id + '">' +
        '<span class="text-[10px] font-bold text-slate-700 flex-1">' + (r.paciente||'---') + ' · ' + (r.duenio||'') + '</span>' +
        '<span class="text-[10px] font-black text-slate-800">$' + parseFloat(r.precioTotal||0).toFixed(2) + '</span>' +
      '</label>'
    ).join('');

    const resServ = await Swal.fire({
      title: '💰 Ajustar Pagos — ' + fechaSimple,
      html: '<p class="text-[10px] text-slate-500 mb-2">Marca los servicios que SÍ fueron pagados:</p>' +
            '<div class="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2">' + rows + '</div>' +
            '<label class="flex items-center gap-2 mt-3 cursor-pointer">' +
              '<input type="checkbox" id="chk_todos_ajuste" onchange="document.querySelectorAll('.chk-ajuste').forEach(c=>c.checked=this.checked)">' +
              '<span class="text-[10px] font-bold text-slate-600">Marcar todos</span>' +
            '</label>',
      showCancelButton: true,
      confirmButtonText: 'Continuar →',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const sel = Array.from(document.querySelectorAll('.chk-ajuste:checked')).map(c => c.value);
        if (sel.length === 0) { Swal.showValidationMessage('Marca al menos uno'); return false; }
        return sel;
      }
    });
    if (!resServ.isConfirmed) return;
    const idsAjustar = resServ.value;

    // Paso 3: elegir modalidad de pago
    const resModo = await Swal.fire({
      title: '💵 ¿Cómo pagaron?',
      html: `<div class="flex flex-col gap-2 mt-2">
        <button type="button" onclick="window._modoAjuste='usd';Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-blue-200 bg-blue-50 font-black text-sm text-blue-700 hover:bg-blue-600 hover:text-white transition-all">
          💵 Dólares (USD)
        </button>
        <button type="button" onclick="window._modoAjuste='bs';Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-amber-200 bg-amber-50 font-black text-sm text-amber-700 hover:bg-amber-500 hover:text-white transition-all">
          🟡 Bolívares (Bs)
        </button>
        <button type="button" onclick="window._modoAjuste='mixto';Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-slate-200 bg-slate-50 font-black text-sm text-slate-600 hover:bg-slate-600 hover:text-white transition-all">
          🔀 Mixto
        </button>
      </div>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar'
    });
    if (resModo.isDismissed) return;
    const modo = window._modoAjuste || 'usd';
    window._modoAjuste = null;

    // Actualizar en Firebase
    let actualizados = 0;
    for (const id of idsAjustar) {
      const serv = pendientes.find(p => p.id === id);
      const monto = parseFloat(serv?.precioTotal || 0);
      await updateDoc(doc(db,"servicios_estetica",id), {
        estatusPago:  'pagado',
        modoPago:     modo,
        montoPagadoUSD: modo === 'bs' ? 0 : monto,
        montoPagadoBS:  modo === 'bs' ? monto : (modo === 'mixto' ? monto/2 : 0),
        ajustadoManualmente: true,
        actualizadoEn: serverTimestamp()
      });
      actualizados++;
    }

    await Swal.fire({
      icon: 'success',
      title: '✅ ' + actualizados + ' servicio(s) ajustado(s)',
      text: 'Fecha: ' + fechaSimple + ' · Modalidad: ' + modo.toUpperCase(),
      timer: 2500,
      showConfirmButton: false
    });
    window.cargarReporte();

  } catch(e) { console.error(e); alert("❌ Error: "+e.message); }
};

// ─── RESUMEN SEMANAL PELUQUERÍA CON DETALLE AYUDANTE ─────
window.verResumenSemanalPelu = async () => {
  try {
    const hoy = new Date();
    const fechas = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate()-i);
      fechas.push(d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear());
    }
    const snap = await getDocs(collection(db,"servicios_estetica"));
    const servicios = [];
    snap.forEach(d => { const r=d.data(); if(fechas.includes(r.fechaSimple)) servicios.push({id:d.id,...r}); });

    if (servicios.length === 0) {
      Swal.fire({ icon:'info', title:'Sin servicios esta semana', timer:2000, showConfirmButton:false });
      return;
    }

    // Calcular totales con la nueva lógica de ayudante
    let totalBruto=0, totalPelu=0, totalAyu1=0, totalAyuExt=0, totalAvipet=0;
    let perrosConAyu=0, perrosSinAyu=0, pendiente=0;
    let rows = '';

    servicios.sort((a,b) => (a.fecha?.seconds||0)-(b.fecha?.seconds||0));

    servicios.forEach((r,i) => {
      const precio  = parseFloat(r.precioTotal||0);
      const pagPelu = parseFloat(r.pagoPeluquera||0);
      const pagA1   = parseFloat(r.pagoAyudante1||0);
      const pagAx   = parseFloat(r.pagoAyudanteExtra||0);
      const neto    = parseFloat(r.ingresoAvipet||0);
      const pagado  = r.estatusPago === 'pagado';
      const tieneA1 = pagA1 > 0;

      totalBruto  += precio;
      totalPelu   += pagPelu;
      totalAyuExt += pagAx;
      totalAvipet += neto;
      if (!pagado) pendiente += precio;

      if (tieneA1) { perrosConAyu++; totalAyu1 += pagA1; }
      else          perrosSinAyu++;

      const colorEst = pagado ? 'text-emerald-600' : 'text-red-500';
      rows += '<tr class="border-b border-slate-100 text-[9px]">' +
        '<td class="px-2 py-1.5 text-slate-500">' + (r.fechaSimple||'---') + '</td>' +
        '<td class="px-2 py-1.5 font-bold text-slate-800 uppercase">' + (r.paciente||'---') + '</td>' +
        '<td class="px-2 py-1.5 text-center font-mono">$' + precio.toFixed(2) + '</td>' +
        '<td class="px-2 py-1.5 text-center font-mono text-purple-700">$' + pagPelu.toFixed(2) + '</td>' +
        '<td class="px-2 py-1.5 text-center font-mono text-blue-600">' + (tieneA1 ? '$'+pagA1.toFixed(2) : '—') + '</td>' +
        '<td class="px-2 py-1.5 text-center font-mono ' + colorEst + '">' + (pagado?'✅':'⏳') + '</td>' +
      '</tr>';
    });

    // Pago real ayudante: $1 × perros_con_ayudante × 2
    const pagoAyu1Real = perrosConAyu * 1 * 2;

    Swal.fire({
      title: '📊 Resumen Semanal Peluquería',
      width: 750,
      html: `
        <div class="grid grid-cols-3 gap-2 mb-4 text-left">
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-[8px] font-black text-slate-400 uppercase">Total servicios</p>
            <p class="text-lg font-black text-slate-800">${servicios.length} perros</p>
            <p class="text-[9px] text-slate-500">Con ayudante: <b>${perrosConAyu}</b></p>
            <p class="text-[9px] text-slate-500">Sin ayudante: <b>${perrosSinAyu}</b></p>
          </div>
          <div class="bg-purple-50 rounded-xl p-3">
            <p class="text-[8px] font-black text-purple-400 uppercase">Peluquera</p>
            <p class="text-lg font-black text-purple-700">$${totalPelu.toFixed(2)}</p>
            <p class="text-[9px] text-slate-400">(ya descontado $1/perro)</p>
          </div>
          <div class="bg-blue-50 rounded-xl p-3">
            <p class="text-[8px] font-black text-blue-400 uppercase">Ayudante</p>
            <p class="text-lg font-black text-blue-700">$${pagoAyu1Real.toFixed(2)}</p>
            <p class="text-[9px] text-slate-400">${perrosConAyu} perros × $1 × 2</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="bg-emerald-50 rounded-xl p-3 text-center">
            <p class="text-[8px] font-black text-emerald-500 uppercase">Neto Avipet</p>
            <p class="text-base font-black text-emerald-700">$${totalAvipet.toFixed(2)}</p>
          </div>
          <div class="bg-red-50 rounded-xl p-3 text-center">
            <p class="text-[8px] font-black text-red-400 uppercase">Pendiente</p>
            <p class="text-base font-black text-red-700">$${pendiente.toFixed(2)}</p>
          </div>
          <div class="bg-slate-800 rounded-xl p-3 text-center">
            <p class="text-[8px] font-black text-slate-400 uppercase">Bruto semana</p>
            <p class="text-base font-black text-white">$${totalBruto.toFixed(2)}</p>
          </div>
        </div>
        <div style="max-height:300px;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#1e293b;color:#fff;font-size:8px;text-transform:uppercase;">
                <th style="padding:5px 8px;text-align:left;">Fecha</th>
                <th style="padding:5px 8px;text-align:left;">Mascota</th>
                <th style="padding:5px 8px;text-align:center;">Precio</th>
                <th style="padding:5px 8px;text-align:center;">Peluquera</th>
                <th style="padding:5px 8px;text-align:center;">Ayudante</th>
                <th style="padding:5px 8px;text-align:center;">Pago</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#1d4ed8'
    });

  } catch(e) { console.error(e); alert("❌ Error: "+e.message); }
};

console.log("✅ finanzas.js v2 — cálculos completos, períodos Hoy/Semana/Mes");
