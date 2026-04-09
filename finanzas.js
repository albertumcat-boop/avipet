// =========================================================
// AVIPET — finanzas.js
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where,
  orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let _chartDist=null, _chartDoc=null, _chartServ=null;

function _destroyCharts() {
  if (_chartDist){_chartDist.destroy();_chartDist=null;}
  if (_chartDoc) {_chartDoc.destroy(); _chartDoc=null;}
  if (_chartServ){_chartServ.destroy();_chartServ=null;}
}

// ─── CARGAR REPORTE DEL DÍA ───
window.cargarReporte = async () => {
  const listaDiv=document.getElementById('listaReporte');
  const netoDiv =document.getElementById('repNeto');
  if (!listaDiv) return;
  listaDiv.innerHTML="<p class='text-center animate-pulse py-4 font-bold text-slate-400 text-[10px] uppercase'>🔄 SINCRONIZANDO CAJA...</p>";
  _destroyCharts();

  try {
    const hoy=`${new Date().getDate()}/${new Date().getMonth()+1}/${new Date().getFullYear()}`;
    const snapMed =await getDocs(query(collection(db,"consultas"),         where("fechaSimple","==",hoy)));
    const snapPelu=await getDocs(query(collection(db,"servicios_estetica"),where("fechaSimple","==",hoy)));
    listaDiv.innerHTML="";

    let brutoMed=0,gastosMed=0,sandoval=0,silva=0,netoMed=0;
    const serviciosConteo={};

    snapMed.forEach(d=>{
      const r=d.data();
      const venta=parseFloat(r.montoVenta)||0, gasto=parseFloat(r.montoInsumos)||0, pagoDoc=parseFloat(r.pagoDoctor)||0;
      brutoMed+=venta; gastosMed+=gasto; netoMed+=(venta-gasto-pagoDoc);
      if (r.doctor?.includes("Darwin")) sandoval+=pagoDoc; else if (r.doctor?.includes("Joan")) silva+=pagoDoc;
      if (r.paciente) serviciosConteo[r.paciente]=(serviciosConteo[r.paciente]||0)+venta;
      const color=r.doctor?.includes("Darwin")?"border-l-blue-500":"border-l-emerald-500";
      listaDiv.innerHTML+=`<div class="py-2 border-b flex justify-between items-center bg-white px-3 mb-1 rounded-lg shadow-sm border-l-4 ${color}">
        <div><p class="font-black text-[10px] uppercase text-slate-700">${r.paciente}</p><p class="text-[8px] font-bold text-slate-400 uppercase">🩺 ${r.doctor}</p></div>
        <p class="font-black text-[10px] text-slate-800">$${venta.toFixed(2)}</p></div>`;
    });

    let brutoPelu=0,pagoPelu=0,pagoAyu1=0,pagoAyuExt=0,netoPelu=0,peluUSD=0,peluBS=0;
    snapPelu.forEach(d=>{
      const r=d.data();
      const precio=parseFloat(r.precioTotal||0),pagP=parseFloat(r.pagoPeluquera||0),paA1=parseFloat(r.pagoAyudante1||0),paAx=parseFloat(r.pagoAyudanteExtra||0),netA=parseFloat(r.ingresoAvipet||0);
      const moneda=(r.metodoPago||'USD').toUpperCase(); const estatus=r.estatusPago||'pendiente';
      brutoPelu+=precio; pagoPelu+=pagP; pagoAyu1+=paA1; pagoAyuExt+=paAx; netoPelu+=netA;
      if (estatus==='pagado'){if (moneda==='BS')peluBS+=precio;else peluUSD+=precio;}
      listaDiv.innerHTML+=`<div class="py-2 border-b flex justify-between items-center bg-slate-50 px-3 mb-1 rounded-lg border-l-4 border-l-indigo-500">
        <div><p class="font-black text-[10px] uppercase text-slate-700">${r.paciente}</p><p class="text-[8px] font-bold text-indigo-400 uppercase">✂️ PELUQUERÍA</p>
        <p class="text-[8px] font-bold ${estatus==='pagado'?'text-emerald-600':'text-red-500'} uppercase">${estatus==='pagado'?'PAGADO':'PENDIENTE'} · ${moneda==='BS'?'Bs':'$'}</p></div>
        <p class="font-black text-[10px] text-slate-800">${moneda==='BS'?'Bs':'$'}${precio.toFixed(2)}</p></div>`;
    });

    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.innerText=v;};
    const totalBruto=brutoMed+brutoPelu;
    set('repBruto',`$${totalBruto.toFixed(2)}`); set('repBrutoVet',`$${brutoMed.toFixed(2)}`); set('repBrutoPelu',`$${brutoPelu.toFixed(2)}`);
    set('repGastos',`$${gastosMed.toFixed(2)}`); set('repDocSandoval',`$${sandoval.toFixed(2)}`); set('repDocSilva',`$${silva.toFixed(2)}`);
    set('fPeluTotal',`$${brutoPelu.toFixed(2)}`); set('fPeluPagos',`$${pagoPelu.toFixed(2)}`); set('fPeluAyudantes',`$${pagoAyu1.toFixed(2)}`);
    set('fPeluAyudantesExtra',`$${pagoAyuExt.toFixed(2)}`); set('fPeluCajaUsd',`$${peluUSD.toFixed(2)}`); set('fPeluCajaBs',`Bs ${peluBS.toFixed(2)}`);
    const utilidad=netoMed+netoPelu;
    if (netoDiv){netoDiv.innerText=`$${utilidad.toFixed(2)}`;netoDiv.className=utilidad>0?"text-3xl font-black text-emerald-700 font-mono":"text-3xl font-black text-orange-600 font-mono";}
    _renderCharts({brutoMed,brutoPelu,gastosMed,sandoval,silva,netoMed,netoPelu,serviciosConteo});

  } catch(e){
    console.error("Error reporte:",e);
    listaDiv.innerHTML="<p class='text-center text-red-500 font-bold text-[10px]'>❌ ERROR DE CONEXIÓN</p>";
  }
};

// ─── GRÁFICAS CHART.JS ───
function _renderCharts({brutoMed,brutoPelu,gastosMed,sandoval,silva,netoMed,netoPelu,serviciosConteo}){
  const opts={responsive:true,plugins:{legend:{labels:{font:{family:"'Segoe UI',sans-serif",weight:'bold',size:10},color:'#334155'}}}};

  const c1=document.getElementById('chartDistribucion');
  if (c1) _chartDist=new Chart(c1,{type:'doughnut',data:{
    labels:['Veterinaria','Peluquería','Insumos','Doctores'],
    datasets:[{data:[
      parseFloat((brutoMed-gastosMed-sandoval-silva).toFixed(2)),
      parseFloat(netoPelu.toFixed(2)),
      parseFloat(gastosMed.toFixed(2)),
      parseFloat((sandoval+silva).toFixed(2))
    ],backgroundColor:['#2563eb','#7c3aed','#f59e0b','#10b981'],borderWidth:2,borderColor:'#fff'}]
  },options:{...opts,cutout:'65%'}});

  const c2=document.getElementById('chartDoctores');
  if (c2) _chartDoc=new Chart(c2,{type:'bar',data:{
    labels:['Dr. Darwin','Dr. Joan'],
    datasets:[{label:'Comisión $',data:[parseFloat(sandoval.toFixed(2)),parseFloat(silva.toFixed(2))],backgroundColor:['#2563eb','#10b981'],borderRadius:8}]
  },options:{...opts,scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{color:'#64748b',font:{size:9}}},x:{grid:{display:false},ticks:{color:'#334155',font:{weight:'bold',size:10}}}},plugins:{legend:{display:false}}}});

  const c3=document.getElementById('chartServicios');
  if (c3&&Object.keys(serviciosConteo).length>0){
    const sorted=Object.entries(serviciosConteo).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const labels=sorted.map(([k])=>k.length>12?k.substring(0,12)+'…':k);
    const valores=sorted.map(([,v])=>parseFloat(v.toFixed(2)));
    _chartServ=new Chart(c3,{type:'bar',data:{labels,datasets:[{label:'Ingreso $',data:valores,backgroundColor:'#2563eb',borderRadius:6}]},
    options:{indexAxis:'y',...opts,scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{color:'#64748b',font:{size:9}}},y:{grid:{display:false},ticks:{color:'#334155',font:{weight:'bold',size:9}}}},plugins:{legend:{display:false}}}});
  }
}

// ─── GUARDAR RESUMEN DEL DÍA ───
window.guardarResumenDelDia = async () => {
  try {
    const hoy=new Date(); const fechaSimple=`${hoy.getDate()}/${hoy.getMonth()+1}/${hoy.getFullYear()}`;
    const snapV=await getDocs(collection(db,"consultas")); const snapP=await getDocs(collection(db,"servicios_estetica"));
    let bruto=0,gastos=0,pagoDoc=0,neto=0,pacientes=0,brutoVet=0,brutoPelu=0;
    const proc=(snap,tipo)=>{snap.forEach(d=>{const r=d.data();if(r.fechaSimple!==fechaSimple)return;const b=parseFloat(r.montoVenta)||0,g=parseFloat(r.montoInsumos)||0,p=parseFloat(r.pagoDoctor)||0;bruto+=b;gastos+=g;pagoDoc+=p;neto+=(b-g-p);pacientes++;if(tipo==="VET")brutoVet+=b;else brutoPelu+=b;});};
    proc(snapV,"VET"); proc(snapP,"PELU");
    await addDoc(collection(db,"resumen_caja"),{fecha:serverTimestamp(),fechaSimple,pacientes,bruto,gastos,pagoDoc,neto,brutoVet,brutoPelu});
    alert("✅ Resumen del día guardado.");
  } catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

// ─── DESCARGAR REPORTE TXT ───
window.descargarReporte = async () => {
  try {
    const hoy=new Date(); const fechaSimple=`${hoy.getDate()}/${hoy.getMonth()+1}/${hoy.getFullYear()}`;
    const snapV=await getDocs(query(collection(db,"consultas"),         where("fechaSimple","==",fechaSimple)));
    const snapP=await getDocs(query(collection(db,"servicios_estetica"),where("fechaSimple","==",fechaSimple)));
    if (snapV.empty&&snapP.empty){alert("📅 No hay registros para hoy: "+fechaSimple);return;}
    let lineas=[],bruto=0,gastos=0,pagoDoc=0,neto=0,cnt=0;
    lineas.push(`AVIPET - RESUMEN DE CAJA - ${fechaSimple}`);
    lineas.push("====================================================================");
    lineas.push(`Generado por: ${window.doctorVerificado||"Administrador"}`);
    lineas.push("====================================================================\n");
    const proc=(snap,tipo)=>{snap.forEach(d=>{const r=d.data();const b=parseFloat(r.montoVenta)||0,g=parseFloat(r.montoInsumos)||0,p=parseFloat(r.pagoDoctor)||0,n=b-g-p;bruto+=b;gastos+=g;pagoDoc+=p;neto+=n;cnt++;lineas.push(`[${cnt}] (${tipo}) PACIENTE: ${(r.paciente||"---").padEnd(15)} | DR: ${(r.doctor||"---").padEnd(15)}`);lineas.push(`    VENTA: $${b.toFixed(2).padStart(8)} | INSUMOS: $${g.toFixed(2).padStart(8)} | DOC: $${p.toFixed(2).padStart(8)} | NETO: $${n.toFixed(2).padStart(8)}`);lineas.push("--------------------------------------------------------------------");});};
    proc(snapV,"VET"); proc(snapP,"PELU");
    lineas.push("\n===================================="); lineas.push("   RESUMEN FINAL"); lineas.push("====================================");
    lineas.push(`PACIENTES:    ${cnt}`); lineas.push(`BRUTO:        $${bruto.toFixed(2)}`);
    lineas.push(`INSUMOS:      $${gastos.toFixed(2)}`); lineas.push(`PAGOS:        $${pagoDoc.toFixed(2)}`);
    lineas.push("------------------------------------"); lineas.push(`UTILIDAD:     $${neto.toFixed(2)}`); lineas.push("====================================");
    const blob=new Blob([lineas.join("\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;
    a.download=`Caja_Avipet_${fechaSimple.replace(/\//g,"-")}.txt`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  } catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

// ─── ENCUESTA DE SATISFACCIÓN ───
window.enviarEncuestaWhatsapp = () => {
  let telefono=document.getElementById('hTlf')?.value.replace(/\D/g,'')||"";
  const paciente=document.getElementById('hNombre')?.value||"", cedula=document.getElementById('hCI')?.value||"", doctor=document.getElementById('selectDoctor')?.value||"";
  if (!telefono||telefono.length<7){alert("⚠️ No hay teléfono registrado.");return;}
  if (telefono.startsWith('0')) telefono='58'+telefono.substring(1);
  if (!telefono.startsWith('58')&&telefono.length===10) telefono='58'+telefono;
  const base=`${window.location.origin}${window.location.pathname}`;
  const url=`${base}?mode=encuesta&ci=${encodeURIComponent(cedula)}&paciente=${encodeURIComponent(paciente)}&doctor=${encodeURIComponent(doctor)}`;
  const msg=encodeURIComponent(`🐾 Hola, estimado/a propietario/a de *${paciente}*.\n\nGracias por confiar en *AVIPET*.\n\nResponde nuestra encuesta (1 min):\n👉 ${url}\n\n¡Tu opinión nos ayuda a mejorar! 🙏`);
  window.open(`https://wa.me/${telefono}?text=${msg}`,'_blank');
};

window.mostrarEncuesta = (ci,paciente,doctor) => {
  const colorTx='text-blue-400';
  document.body.innerHTML=`
    <div class="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 p-6 flex flex-col items-center justify-center font-sans">
      <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div class="bg-blue-600 p-6 text-center">
          <img src="avipet.png" alt="Avipet" class="h-16 object-contain mx-auto mb-2">
          <h1 class="text-white font-black text-lg uppercase">Encuesta de Satisfacción</h1>
          <p class="text-blue-200 text-[11px]">Tu opinión es muy importante</p>
        </div>
        <div class="p-6 space-y-6">
          <div class="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Paciente atendido</p>
            <p class="font-black text-blue-700 uppercase">${paciente}</p>
            <p class="text-[10px] text-slate-400">Dr. ${doctor}</p>
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-700 uppercase mb-2">1. ¿Cómo calificarías el servicio?</label>
            <div class="flex justify-around text-3xl" id="estrellasContainer">
              ${[1,2,3,4,5].map(n=>`<span class="cursor-pointer hover:scale-125 estrella transition-transform" data-val="${n}" onclick="window.seleccionarEstrella(${n})">⭐</span>`).join('')}
            </div>
            <p id="textoEstrella" class="text-center text-[10px] font-bold text-blue-600 mt-1 h-4"></p>
            <input type="hidden" id="encCalificacion" value="">
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-700 uppercase mb-2">2. ¿Atención del Dr. ${doctor}?</label>
            <div class="grid grid-cols-3 gap-2">
              ${['Excelente 🌟','Buena 👍','Mejorable 💬'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encDoctor',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}
            </div>
            <input type="hidden" id="encDoctor" value="">
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-700 uppercase mb-2">3. ¿Volvería a visitarnos?</label>
            <div class="grid grid-cols-3 gap-2">
              ${['Sí, seguro ✅','Tal vez 🤔','No por ahora ❌'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encVolveria',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}
            </div>
            <input type="hidden" id="encVolveria" value="">
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-700 uppercase mb-2">4. ¿Cómo nos conociste?</label>
            <div class="grid grid-cols-2 gap-2">
              ${['Recomendación 🗣️','Redes Sociales 📱','Pasé por aquí 🚶','Ya era cliente ⭐'].map(op=>`<button type="button" onclick="window.seleccionarOpcion('encConocio',this)" data-val="${op}" class="opcion-btn border-2 border-slate-200 rounded-xl py-2 text-[10px] font-black text-slate-600 hover:border-blue-500 transition-all">${op}</button>`).join('')}
            </div>
            <input type="hidden" id="encConocio" value="">
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-700 uppercase mb-2">5. ¿Tienes algún comentario?</label>
            <textarea id="encComentario" rows="3" class="w-full border-2 border-slate-200 rounded-xl p-3 text-[11px] outline-none focus:border-blue-500 bg-slate-50" placeholder="Escribe aquí..."></textarea>
          </div>
          <button onclick="window.enviarEncuesta('${ci}','${paciente}','${doctor}')"
                  class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95 transition-all">
            Enviar mi Opinión 🚀
          </button>
        </div>
        <div class="text-center pb-4"><p class="text-[9px] text-slate-400">AVIPET - Centro Veterinario · Petare, Caracas</p></div>
      </div>
    </div>`;
};

window.seleccionarEstrella = (n) => {
  const textos=['','Muy malo 😞','Malo 😕','Regular 😐','Bueno 😊','Excelente 🤩'];
  document.getElementById('encCalificacion').value=n;
  document.getElementById('textoEstrella').innerText=textos[n];
  document.querySelectorAll('.estrella').forEach(s=>{
    s.style.filter=Number(s.dataset.val)<=n?'none':'grayscale(1)';
    s.style.opacity=Number(s.dataset.val)<=n?'1':'0.4';
  });
};

window.seleccionarOpcion = (campoId,btn) => {
  btn.closest('div').querySelectorAll('.opcion-btn').forEach(b=>{b.classList.remove('border-blue-500','bg-blue-50','text-blue-700');b.classList.add('border-slate-200','text-slate-600');});
  btn.classList.add('border-blue-500','bg-blue-50','text-blue-700');
  document.getElementById(campoId).value=btn.dataset.val;
};

window.enviarEncuesta = async (ci,paciente,doctor) => {
  const cal=document.getElementById('encCalificacion').value;
  if (!cal){alert("⭐ Por favor selecciona una calificación.");return;}
  const btn=document.querySelector('button[onclick^="window.enviarEncuesta"]');
  if (btn){btn.disabled=true;btn.innerText="⏳ Enviando...";}
  try {
    await addDoc(collection(db,"encuestas"),{
      ci,paciente,doctor,calificacion:Number(cal),
      atencionDoctor:document.getElementById('encDoctor')?.value||"",
      volveria:document.getElementById('encVolveria')?.value||"",
      comoNosConocio:document.getElementById('encConocio')?.value||"",
      comentario:document.getElementById('encComentario')?.value.trim()||"",
      fecha:new Date().toLocaleDateString(),timestamp:serverTimestamp()
    });
    document.body.innerHTML=`<div class="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div class="text-6xl mb-4">🎉</div>
        <h2 class="text-2xl font-black text-blue-700 uppercase mb-2">¡Gracias!</h2>
        <p class="text-slate-600 font-bold text-sm mb-1">Tu opinión fue registrada.</p>
        <p class="text-slate-400 text-[11px]">En AVIPET trabajamos cada día para brindarte el mejor cuidado. ¡Hasta la próxima! 🐾</p>
        <img src="avipet.png" alt="Avipet" class="h-16 object-contain mx-auto mt-6">
      </div></div>`;
  } catch(e){if(btn){btn.disabled=false;btn.innerText="Enviar mi Opinión 🚀";}alert("❌ Error: "+e.message);}
};

// ─── CALCULADORA BS ↔ USD ───
window.calcularConversor = () => {
  const tasa   = window.tasaDolarHoy || 36;
  const modoEl = document.getElementById('calcModo');
  const inputEl= document.getElementById('calcInput');
  const resultEl=document.getElementById('calcResultado');
  const tasaEl = document.getElementById('calcTasaMostrar');

  if (!modoEl || !inputEl || !resultEl) return;

  const modo  = modoEl.value;   // 'usdToBS' o 'bsToUSD'
  const monto = parseFloat(inputEl.value) || 0;
  if (tasaEl) tasaEl.innerText = `Tasa: Bs ${tasa.toFixed(2)} / $1`;

  if (modo === 'usdToBS') {
    const resultado = monto * tasa;
    resultEl.innerHTML = `
      <p class="text-[10px] text-slate-400 uppercase font-bold">$${monto.toFixed(2)} equivale a:</p>
      <p class="text-3xl font-black text-amber-600 font-mono">Bs ${resultado.toFixed(2)}</p>`;
  } else {
    const resultado = monto / tasa;
    resultEl.innerHTML = `
      <p class="text-[10px] text-slate-400 uppercase font-bold">Bs ${monto.toFixed(2)} equivale a:</p>
      <p class="text-3xl font-black text-emerald-600 font-mono">$ ${resultado.toFixed(2)}</p>`;
  }
};

console.log("✅ finanzas.js cargado");
