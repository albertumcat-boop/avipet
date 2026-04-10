// =========================================================
// AVIPET — historia.js  v3
// NUEVO: alerta automática de stock bajo al agregar vacunas/meds
//        recordatorio de próxima vacuna vencida al autocompletar
//        notas internas por paciente (campo observacionesPermanentes)
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, updateDoc,
  getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { respaldarProgresoLocal } from './main.js';

const normalizarNombre = (str) =>
  String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");

const recetas = {
  "CONSULTA GENERAL":           { precioVenta:30,  insumos:[{nombre:"Crema",costo:0.50}] },
  "CONSULTA OFTALMOLÓGICA":     { precioVenta:80,  insumos:[{nombre:"Tiras Fluoresceína",costo:2.50}] },
  "CONSULTA CAMADA 3-4 CACHORROS":      { precioVenta:50,  insumos:[{nombre:"Insumos Camada",costo:2.00}] },
  "CONSULTA CAMADA HASTA 8 CACHORROS":  { precioVenta:80,  insumos:[{nombre:"Insumos Camada Grande",costo:4.00}] },
  "CONSULTA CAMADA MAS DE 8 CACHORROS": { precioVenta:100, insumos:[{nombre:"Insumos Camada XL",costo:6.00}] },
  "CONSULTA DE EMERGENCIA":     { precioVenta:40,  insumos:[{nombre:"Crema",costo:0.50}] },
  "ABSCESO":                    { precioVenta:25,  insumos:[{nombre:"Jelco",costo:4.50},{nombre:"Agua Oxigenada",costo:0.50},{nombre:"Compresa",costo:0.50},{nombre:"Antibiotico",costo:0.50},{nombre:"Antinflamatorio",costo:0.50},{nombre:"Sedacion",costo:0.50}] },
  "ECOGRAFÍA":                  { precioVenta:30,  insumos:[{nombre:"Gel Ecográfico",costo:1.00},{nombre:"Papel Absorbente",costo:0.50}] },
  "COLOCACION VIA":             { precioVenta:15,  insumos:[{nombre:"Jelco",costo:1.50},{nombre:"Jeringa 5cc",costo:0.50},{nombre:"Adhesivo",costo:0.30},{nombre:"Mariposa",costo:1.00},{nombre:"Obturador",costo:1.00}] },
  "ADMINISTRACION MEDICINA":    { precioVenta:10,  insumos:[{nombre:"Jeringa",costo:0.50}] },
  "TOMA DE MUESTRA SANGRE":     { precioVenta:10,  insumos:[{nombre:"Jeringa",costo:0.50},{nombre:"Mariposa",costo:1.00},{nombre:"Tubo",costo:1.20}] },
  "VACUNA SEXTUPLE":            { precioVenta:40,  insumos:[{nombre:"Vial Sextuple",costo:8.50}] },
  "VACUNA PUPPY":               { precioVenta:40,  insumos:[{nombre:"Vial Puppy",costo:7.00}] },
  "VACUNA ANTIRRÁBICA":         { precioVenta:30,  insumos:[{nombre:"Vial Antirrábica",costo:4.00}] },
  "VACUNA KC (TOS DE LAS PERRERAS)": { precioVenta:45, insumos:[{nombre:"Vial KC",costo:9.00}] },
  "VACUNA TRIPLE FELINA":       { precioVenta:45,  insumos:[{nombre:"Vial Triple Felina",costo:10.00}] },
  "VACUNA QUINTUPLE FELINA":    { precioVenta:50,  insumos:[{nombre:"Vial Quintuple Felina",costo:15.00}] },
  "VACUNA BIOVETA":             { precioVenta:60,  insumos:[{nombre:"Vial Bioveta",costo:6.50}] },
  "HEMATOLOGÍA COMPLETA":       { precioVenta:23,  insumos:[{nombre:"Tubo EDTA",costo:4.50}] },
  "QUÍMICA SANGUÍNEA":          { precioVenta:60,  insumos:[{nombre:"Tubo Seco - Reactivos",costo:10.00}] },
  "DESCARTE HEMOPARASITO":      { precioVenta:50,  insumos:[{nombre:"Test Hemoparásitos",costo:9.00}] },
  "DISTEMPER":                  { precioVenta:35,  insumos:[{nombre:"Kit Test Distemper",costo:11.00}] },
  "PARVOVIRUS - CORONAVIRUS":   { precioVenta:35,  insumos:[{nombre:"Kit Test Parvo",costo:12.00}] },
  "FILARIASIS":                 { precioVenta:40,  insumos:[{nombre:"Kit Filarias",costo:11.00}] },
  "SIDA - LEUCEMIA":            { precioVenta:40,  insumos:[{nombre:"Kit Sida-Leucemia",costo:15.00}] },
  "TEST HELICOBACTER PYLORI AG":{ precioVenta:40,  insumos:[{nombre:"Kit Helicobacter",costo:20.00}] },
  "HEMATOLOGIA + QUIMICA + HEMOPARASITOS": { precioVenta:110,insumos:[{nombre:"Pack Lab Completo",costo:25.00}] },
  "EXAMEN DE HECES":            { precioVenta:10,  insumos:[{nombre:"Portas - Solución",costo:1.50}] },
  "EXAMENES DE ORINA":          { precioVenta:10,  insumos:[{nombre:"Tira Reactiva",costo:2.00}] },
  "CITOLOGIA 1 OIDO":           { precioVenta:15,  insumos:[{nombre:"Hisopo - Tincion",costo:2.50}] },
  "CITOLOGIA 2 OIDOS":          { precioVenta:20,  insumos:[{nombre:"Hisopos - Tinciones",costo:4.00}] },
  "RASPADO PIEL":               { precioVenta:10,  insumos:[{nombre:"Hoja Bisturí",costo:3.00}] },
  "PERFIL ANEMICO":             { precioVenta:25,  insumos:[{nombre:"Kit Anemia",costo:8.00}] },
  "EUTANASIA HASTA 5KG":        { precioVenta:80,  insumos:[{nombre:"Propofol",costo:4.00},{nombre:"Xilacina",costo:1.00}] },
  "EUTANASIA HASTA 15KG":       { precioVenta:110, insumos:[{nombre:"Propofol",costo:7.00},{nombre:"Xilacina",costo:2.00}] },
  "EUTANASIA HASTA 25KG":       { precioVenta:140, insumos:[{nombre:"Propofol",costo:10.00},{nombre:"Xilacina",costo:3.00}] },
  "EUTANASIA HASTA 35KG":       { precioVenta:170, insumos:[{nombre:"Propofol",costo:15.00},{nombre:"Xilacina",costo:4.00}] },
  "REFERIDO: EXAMEN DE HECES":  { precioVenta:10,  insumos:[{nombre:"Pago Lab Externo",costo:5.00}] },
  "REFERIDO: EXAMENES DE ORINA":{ precioVenta:10,  insumos:[{nombre:"Pago Lab Externo",costo:5.00}] },
  "REFERIDO: CULTIVOS":         { precioVenta:30,  insumos:[{nombre:"Pago Lab Externo",costo:15.00}] },
  "REFERIDO: DESCARTE HEMOPARASITO": { precioVenta:40, insumos:[{nombre:"Pago Lab Externo",costo:20.00}] },
  "REFERIDO: DISTEMPER":        { precioVenta:35,  insumos:[{nombre:"Pago Lab Externo",costo:17.50}] },
  "REFERIDO: PARVOVIRUS - CORONAVIRUS": { precioVenta:35, insumos:[{nombre:"Pago Lab Externo",costo:17.50}] },
};

const CONFIG_PORC = {
  "CONSULTA GENERAL":40,"CONSULTA OFTALMOLÓGICA":12.5,
  "CONSULTA CAMADA 3-4 CACHORROS":40,"CONSULTA CAMADA HASTA 8 CACHORROS":40,
  "CONSULTA CAMADA MAS DE 8 CACHORROS":40,"CONSULTA DE EMERGENCIA":40,
  "ABSCESO":50,"ECOGRAFÍA":40,"COLOCACION VIA":50,
  "ADMINISTRACION MEDICINA":50,"TOMA DE MUESTRA SANGRE":50,
  "HEMATOLOGÍA COMPLETA":34.78,"PERFIL ANEMICO":17.5,
};

const insumosFijosMedicos = [{nombre:"Guantes de examen",costo:0.50},{nombre:"Alcohol",costo:0.10},{nombre:"Algodón",costo:0.10},{nombre:"Hojas - Papelería",costo:0.10}];
const insumosBaseVacuna   = [{nombre:"Jeringa 3cc",costo:0.25},{nombre:"Xeruk",costo:0.10},{nombre:"Crema",costo:0.10}];

const CONFIG_MEDICAMENTOS = {
  "Piroyet":{precioCliente:10},"Enrofloxacina":{precioCliente:5},"Sulfatrim":{precioCliente:5},
  "Dexametasona":{precioCliente:4},"Carprofen":{precioCliente:10},"Flunixin":{precioCliente:5},
  "Metadol":{precioCliente:5},"Complejo B":{precioCliente:5},"Suero hiperinmune":{precioClientePorMl:10},
  "Bromuro de hioscina":{precioCliente:10},"Fenobarbital":{precioCliente:5},"Gastrine":{precioCliente:7},
  "Ranitidina":{precioCliente:5},"Metoclopramida":{precioCliente:5},"Furosemina":{precioCliente:5},
  "Vit K":{precioCliente:5},"Eritrogen":{precioCliente:5},"Aminovit":{precioCliente:10},
  "Oxitetraciclina":{precioCliente:5},"Pimobendan":{precioCliente:0},"Ceftriaxona":{precioCliente:12},
  "Adrenalina / Epin":{precioCliente:14},"Artrosan":{precioCliente:20},"Lisavac":{precioCliente:5},
  "Soroglobulin":{precioCliente:25},"Infervac":{precioCliente:0},
  "OTRO":{precioCliente:0}
};

let insumosBaseMedAgregados = false;

// ─── COMPRESOR ───
const comprimirImagen = (b64, maxW=800, q=0.55) => new Promise(res=>{
  const img=new Image();img.src=b64;img.onload=()=>{
    const c=document.createElement('canvas');let w=img.width,h=img.height;
    if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.fillStyle="#FFF";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    res(c.toDataURL('image/jpeg',q));};img.onerror=()=>res(b64);
});

// ─── ALERTA STOCK BAJO ───
async function _verificarStockServicio(nombreServicio) {
  try {
    const vLimpio = normalizarNombre(nombreServicio);
    // Buscar en inventario productos relacionados con el servicio
    const snap = await getDocs(collection(db, "inventario"));
    const alertas = [];
    snap.forEach(d => {
      const r = d.data();
      const nomInv = normalizarNombre(r.nombre || "");
      // Detectar si el producto del inventario está relacionado con el servicio
      const esRelacionado =
        (vLimpio.includes("vacuna") && (nomInv.includes("vial") || nomInv.includes("vacuna"))) ||
        (vLimpio.includes("hematolo") && nomInv.includes("tubo")) ||
        (vLimpio.includes("quimica") && (nomInv.includes("tubo") || nomInv.includes("reactivo")));
      if (esRelacionado) {
        const stock = parseFloat(r.cantidadStock || 0);
        const min   = parseFloat(r.stockMinimo   || 3);
        if (stock <= min) alertas.push({ nombre: r.nombre, stock, min });
      }
    });
    if (alertas.length > 0) {
      const lista = alertas.map(a => `• ${a.nombre}: ${a.stock} unidades (mín: ${a.min})`).join('\n');
      await Swal.fire({
        icon: 'warning',
        title: '⚠️ Stock Bajo en Inventario',
        html: `<p class="text-[11px] text-slate-600 mb-2">El siguiente producto está bajo o agotado:</p>
               <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                 <pre class="text-[11px] text-amber-800 font-bold whitespace-pre-wrap">${lista}</pre>
               </div>
               <p class="text-[10px] text-slate-400 mt-2 italic">Recuerda actualizar el inventario.</p>`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#f59e0b',
        timer: 6000,
        timerProgressBar: true
      });
    }
  } catch { /* silencioso — no bloquear flujo */ }
}

// ─── INSERTAR SERVICIO ───
// ─── RECALCULAR COMBOS ───────────────────────────────────────────────────────
// Se llama SIEMPRE después de insertar o eliminar cualquier servicio.
// Lee el DOM completo y ajusta precios según lo que realmente está en la lista.
//
// REGLAS:
//   KC sola        → $45  |  KC + otra vacuna      → $40
//   Antirrábica sola → $30  |  Antirrábica + otra vacuna → $25
//   Hematología sola → $23  |  Hematología + otro lab    → $20
// ─────────────────────────────────────────────────────────────────────────────
function _recalcularCombos() {
  const filas = Array.from(document.querySelectorAll('.servicio-principal'));
  const nombres = filas.map(f => normalizarNombre(f.querySelector('td')?.innerText || ""));

  filas.forEach((fila, idx) => {
    const n   = nombres[idx];
    const td  = fila.querySelector('td');
    if (!td) return;

    // ── KC ──
    if (n.includes("vacunakc")) {
      // hay otra vacuna en la lista (distinta de KC)?
      const hayOtraVacuna = nombres.some((o, i) => i !== idx && o.includes("vacuna") && !o.includes("vacunakc"));
      const precioNuevo   = hayOtraVacuna ? 40 : 45;
      const textoCombo    = hayOtraVacuna ? " (Combo)" : "";
      const precioActual  = parseFloat(fila.getAttribute('data-precio')) || 0;

      if (precioActual !== precioNuevo) {
        fila.setAttribute('data-precio', precioNuevo);
        // Actualizar texto visible en la celda
        td.innerHTML = td.innerHTML
          .replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)}`)
          .replace(/\s*\(Combo\)/gi, "") + (hayOtraVacuna ? "" : "");
        // Limpiar y poner (Combo) solo si aplica
        td.innerHTML = td.innerHTML.replace(/\(Combo\)/gi, "");
        if (hayOtraVacuna) {
          td.innerHTML = td.innerHTML.replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)} (Combo)`);
        }
      }
    }

    // ── ANTIRRÁBICA ──
    if (n.includes("vacunaantirrabica")) {
      const hayOtraVacuna = nombres.some((o, i) => i !== idx && o.includes("vacuna") && !o.includes("antirrabica"));
      const precioNuevo   = hayOtraVacuna ? 25 : 30;
      const precioActual  = parseFloat(fila.getAttribute('data-precio')) || 0;

      if (precioActual !== precioNuevo) {
        fila.setAttribute('data-precio', precioNuevo);
        td.innerHTML = td.innerHTML.replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)}`);
        td.innerHTML = td.innerHTML.replace(/\(Combo\)/gi, "");
        if (hayOtraVacuna) {
          td.innerHTML = td.innerHTML.replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)} (Combo)`);
        }
      }
    }

    // ── HEMATOLOGÍA ──
    if (n.includes("hematologiacompleta")) {
      const otrosLabs = ["quimica","hemoparasito","heces","orina","perfil","citologia"];
      const hayOtroLab = nombres.some((o, i) => i !== idx && otrosLabs.some(lab => o.includes(lab)));
      const precioNuevo  = hayOtroLab ? 20 : 23;
      const precioActual = parseFloat(fila.getAttribute('data-precio')) || 0;

      if (precioActual !== precioNuevo) {
        fila.setAttribute('data-precio', precioNuevo);
        td.innerHTML = td.innerHTML.replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)}`);
        td.innerHTML = td.innerHTML.replace(/\(Combo\)/gi, "");
        if (hayOtroLab) {
          td.innerHTML = td.innerHTML.replace(/\$\d+\.\d{2}/, `$${precioNuevo.toFixed(2)} (Combo)`);
        }
      }
    }
  });

  // Recalcular totales después de ajustar precios
  window.calcularTodo();
}

window.insertarServicio = async (v) => {
  if (!v) return;
  const visual=document.getElementById('visualizacionServicios');
  const vLimpio=normalizarNombre(v);
  let nombreFinal=v,precioFinal=0,porcServ=30;
  try{const snap=await getDoc(doc(db,"servicios_maestro",v));if(snap.exists()){precioFinal=parseFloat(snap.data().precioVenta)||0;porcServ=parseFloat(snap.data().porcDoc??snap.data().porcentajeDoc??30);}else{const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);precioFinal=lrec?recetas[lrec].precioVenta:0;porcServ=CONFIG_PORC[v]??30;}}
  catch{const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);precioFinal=lrec?recetas[lrec].precioVenta:0;porcServ=CONFIG_PORC[v]??30;}

  if(vLimpio.includes("kgadicional")){const kgs=prompt("KGs adicionales:");if(!kgs||isNaN(kgs)){document.getElementById('selectorServicios').value="";return;}nombreFinal=`KG ADICIONAL (${parseFloat(kgs)}kg)`;precioFinal=parseFloat(kgs)*7;porcServ=0;}
  else if(vLimpio==="disposicion"||vLimpio==="cremacionconcenizas"){const m=prompt(`Precio pactado para ${v}:`);if(!m||isNaN(m)){document.getElementById('selectorServicios').value="";return;}precioFinal=parseFloat(m);porcServ=0;}
  else if(vLimpio.includes("vacunakc")){
    // Precio base: solo → $45, en combo con otra vacuna → $40
    // Se inserta primero con precio base; _recalcularCombos lo ajusta al final
    precioFinal=45;
  }
  else if(vLimpio.includes("hematologiacompleta")){
    // Precio base: solo → $23, en combo con otro lab → $20
    precioFinal=23;
  }
  else if(vLimpio.includes("vacunaantirrabica")){
    // Precio base: solo → $30, en combo con otra vacuna → $25
    precioFinal=30;
  }

  const grupoID="srv-"+Date.now();
  if(visual){if(visual.innerText.includes("Sin servicios"))visual.innerHTML="";const badge=document.createElement('div');badge.id="badge-"+grupoID;badge.className="bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-200 mb-1 flex items-center gap-2";badge.innerHTML=`<span>🔹</span><span class="flex-1">${nombreFinal}</span>`;visual.appendChild(badge);}
  document.getElementById('contenedorInsumos').classList.remove('hidden');
  const cuerpo=document.getElementById('listaInsumosDinamica');
  const ft=document.createElement('tr');ft.className="bg-slate-50 border-b-2 border-slate-200 text-slate-700 font-black servicio-principal";ft.setAttribute('data-grupo',grupoID);ft.setAttribute('data-precio',precioFinal);ft.setAttribute('data-porc',porcServ);
  ft.innerHTML=`<td colspan="3" class="p-2 text-[11px] uppercase">🔹 ${nombreFinal} ($${precioFinal.toFixed(2)})<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2 text-[9px] border border-blue-200">${porcServ.toFixed(1)}% DOC</span></td><td class="p-2 text-center"><button onclick="window.eliminarServicioCompleto('${grupoID}',${precioFinal},event)" class="text-red-500 font-bold text-lg">×</button></td>`;
  cuerpo.appendChild(ft);

  let insNuevos=[];
  if(cuerpo.querySelectorAll('.servicio-principal').length===1)insNuevos=[...insumosFijosMedicos];
  if(vLimpio.includes("vacuna")){const yaHayVial=Array.from(cuerpo.querySelectorAll('td')).some(td=>td.innerText.includes("Vial"));if(!yaHayVial)insNuevos=[...insNuevos,...insumosBaseVacuna];}
  const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);
  if(lrec&&recetas[lrec].insumos)insNuevos=[...insNuevos,...recetas[lrec].insumos];

  insNuevos.forEach(ins=>{const tr=document.createElement('tr');tr.className=`border-b border-gray-100 insumo-fila ${grupoID}`;tr.innerHTML=`<td class="p-2 font-bold text-gray-700 text-[11px] italic">${ins.nombre.toUpperCase()}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${ins.costo.toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td><td class="p-2 text-center text-red-500 font-bold cursor-pointer" onclick="this.parentElement.remove();window.calcularTodo()">✕</td>`;cuerpo.appendChild(tr);});

  await window.calcularTodo();
  document.getElementById('selectorServicios').value="";
  respaldarProgresoLocal();
  // Recalcular precios de combos DESPUÉS de insertar (actualiza los ya existentes)
  _recalcularCombos();
  // Verificar stock DESPUÉS de insertar
  _verificarStockServicio(v);
};

// ─── AGREGAR MEDICAMENTO ───
window.agregarMedicamento = async (nombreMed) => {
  if (!nombreMed) return;
  if (nombreMed==="OTRO") {
    const res=await Swal.fire({title:'💊 Agregar Medicamento',html:`<div class="space-y-3 text-left mt-2"><div><label class="text-[10px] font-black text-slate-600 uppercase block mb-1">Nombre del medicamento</label><input type="text" id="swal_med_nombre" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-blue-500" placeholder="Ej: Clopidogrel..."></div><div><label class="text-[10px] font-black text-slate-600 uppercase block mb-1">Costo para el cliente ($)</label><input type="number" id="swal_med_costo" step="0.50" min="0" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-blue-500" placeholder="0.00"></div></div>`,showCancelButton:true,confirmButtonText:'➕ Agregar',cancelButtonText:'Cancelar',confirmButtonColor:'#7c3aed',preConfirm:()=>{const nombre=document.getElementById('swal_med_nombre')?.value.trim();const costo=parseFloat(document.getElementById('swal_med_costo')?.value)||0;if(!nombre){Swal.showValidationMessage("⚠️ Escribe el nombre.");return false;}if(costo<0){Swal.showValidationMessage("⚠️ Costo no puede ser negativo.");return false;}return{nombre,costo};}});
    if(!res.isConfirmed){document.getElementById('selectorMedicamentos').value="";return;}
    _insertarMedicamentoEnTabla(res.value.nombre,res.value.costo);document.getElementById('selectorMedicamentos').value="";return;
  }
  const cfg=CONFIG_MEDICAMENTOS[nombreMed];if(!cfg)return;
  let precioCliente=0,descripcion=nombreMed;
  if(nombreMed==="Suero hiperinmune"){const ml=prompt("Cantidad (ml):");if(!ml||isNaN(ml)||parseFloat(ml)<=0){document.getElementById('selectorMedicamentos').value="";return;}precioCliente=(cfg.precioClientePorMl||0)*parseFloat(ml);descripcion+=` (${parseFloat(ml)} ml)`;}
  else if(nombreMed==="Artrosan"){const kg=prompt("Peso paciente (kg):");if(!kg||isNaN(kg)||parseFloat(kg)<=0){document.getElementById('selectorMedicamentos').value="";return;}const ml=parseFloat(kg)/20;precioCliente=(cfg.precioCliente||0)*ml;descripcion+=` (${ml.toFixed(2)} ml)`;}
  else if(nombreMed==="Lisavac"){const kg=prompt("Peso paciente (kg):");if(!kg||isNaN(kg)||parseFloat(kg)<=0){document.getElementById('selectorMedicamentos').value="";return;}precioCliente=(cfg.precioCliente||0)*parseFloat(kg);descripcion+=` (${parseFloat(kg).toFixed(2)} ml)`;}
  else precioCliente=cfg.precioCliente||0;
  _insertarMedicamentoEnTabla(descripcion,precioCliente);
  document.getElementById('selectorMedicamentos').value="";
  // Stock de medicamentos
  _verificarStockServicio(nombreMed);
};

function _insertarMedicamentoEnTabla(descripcion,precioCliente) {
  const grupoID="med-"+Date.now();
  const visual=document.getElementById('visualizacionServicios');
  if(visual){if(visual.innerText.includes("Sin servicios"))visual.innerHTML="";const badge=document.createElement('div');badge.id="badge-"+grupoID;badge.className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200 mb-1 flex items-center gap-2";badge.innerHTML=`<span>💊</span><span class="flex-1 font-bold text-[10px]">${descripcion}</span>`;visual.appendChild(badge);}
  document.getElementById('contenedorInsumos').classList.remove('hidden');
  const cuerpo=document.getElementById('listaInsumosDinamica');
  const ft=document.createElement('tr');ft.className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black servicio-principal";ft.setAttribute('data-grupo',grupoID);ft.setAttribute('data-precio',precioCliente);ft.setAttribute('data-porc',40);
  ft.innerHTML=`<td colspan="3" class="p-2 text-[11px] uppercase">💊 ${descripcion} ($${precioCliente.toFixed(2)})<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2 text-[9px]">MEDICAMENTO</span></td><td class="p-2 text-center"><button onclick="window.eliminarServicioCompleto('${grupoID}',${precioCliente},event)" class="text-red-500 font-bold text-lg">×</button></td>`;
  cuerpo.appendChild(ft);
  if(!insumosBaseMedAgregados){[{nombre:"Jeringa para medicamento",costo:0.50},{nombre:"Algodón",costo:0.10},{nombre:"Alcohol",costo:0.10}].forEach(ins=>{const tr=document.createElement('tr');tr.className=`border-b border-gray-100 insumo-fila bg-yellow-50 ${grupoID}`;tr.innerHTML=`<td class="p-2 font-bold text-[11px] italic">➕ ${ins.nombre.toUpperCase()}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${ins.costo.toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td><td class="p-2 text-center text-red-500 font-bold cursor-pointer" onclick="this.parentElement.remove();window.calcularTodo()">✕</td>`;cuerpo.appendChild(tr);});insumosBaseMedAgregados=true;}
  window.calcularTodo();respaldarProgresoLocal();
}

// ─── MOTOR FINANCIERO ───
window.calcularTodo = async () => {
  let totalComision=0,totalGastos=0,totalVenta=0;
  if(window.porcGlobalCache===undefined){try{const snap=await getDoc(doc(db,"configuracion","tarifas"));window.porcGlobalCache=snap.exists()?(snap.data().porcDoc??snap.data().porcentajeDoc??null):null;}catch{window.porcGlobalCache=null;}}
  document.querySelectorAll('.servicio-principal').forEach(fila=>{const precio=parseFloat(fila.getAttribute('data-precio'))||0;const porcDef=parseFloat(fila.getAttribute('data-porc'))||0;const porc=(window.porcGlobalCache!==null&&window.porcGlobalCache!==undefined)?window.porcGlobalCache:porcDef;const grupoID=fila.getAttribute('data-grupo');let gastos=0;document.querySelectorAll(`.${grupoID}.insumo-fila`).forEach(ins=>{gastos+=(parseFloat(ins.querySelector('.i-cant')?.value)||0)*(parseFloat(ins.querySelector('.i-cost')?.value)||0);});totalVenta+=precio;totalGastos+=gastos;const util=precio-gastos;if(util>0)totalComision+=util*(porc/100);});
  const iv=document.getElementById('precioVenta');if(iv)iv.value=totalVenta.toFixed(2);
  const ig=document.getElementById('gastoInsumos');if(ig)ig.value=totalGastos.toFixed(2);
  const id=document.getElementById('montoDoctor');if(id)id.innerText=`$ ${totalComision.toFixed(2)}`;
};

// ─── ELIMINAR SERVICIO ───
window.eliminarServicioCompleto = async (idGrupo, precioARestar, event) => {
  if(event)event.preventDefault();if(!confirm("¿Eliminar este servicio y sus insumos?"))return;
  document.getElementById("badge-"+idGrupo)?.remove();
  const ft=document.querySelector(`[data-grupo="${idGrupo}"]`);if(ft)ft.remove();
  document.querySelectorAll('tr.insumo-fila').forEach(tr=>{if(tr.classList.contains(idGrupo))tr.remove();});
  const filasRest=document.querySelectorAll('.servicio-principal');
  if(filasRest.length===0){document.getElementById('contenedorInsumos')?.classList.add('hidden');const visual=document.getElementById('visualizacionServicios');if(visual)visual.innerHTML='<p class="text-slate-400 font-normal italic text-[11px]">Sin servicios registrados...</p>';insumosBaseMedAgregados=false;}
  _recalcularCombos();
  await window.calcularTodo();
};

// ─── INSUMO MANUAL ───
window.agregarInsumoManual = () => {
  const n=document.getElementById('nombreExtra');const c=document.getElementById('costoExtra');if(!n?.value)return alert("Ingrese nombre.");
  const filas=document.querySelectorAll('.servicio-principal');const ultimoGrp=filas.length>0?filas[filas.length-1].getAttribute('data-grupo'):"manual";
  const tr=document.createElement('tr');tr.className=`border-b border-gray-100 insumo-fila bg-yellow-50 ${ultimoGrp}`;tr.innerHTML=`<td class="p-2 font-bold text-[11px] italic">➕ ${n.value.toUpperCase()}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${parseFloat(c?.value||0).toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td><td class="p-2 text-center text-red-500 font-bold cursor-pointer" onclick="this.parentElement.remove();window.calcularTodo()">✕</td>`;
  document.getElementById('listaInsumosDinamica').appendChild(tr);n.value="";if(c)c.value="";window.calcularTodo();
};

// ─── VACUNA YA PAGADA ───
window.toggleVacunaPagada = (marcado) => {
  window.vacunaPagadaAnteriormente=marcado;const inputPrecio=document.getElementById('precioVenta');if(inputPrecio){inputPrecio.style.textDecoration=marcado?'line-through':'none';inputPrecio.style.color=marcado?'#f59e0b':'';}let aviso=document.getElementById('avisoVacunaPagada');if(!aviso){aviso=document.createElement('div');aviso.id='avisoVacunaPagada';aviso.className='no-print text-center text-[10px] font-black text-amber-600 uppercase mt-1';aviso.innerText='⚠️ La vacuna NO se sumará a la caja ni al doctor';document.getElementById('precioVenta')?.parentElement?.appendChild(aviso);}aviso.classList.toggle('hidden',!marcado);
};

// ─── GUARDAR EN FIREBASE ───
window.guardarFirebase = async (imp) => {
  const selectorDoc=document.getElementById('selectDoctor');const nombreDoctor=selectorDoc?selectorDoc.value:"";if(!nombreDoctor)return alert("⚠ Seleccione un doctor.");
  const pinIngresado=prompt(`🔐 Firma Médica: Dr(a). ${nombreDoctor}\nIngrese su PIN:`);if(!pinIngresado)return;const esValido=await window.validarDoctorConMaster(nombreDoctor,pinIngresado);if(!esValido)return alert("❌ PIN incorrecto.");
  const btn=document.activeElement;const textoOrig=btn?.innerText||"Guardar";if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.innerText="⏳ PROCESANDO...";}
  try{
    const leerImg=(a)=>new Promise(res=>{const r=new FileReader();r.readAsDataURL(a);r.onload=e=>res(e.target.result);r.onerror=()=>res("");});
    const fileH=document.getElementById('inputFotoHistoria')?.files[0];const fileT=document.getElementById('inputFotoTest')?.files[0];
    let urlFoto=fileH?await comprimirImagen(await leerImg(fileH)):(document.getElementById('pUrlExamen')?.value||"");let urlTest=fileT?await comprimirImagen(await leerImg(fileT)):(document.getElementById('pUrlTest')?.value||"");
    const listaTests=[];document.querySelectorAll('#cuerpoTablaCertificado tr').forEach(fila=>{const nombre=fila.cells[0]?.querySelector('input')?.value.trim()||fila.cells[0]?.querySelector('span')?.innerText?.trim()||"";const span=fila.cells[1]?.querySelector('.resultado-print');const sel=fila.cells[1]?.querySelector('select');const resultado=(span?.innerText?.trim()&&span.innerText.trim()!=="---")?span.innerText.trim():(sel?.value||"---");const nota=fila.cells[2]?.querySelector('input')?.value?.trim()||"";if(nombre)listaTests.push({nombre,resultado,nota});});
    const cfgSnap=await getDoc(doc(db,"configuracion","tarifas"));let porcGlobal=cfgSnap.exists()?(cfgSnap.data().porcentajeDoc||null):null;const montoVentaTotal=parseFloat(document.getElementById('precioVenta')?.value)||0;let totalGastos=0,pagoDoctorTotal=0;const detalleInsumos=[];
    document.querySelectorAll('.servicio-principal').forEach(fila=>{const grupoID=fila.getAttribute('data-grupo');const precioServ=parseFloat(fila.getAttribute('data-precio'))||0;const pEfect=porcGlobal||parseFloat(fila.getAttribute('data-porc'))||0;let gastosGrupo=0;document.querySelectorAll(`.${grupoID}.insumo-fila`).forEach(ins=>{const cant=parseFloat(ins.querySelector('.i-cant')?.value)||0;const costo=parseFloat(ins.querySelector('.i-cost')?.value)||0;gastosGrupo+=cant*costo;detalleInsumos.push({nombre:ins.cells[0].innerText.replace(/[➕🔹]/g,'').trim(),cant,costo});});totalGastos+=gastosGrupo;const util=Math.max(0,precioServ-gastosGrupo);pagoDoctorTotal+=util*(pEfect/100);});
    let montoVacunaPendiente=0;if(window.vacunaPagadaAnteriormente){document.querySelectorAll('.servicio-principal').forEach(fila=>{if(normalizarNombre(fila.innerText).includes("vacuna"))montoVacunaPendiente+=parseFloat(fila.getAttribute('data-precio'))||0;});}
    const montoVentaFinal=window.vacunaPagadaAnteriormente?Math.max(0,montoVentaTotal-montoVacunaPendiente):montoVentaTotal;const gastosFinal=window.vacunaPagadaAnteriormente?Math.max(0,totalGastos-montoVacunaPendiente*0.3):totalGastos;const pagoDoctorFinal=window.vacunaPagadaAnteriormente?Math.max(0,pagoDoctorTotal-montoVacunaPendiente*0.5):pagoDoctorTotal;
    const leerTablaVac=()=>{const res={vacunas:[],desparasitaciones:[]};try{const tablas=document.querySelector('#bloqueVacunas')?.querySelectorAll('table');tablas?.[0]?.querySelectorAll('tbody tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length<5)return;const fecha=c[0].querySelector('input')?.value.trim()||"";const vacuna=c[1].querySelector('input')?.value.trim()||"";const peso=c[2].querySelector('input')?.value.trim()||"";const proxima=c[3].querySelector('input')?.value.trim()||"";const firma=c[4].querySelector('input')?.value.trim()||"";if(fecha||vacuna)res.vacunas.push({fecha,vacuna,peso,proxima,firma});});tablas?.[1]?.querySelectorAll('tbody tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length<5)return;const fecha=c[0].querySelector('input')?.value.trim()||"";const producto=c[1].querySelector('input')?.value.trim()||"";const peso=c[2].querySelector('input')?.value.trim()||"";const proxima=c[3].querySelector('input')?.value.trim()||"";const firma=c[4].querySelector('input')?.value.trim()||"";if(fecha||producto)res.desparasitaciones.push({fecha,producto,peso,proxima,firma});});}catch(e){console.warn(e);}return res;};const datosVac=leerTablaVac();
    const getFotos=(id)=>{const g=document.getElementById(id);if(!g)return[];return Array.from(g.querySelectorAll('img')).map(img=>img.src).filter(Boolean);};const fotosH=getFotos('previewHistoriaGallery');const fotosT=getFotos('previewTestGallery');const dInput=(id)=>document.getElementById(id)?.value?.trim()||"";
    const data={cedula:dInput('hCI'),propietario:dInput('hProp'),paciente:dInput('hNombre'),especie:dInput('hEspecie'),raza:dInput('hRaza'),sexo:dInput('hSexo'),edad:dInput('hEdad'),peso:dInput('hPeso'),color:dInput('hColor'),telefono:dInput('hTlf'),correo:dInput('hMail'),direccion:dInput('hDir'),fechaNacimiento:dInput('hFechaNac'),alerta:document.getElementById('hAlerta')?.checked||false,doctor:nombreDoctor,urlExamen:fotosH.length>0?fotosH[fotosH.length-1]:urlFoto,urlFotoTest:fotosT.length>0?fotosT[fotosT.length-1]:urlTest,fotosHistoria:fotosH,fotosTest:fotosT,testsRealizados:listaTests,vacunasAplicadas:datosVac.vacunas,desparasitacionesAplicadas:datosVac.desparasitaciones,montoVenta:montoVentaFinal,montoInsumos:gastosFinal,pagoDoctor:pagoDoctorFinal,pagoAvipet:montoVentaFinal-gastosFinal-pagoDoctorFinal,vacunaPagadaAnteriormente:window.vacunaPagadaAnteriormente||false,listaDetalladaInsumos:detalleInsumos,tratamiento:dInput('hTratamiento'),fecha:serverTimestamp(),fechaSimple:new Date().toLocaleDateString()};
    await addDoc(collection(db,"consultas"),data);localStorage.removeItem('respaldoConsulta');localStorage.removeItem('respaldo_historia_activa');alert("✅ ¡Consulta guardada con éxito!");
    ['hCI','hProp','hNombre','hEspecie','hRaza','hSexo','hEdad','hPeso','hColor','hTlf','hMail','hDir','hTratamiento','hFechaNac'].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
    const visual=document.getElementById('visualizacionServicios');if(visual)visual.innerHTML='<p class="text-[10px] text-slate-400 italic">Sin servicios registrados</p>';const cuerpo=document.getElementById('listaInsumosDinamica');if(cuerpo)cuerpo.innerHTML="";const pv=document.getElementById('precioVenta');if(pv)pv.value="0.00";const chk=document.getElementById('chkVacunaPagada');if(chk)chk.checked=false;window.vacunaPagadaAnteriormente=false;window.toggleVacunaPagada(false);insumosBaseMedAgregados=false;document.getElementById('contenedorInsumos')?.classList.add('hidden');
    _limpiarNotasInternas();
    if(imp)window.imprimirDocumento();
  }catch(e){console.error("Error guardando:",e);alert("❌ Error: "+e.message);}
  finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.innerText=textoOrig;}}
};

// ─── AUTOCOMPLETAR POR CÉDULA + ALERTA VACUNA + NOTAS INTERNAS ───
window.autocompletarPorCedula = async (ci) => {
  if(!ci||ci.length<3)return;
  try{
    const snap=await getDocs(query(collection(db,"consultas"),where("cedula","==",ci.trim()),orderBy("fecha","desc"),limit(1)));
    if(!snap.empty){
      const d=snap.docs[0].data();const set=(id,val)=>{const el=document.getElementById(id);if(el){el.value=val||"";el.classList.add('bg-blue-50');setTimeout(()=>el.classList.remove('bg-blue-50'),1000);}};
      set('hProp',d.propietario);set('hNombre',d.paciente);set('hEspecie',d.especie);set('hRaza',d.raza);set('hEdad',d.edad);set('hSexo',d.sexo);set('hPeso',d.peso);set('hColor',d.color);set('hTlf',d.telefono);set('hMail',d.correo||d.email);set('hDir',d.direccion);set('hFechaNac',d.fechaNacimiento);

      // Alerta restricción
      if(d.alerta){const el=document.getElementById('hProp');if(el){el.style.color="#b91c1c";el.style.fontWeight="bold";}alert("⚠️ ATENCIÓN: Este cliente tiene una RESTRICCIÓN ADMINISTRATIVA.");}

      // Verificar próximas vacunas vencidas
      if(Array.isArray(d.vacunasAplicadas)&&d.vacunasAplicadas.length>0){
        const hoy=new Date();const vencidas=[];
        d.vacunasAplicadas.forEach(vac=>{if(!vac.proxima)return;const partes=vac.proxima.split('/');if(partes.length===3){const fechaProx=new Date(partes[2],partes[1]-1,partes[0]);if(fechaProx<hoy)vencidas.push(`• ${vac.vacuna||'Vacuna'}: venció el ${vac.proxima}`);}});
        if(vencidas.length>0){await Swal.fire({icon:'warning',title:'⏰ VACUNAS VENCIDAS',html:`<p class="text-[11px] text-slate-600 mb-2">Este paciente tiene vacunas atrasadas:</p><div class="bg-red-50 border border-red-200 rounded-xl p-3 text-left"><pre class="text-[11px] text-red-700 font-bold whitespace-pre-wrap">${vencidas.join('\n')}</pre></div>`,confirmButtonText:'Entendido',confirmButtonColor:'#dc2626',timer:8000,timerProgressBar:true});}
      }

      // Notas internas
      _mostrarNotasInternas(ci.trim(), d.observacionesPermanentes || "");
    }
  }catch(e){console.error("Error autocompletar:",e);}
};

// ─── NOTAS INTERNAS POR PACIENTE ───
function _mostrarNotasInternas(cedula, notasExistentes) {
  const cont = document.getElementById('contNotasInternas');
  const inp  = document.getElementById('inputNotasInternas');
  if (!cont || !inp) return;
  cont.classList.remove('hidden');
  inp.value = notasExistentes || "";
  inp.dataset.cedula = cedula;
}

function _limpiarNotasInternas() {
  const cont = document.getElementById('contNotasInternas');
  const inp  = document.getElementById('inputNotasInternas');
  if (cont) cont.classList.add('hidden');
  if (inp)  { inp.value = ""; inp.dataset.cedula = ""; }
}

window.guardarNotasInternas = async () => {
  const inp    = document.getElementById('inputNotasInternas');
  const cedula = inp?.dataset.cedula;
  const notas  = inp?.value.trim() || "";
  if (!cedula) { alert("No hay paciente cargado."); return; }
  try {
    // Actualizar todas las consultas de este CI con las notas
    const snap = await getDocs(query(collection(db,"consultas"),where("cedula","==",cedula),orderBy("fecha","desc"),limit(1)));
    if (!snap.empty) {
      await updateDoc(doc(db,"consultas",snap.docs[0].id),{observacionesPermanentes:notas});
      await Swal.fire({icon:'success',title:'Notas guardadas',timer:1400,showConfirmButton:false});
    }
  } catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

// ─── FOTOS ───
window.previsualizarFotoHistoria = (event) => {
  const files=event.target.files;const galeria=document.getElementById('previewHistoriaGallery');const cont=document.getElementById('previewHistoriaContainer');const hidden=document.getElementById('pUrlExamen');if(!files?.length||!galeria)return;
  Array.from(files).forEach(file=>{const reader=new FileReader();reader.onload=async(e)=>{const dataUrl=await comprimirImagen(e.target.result);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${dataUrl}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHiddenHistoria()">✕</button>`;galeria.appendChild(wrapper);if(cont)cont.classList.remove('hidden');if(hidden)hidden.value=dataUrl;};reader.readAsDataURL(file);});event.target.value="";
};
window.sincronizarHiddenHistoria=()=>{const galeria=document.getElementById('previewHistoriaGallery');const hidden=document.getElementById('pUrlExamen');if(!galeria||!hidden)return;const imgs=galeria.querySelectorAll('img');if(imgs.length===0){hidden.value="";document.getElementById('previewHistoriaContainer')?.classList.add('hidden');}else hidden.value=imgs[imgs.length-1].src;};
window.previsualizarFotoTest=(event)=>{const files=event.target.files;const galeria=document.getElementById('previewTestGallery');const cont=document.getElementById('previewTestContainer');const hidden=document.getElementById('pUrlTest');if(!files?.length||!galeria)return;Array.from(files).forEach(file=>{const reader=new FileReader();reader.onload=async(e)=>{const dataUrl=await comprimirImagen(e.target.result);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${dataUrl}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHiddenTest()">✕</button>`;galeria.appendChild(wrapper);if(cont)cont.classList.remove('hidden');if(hidden)hidden.value=dataUrl;};reader.readAsDataURL(file);});event.target.value="";};
window.sincronizarHiddenTest=()=>{const galeria=document.getElementById('previewTestGallery');const hidden=document.getElementById('pUrlTest');if(!galeria||!hidden)return;const imgs=galeria.querySelectorAll('img');if(imgs.length===0){hidden.value="";document.getElementById('previewTestContainer')?.classList.add('hidden');}else hidden.value=imgs[imgs.length-1].src;};

// ─── QR MÓVIL ───
window.generarEnlaceMovil=(tipo='historia')=>{const cedula=document.getElementById('hCI')?.value.trim();if(!cedula)return alert("⚠️ Escribe la Cédula primero.");const qrDivID=tipo==='test'?"qrcodeTest":"qrcode";const contID=tipo==='test'?"qrContainerTest":"qrContainer";const qrDiv=document.getElementById(qrDivID);if(qrDiv)qrDiv.innerHTML="";const url=`${window.location.origin}${window.location.pathname}?mode=mobile&ci=${cedula}&tipo=${tipo}`;new QRCode(qrDiv,{text:url,width:128,height:128});document.getElementById(contID)?.classList.remove('hidden');const ahora=new Date();if(tipo==='historia')window._ultimaSesionQRHistoria=ahora;if(tipo==='test')window._ultimaSesionQRTest=ahora;const q=query(collection(db,"transferencias_fotos"),where("ci","==",cedula),where("tipo","==",tipo));if(tipo==='historia'&&window._unsubHist)window._unsubHist();if(tipo==='test'&&window._unsubTest)window._unsubTest();const unsub=onSnapshot(q,snap=>{const galeriaId=tipo==='test'?'previewTestGallery':'previewHistoriaGallery';const contIdG=tipo==='test'?'previewTestContainer':'previewHistoriaContainer';const hiddenId=tipo==='test'?'pUrlTest':'pUrlExamen';const galeria=document.getElementById(galeriaId);const cont=document.getElementById(contIdG);const hidden=document.getElementById(hiddenId);if(!galeria||!cont)return;const urlsExist=new Set(Array.from(galeria.querySelectorAll('img')).map(img=>img.src));const inicio=tipo==='historia'?window._ultimaSesionQRHistoria:window._ultimaSesionQRTest;snap.forEach(docSnap=>{const d=docSnap.data();if(!d.url)return;if(d.fecha?.toDate&&d.fecha.toDate()<inicio)return;if(urlsExist.has(d.url))return;urlsExist.add(d.url);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${d.url}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHidden${tipo==='test'?'Test':'Historia'}()">✕</button>`;galeria.appendChild(wrapper);if(hidden)hidden.value=d.url;});if(urlsExist.size>0)cont.classList.remove('hidden');});if(tipo==='historia')window._unsubHist=unsub;if(tipo==='test')window._unsubTest=unsub;};
window.mostrarInterfazSoloCamara=(ci,tipo)=>{const colorB=tipo==='test'?'bg-emerald-600':'bg-blue-600';const colorTx=tipo==='test'?'text-emerald-400':'text-blue-400';document.body.innerHTML=`<div class="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center font-sans"><div class="w-full max-w-sm bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 text-center"><h1 class="text-xl font-black uppercase italic ${colorTx}">${tipo==='test'?'🧪 TEST':'📸 HISTORIA'}</h1><p class="text-slate-400 text-[10px] mb-6 uppercase">CI: <b>${ci}</b></p><input type="file" id="mobileFileCamera" accept="image/*" capture="environment" class="hidden" onchange="window.procesarSubidaMovil(this,'${ci}','${tipo}')"><input type="file" id="mobileFileGallery" accept="image/*" multiple class="hidden" onchange="window.procesarSubidaMovil(this,'${ci}','${tipo}')"><div class="flex flex-col gap-3"><button onclick="document.getElementById('mobileFileCamera').click()" class="w-full ${colorB} py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95">📷 TOMAR FOTO</button><button onclick="document.getElementById('mobileFileGallery').click()" class="w-full bg-slate-600 py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95">🖼️ GALERÍA</button></div><div id="statusMovil" class="mt-6 text-sm font-medium text-blue-300 italic">Listo...</div></div></div>`;};
window.procesarSubidaMovil=async(input,ci,tipo)=>{const status=document.getElementById('statusMovil');const files=input.files;if(!files?.length)return;if(status)status.innerText=`⏳ Procesando ${files.length} foto(s)...`;let enviadas=0;try{for(const file of files){const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=e=>rej(e);r.readAsDataURL(file);});const comprimida=await comprimirImagen(base64);await addDoc(collection(db,"transferencias_fotos"),{ci,tipo,url:comprimida,fecha:serverTimestamp()});enviadas++;if(status)status.innerText=`⏳ ${enviadas}/${files.length}...`;}if(status)status.innerHTML=`<b class='text-emerald-400'>✅ ${enviadas} foto(s) enviada(s)</b>`;}catch(e){if(status)status.innerText="❌ "+e.message;}};

// ─── IMPRIMIR ───
window.imprimirDocumento=()=>{const doctor=document.getElementById('selectDoctor')?.value.toUpperCase()||"";const logoD=document.getElementById('logoDerechoVacuna');if(logoD){if(doctor.includes("DARWIN")){logoD.src="https://raw.githubusercontent.com/albertumcat-boop/avipet/main/logo_darwin.jpg";logoD.classList.remove('hidden');}else{logoD.src="";logoD.classList.add('hidden');}}const hTrat=document.getElementById('hTratamiento');const hPrint=document.getElementById('hTratamientoPrint');if(hTrat&&hPrint)hPrint.innerText=hTrat.value;try{const galPrev=document.getElementById('previewHistoriaGallery');const galPrint=document.getElementById('printHistoriaGallery');const contP=document.getElementById('printExamenCont');if(galPrev&&galPrint&&contP){galPrint.innerHTML="";const imgs=galPrev.querySelectorAll('img');imgs.forEach(img=>{const w=document.createElement('div');w.className="max-w-[45%] border border-slate-300 rounded-lg overflow-hidden";w.innerHTML=`<img src="${img.src}" class="w-full h-auto max-h-[300px] object-contain foto-anexo">`;galPrint.appendChild(w);});contP.classList.toggle('hidden',imgs.length===0);}}catch(e){console.warn(e);}setTimeout(()=>window.print(),500);};
window.imprimirRecetaLimpia=()=>{const texto=document.getElementById('hTratamiento')?.value||"";const paciente=document.getElementById('hNombre')?.value||"";const prop=document.getElementById('hProp')?.value||"";const urlExamen=document.getElementById('pUrlExamen')?.value||"";const win=window.open("","_blank","width=800,height=600");if(!win)return;win.document.write(`<html><head><title>Receta - AVIPET</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;}.header{border-bottom:3px solid #3b82f6;padding-bottom:10px;margin-bottom:20px;}h1{font-size:24px;margin:0;color:#1e3a8a;}.content{background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;min-height:200px;}pre{white-space:pre-wrap;font-size:14px;line-height:1.6;margin:0;}</style></head><body><div class="header"><h1>AVIPET - Centro Veterinario</h1><h2 style="font-size:13px;color:#64748b;margin:5px 0;">Paciente: <b>${paciente}</b> | Propietario: ${prop}</h2></div><div class="content"><pre>${texto}</pre></div>${urlExamen?`<div style="margin-top:20px;text-align:center;"><img src="${urlExamen}" style="max-width:350px;border-radius:10px;border:1px solid #ddd;"></div>`:''}<div style="margin-top:30px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #eee;padding-top:10px;">Documento generado por AVIPET.</div></body></html>`);win.document.close();win.onload=()=>setTimeout(()=>{win.focus();win.print();},300);};

// ─── HOJA DE VACUNAS ───
window.abrirHojaVacunasDesdeHistoria=()=>{const dVal=(id)=>document.getElementById(id)?.value.trim()||"";const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||"";};const f=new Date();set('hv_fecha',`${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`);const campos={'hv_propietario':'hProp','hv_cedula':'hCI','hv_telefono':'hTlf','hv_direccion':'hDir','hv_especie':'hEspecie','hv_raza':'hRaza','hv_paciente':'hNombre','hv_edad':'hEdad','hv_sexo':'hSexo','hv_color':'hColor'};Object.entries(campos).forEach(([d,o])=>set(d,dVal(o)));set('hv_fechaNacimiento',dVal('hFechaNac'));document.getElementById('sectionHistoria')?.classList.add('hidden');const v=document.getElementById('sectionHojaVacunas');if(v){v.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}};

// ─── SALA DE ESPERA ───
window.enviarAColaEspera=async()=>{try{const dVal=(id)=>document.getElementById(id)?.value.trim()||"";const data={cedula:dVal('hCI'),propietario:dVal('hProp'),paciente:dVal('hNombre'),especie:dVal('hEspecie'),raza:dVal('hRaza'),edad:dVal('hEdad'),sexo:dVal('hSexo'),peso:dVal('hPeso'),telefono:dVal('hTlf'),correo:dVal('hMail'),direccion:dVal('hDir'),color:dVal('hColor'),fechaIngreso:serverTimestamp(),fechaSimple:`${new Date().getDate()}/${new Date().getMonth()+1}/${new Date().getFullYear()}`,estado:"en_espera"};if(!data.cedula||!data.paciente||!data.propietario){alert("⚠️ Cédula, Propietario y Paciente son obligatorios.");return;}await addDoc(collection(db,"espera"),data);alert("✅ Paciente enviado a sala de espera.");}catch(e){console.error(e);alert("❌ Error: "+e.message);}};
window.cargarListaEspera=async()=>{const cont=document.getElementById('listaEspera');if(!cont)return;cont.innerHTML="<p class='text-center text-slate-400 text-[10px]'>Cargando...</p>";try{const snap=await getDocs(collection(db,"espera"));const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));const filtrados=items.filter(i=>i.estado==="en_espera").sort((a,b)=>(a.fechaIngreso?.seconds||0)-(b.fechaIngreso?.seconds||0));if(!filtrados.length){cont.innerHTML="<p class='text-center text-slate-400 text-[10px]'>No hay pacientes en espera.</p>";return;}cont.innerHTML="";filtrados.forEach(p=>{const div=document.createElement('div');div.className="border rounded-lg p-2 bg-slate-50 flex justify-between items-center gap-2";div.innerHTML=`<div><p class="font-bold uppercase text-[11px] text-slate-700">${p.paciente}</p><p class="text-[9px] text-slate-500">${p.propietario} • CI: ${p.cedula}</p></div><div class="flex gap-2"><button class="bg-blue-600 text-white text-[10px] px-3 py-1 rounded font-black uppercase" onclick="window.abrirPacienteDesdeEspera('${p.id}')">Atender</button><button class="bg-red-500 text-white text-[10px] px-3 py-1 rounded font-black uppercase" onclick="window.eliminarDeSalaEspera('${p.id}')">Eliminar</button></div>`;cont.appendChild(div);});}catch(e){console.error(e);cont.innerHTML="<p class='text-center text-red-500 text-[10px]'>Error al cargar.</p>";}};
window.abrirPacienteDesdeEspera=async(idEspera)=>{try{const snap=await getDoc(doc(db,"espera",idEspera));if(!snap.exists()){alert("Registro no encontrado.");return;}const d=snap.data();const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||"";};set('hCI',d.cedula);set('hProp',d.propietario);set('hNombre',d.paciente);set('hEspecie',d.especie);set('hRaza',d.raza);set('hEdad',d.edad);set('hSexo',d.sexo);set('hPeso',d.peso);set('hTlf',d.telefono);set('hMail',d.correo);set('hDir',d.direccion);set('hColor',d.color);await updateDoc(doc(db,"espera",idEspera),{estado:"atendiendo",fechaAtencion:serverTimestamp()});window.showTab('historia');alert(`✅ ${d.paciente} cargado.`);}catch(e){console.error(e);alert("❌ Error: "+e.message);}};
window.eliminarDeSalaEspera=async(idEspera)=>{if(!confirm("¿Eliminar de la sala de espera?"))return;try{await updateDoc(doc(db,"espera",idEspera),{estado:"eliminado",fechaEliminacion:serverTimestamp()});alert("✅ Eliminado.");window.cargarListaEspera();}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

console.log("✅ historia.js v3 — stock bajo, notas internas, recordatorio vacunas");
