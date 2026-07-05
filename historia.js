// =========================================================
// AVIPET -- historia.js  v30
// NUEVO: selector de mascotas al autocompletar por cedula
//        (veterinaria y peluqueria)
//        limpiar formulario al enviar a sala de espera
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc,
  getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
console.log("✅ historia.js v41 -- fix categorias con tildes en selector");
// respaldarProgresoLocal definida localmente para evitar doble carga de main.js
const respaldarProgresoLocal = () => {
  try {
    const leer = (id) => document.getElementById(id)?.value || '';
    const ci = leer('hCI');
    if (!ci) return;
    const servicios = [];
    document.querySelectorAll('.servicio-principal').forEach(fila => {
      servicios.push({
        nombre: fila.querySelector('td')?.innerText || '',
        precio: fila.getAttribute('data-precio') || 0,
        porc:   fila.getAttribute('data-porc')   || 0
      });
    });
    localStorage.setItem('respaldo_historia_activa', JSON.stringify({
      cedula:      ci,
      propietario: leer('hProp'),
      paciente:    leer('hNombre'),
      especie:     leer('hEspecie'),
      raza:        leer('hRaza'),
      edad:        leer('hEdad'),
      sexo:        leer('hSexo'),
      peso:        leer('hPeso'),
      color:       leer('hColor'),
      telefono:    leer('hTlf'),
      correo:      leer('hMail'),
      direccion:   leer('hDir'),
      tratamiento: leer('hTratamiento'),
      fechaNac:    leer('hFechaNac'),
      servicios,
      timestamp: Date.now()
    }));
  } catch(e) { console.warn('Error guardando respaldo:', e); }
};
const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || 'AVIPET2026';

// Normalizar cedula: quitar puntos, espacios, guiones -- para buscar con o sin formato
const normalizarCedula = (ci) => String(ci || '').replace(/[\.\-\s]/g, '').trim().toUpperCase();

const normalizarNombre = (str) =>
  String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");

const recetas = {
  "CONSULTA GENERAL":           { precioVenta:30,  insumos:[{nombre:"Crema",costo:0.50}] },
  "CONSULTA OFTALMOLOGICA":     { precioVenta:80,  insumos:[{nombre:"Tiras Fluoresceina",costo:2.50}] },
  "CONSULTA CAMADA 3-4 CACHORROS":      { precioVenta:50,  insumos:[{nombre:"Insumos Camada",costo:2.00}] },
  "CONSULTA CAMADA HASTA 8 CACHORROS":  { precioVenta:80,  insumos:[{nombre:"Insumos Camada Grande",costo:4.00}] },
  "CONSULTA CAMADA MAS DE 8 CACHORROS": { precioVenta:100, insumos:[{nombre:"Insumos Camada XL",costo:6.00}] },
  "CONSULTA DE EMERGENCIA":     { precioVenta:40,  insumos:[{nombre:"Crema",costo:0.50}] },
  "ABSCESO":                    { precioVenta:25,  insumos:[{nombre:"Jelco",costo:4.50},{nombre:"Agua Oxigenada",costo:0.50},{nombre:"Compresa",costo:0.50},{nombre:"Antibiotico",costo:0.50},{nombre:"Antinflamatorio",costo:0.50},{nombre:"Sedacion",costo:0.50}] },
  "ECOGRAFIA":                  { precioVenta:30,  insumos:[{nombre:"Gel Ecografico",costo:1.00},{nombre:"Papel Absorbente",costo:0.50}] },
  "COLOCACION VIA":             { precioVenta:15,  insumos:[{nombre:"Jelco",costo:1.50},{nombre:"Jeringa 5cc",costo:0.50},{nombre:"Adhesivo",costo:0.30},{nombre:"Mariposa",costo:1.00},{nombre:"Obturador",costo:1.00}] },
  "ADMINISTRACION MEDICINA":    { precioVenta:10,  insumos:[{nombre:"Jeringa",costo:0.50}] },
  "TOMA DE MUESTRA SANGRE":     { precioVenta:10,  insumos:[{nombre:"Jeringa",costo:0.50},{nombre:"Mariposa",costo:1.00},{nombre:"Tubo",costo:1.20}] },
  "VACUNA SEXTUPLE":            { precioVenta:40,  insumos:[{nombre:"Vial Sextuple",costo:8.50}] },
  "VACUNA PUPPY":               { precioVenta:40,  insumos:[{nombre:"Vial Puppy",costo:7.00}] },
  "VACUNA ANTIRRABICA":         { precioVenta:30,  insumos:[{nombre:"Vial Antirrabica",costo:4.00}] },
  "VACUNA KC (TOS DE LAS PERRERAS)": { precioVenta:45, insumos:[{nombre:"Vial KC",costo:9.00}] },
  "VACUNA TRIPLE FELINA":       { precioVenta:45,  insumos:[{nombre:"Vial Triple Felina",costo:10.00}] },
  "VACUNA QUINTUPLE FELINA":    { precioVenta:50,  insumos:[{nombre:"Vial Quintuple Felina",costo:15.00}] },
  "VACUNA BIOVETA":             { precioVenta:60,  insumos:[{nombre:"Vial Bioveta",costo:6.50}] },
  "HEMATOLOGIA COMPLETA":       { precioVenta:23,  insumos:[{nombre:"Tubo EDTA",costo:4.50}] },
  "QUIMICA SANGUINEA":          { precioVenta:60,  insumos:[{nombre:"Tubo Seco - Reactivos",costo:10.00}] },
  "DESCARTE HEMOPARASITO":      { precioVenta:50,  insumos:[{nombre:"Test Hemoparasitos",costo:9.00}] },
  "DISTEMPER":                  { precioVenta:35,  insumos:[{nombre:"Kit Test Distemper",costo:11.00}] },
  "PARVOVIRUS - CORONAVIRUS":   { precioVenta:35,  insumos:[{nombre:"Kit Test Parvo",costo:12.00}] },
  "FILARIASIS":                 { precioVenta:40,  insumos:[{nombre:"Kit Filarias",costo:11.00}] },
  "SIDA - LEUCEMIA":            { precioVenta:40,  insumos:[{nombre:"Kit Sida-Leucemia",costo:15.00}] },
  "TEST HELICOBACTER PYLORI AG":{ precioVenta:40,  insumos:[{nombre:"Kit Helicobacter",costo:20.00}] },
  "HEMATOLOGIA + QUIMICA + HEMOPARASITOS": { precioVenta:110,insumos:[{nombre:"Pack Lab Completo",costo:25.00}] },
  "EXAMEN DE HECES":            { precioVenta:10,  insumos:[{nombre:"Portas - Solucion",costo:1.50}] },
  "EXAMENES DE ORINA":          { precioVenta:10,  insumos:[{nombre:"Tira Reactiva",costo:2.00}] },
  "CITOLOGIA 1 OIDO":           { precioVenta:15,  insumos:[{nombre:"Hisopo - Tincion",costo:2.50}] },
  "CITOLOGIA 2 OIDOS":          { precioVenta:20,  insumos:[{nombre:"Hisopos - Tinciones",costo:4.00}] },
  "RASPADO PIEL":               { precioVenta:10,  insumos:[{nombre:"Hoja Bisturi",costo:3.00}] },
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
  "CONSULTA GENERAL":40,"CONSULTA OFTALMOLOGICA":12.5,
  "CONSULTA CAMADA 3-4 CACHORROS":40,"CONSULTA CAMADA HASTA 8 CACHORROS":40,
  "CONSULTA CAMADA MAS DE 8 CACHORROS":40,"CONSULTA DE EMERGENCIA":40,
  "ABSCESO":50,"ECOGRAFIA":40,"COLOCACION VIA":50,
  "ADMINISTRACION MEDICINA":50,"TOMA DE MUESTRA SANGRE":50,
  "HEMATOLOGIA COMPLETA":34.78,"PERFIL ANEMICO":17.5,
};

const insumosFijosMedicos = [{nombre:"Guantes de examen",costo:0.50},{nombre:"Alcohol",costo:0.10},{nombre:"Algodon",costo:0.10},{nombre:"Hojas - Papeleria",costo:0.10}];
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

// --- COMPRESOR ---
const comprimirImagen = (b64, maxW=800, q=0.55) => new Promise(res=>{
  const img=new Image();img.src=b64;img.onload=()=>{
    const c=document.createElement('canvas');let w=img.width,h=img.height;
    if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.fillStyle="#FFF";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    res(c.toDataURL('image/jpeg',q));};img.onerror=()=>res(b64);
});

// --- ALERTA STOCK BAJO ---
async function _verificarStockServicio(nombreServicio) {
  try {
    const vLimpio = normalizarNombre(nombreServicio);
    // Buscar en inventario productos relacionados con el servicio
    const snap = await getDocs(collection(db, "inventario"));
    const alertas = [];
    snap.forEach(d => {
      const r = d.data();
      const nomInv = normalizarNombre(r.nombre || "");
      // Detectar si el producto del inventario esta relacionado con el servicio
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
      const lista = alertas.map(a => `* ${a.nombre}: ${a.stock} unidades (min: ${a.min})`).join('\n');
      await Swal.fire({
        icon: 'warning',
        title: '(!) Stock Bajo en Inventario',
        html: `<p class="text-[11px] text-slate-600 mb-2">El siguiente producto esta bajo o agotado:</p>
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
  } catch { /* silencioso -- no bloquear flujo */ }
}

// --- INSERTAR SERVICIO ---
// --- RECALCULAR COMBOS -------------------------------------------------------
// Se llama SIEMPRE despues de insertar o eliminar cualquier servicio.
// Lee el DOM completo y ajusta precios segun lo que realmente esta en la lista.
//
// REGLAS:
//   KC sola        -> $45  |  KC + otra vacuna      -> $40
//   Antirrabica sola -> $30  |  Antirrabica + otra vacuna -> $25
//   Hematologia sola -> $23  |  Hematologia + otro lab    -> $20
// -----------------------------------------------------------------------------
function _recalcularCombos() {
  const filas = Array.from(document.querySelectorAll('.servicio-principal'));
  const nombres = filas.map(f => normalizarNombre(f.querySelector('td')?.innerText || ""));

  filas.forEach((fila, idx) => {
    const n   = nombres[idx];
    const td  = fila.querySelector('td');
    if (!td) return;

    // -- KC --
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

    // -- ANTIRRABICA --
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

    // -- HEMATOLOGIA --
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

  // Recalcular totales despues de ajustar precios
  window.calcularTodo();
}

window.insertarServicio = async (v) => {
  if (!v) return;
  const visual=document.getElementById('visualizacionServicios');
  const vLimpio=normalizarNombre(v);
  let nombreFinal=v,precioFinal=0,porcServ=30;
  let insumosFirebase = null;
  try {
    // Intentar con el nombre exacto primero, luego en mayusculas
    let snap = await getDoc(doc(db,"servicios_maestro",v));
    if (!snap.exists()) snap = await getDoc(doc(db,"servicios_maestro",v.toUpperCase()));
    if (snap.exists()) {
      const d = snap.data();
      precioFinal = parseFloat(d.precioVenta)||0;
      porcServ    = parseFloat(d.porcDoc ?? d.porcentajeDoc ?? 30);
      if (d.insumos && d.insumos.length > 0) {
        insumosFirebase = d.insumos;
        console.log('[AVIPET] Insumos Firebase para',v,':', d.insumos.map(i=>i.nombre+'(bloq:'+i.bloqueado+')'));
      }
    } else {
      const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);
      precioFinal=lrec?recetas[lrec].precioVenta:0;
      porcServ=CONFIG_PORC[v]??30;
      console.log('[AVIPET] Servicio no en Firebase, usando receta local:', v);
    }
  } catch(e) {
    console.error('[AVIPET] Error cargando servicio Firebase:', e);
    const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);
    precioFinal=lrec?recetas[lrec].precioVenta:0;
    porcServ=CONFIG_PORC[v]??30;
  }

  if(vLimpio.includes("kgadicional")){const kgs=prompt("KGs adicionales:");if(!kgs||isNaN(kgs)){document.getElementById('selectorServicios').value="";return;}nombreFinal=`KG ADICIONAL (${parseFloat(kgs)}kg)`;precioFinal=parseFloat(kgs)*7;porcServ=0;}
  else if(vLimpio==="disposicion"||vLimpio==="cremacionconcenizas"){const m=prompt(`Precio pactado para ${v}:`);if(!m||isNaN(m)){document.getElementById('selectorServicios').value="";return;}precioFinal=parseFloat(m);porcServ=0;}
  else if(vLimpio.includes("gusanera")||v.toUpperCase().includes("GUSANERA")) {
    const resGus = await Swal.fire({
      title: 'Gusanera — Gravedad',
      html:
        '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
          '<button type="button" onclick="window._gusGrav=\'LEVE\';window._gusPrecio=25;Swal.clickConfirm()" style="padding:12px;border-radius:12px;border:2px solid #bbf7d0;background:#f0fdf4;font-weight:900;font-size:13px;color:#15803d;cursor:pointer;">LEVE — $25</button>' +
          '<button type="button" onclick="window._gusGrav=\'MEDIA\';window._gusPrecio=35;Swal.clickConfirm()" style="padding:12px;border-radius:12px;border:2px solid #fde68a;background:#fffbeb;font-weight:900;font-size:13px;color:#92400e;cursor:pointer;">MEDIA — $35</button>' +
          '<button type="button" onclick="window._gusGrav=\'GRAVE\';window._gusPrecio=50;Swal.clickConfirm()" style="padding:12px;border-radius:12px;border:2px solid #fca5a5;background:#fef2f2;font-weight:900;font-size:13px;color:#dc2626;cursor:pointer;">GRAVE — $50</button>' +
          '<button type="button" onclick="window._gusGrav=\'PERSONALIZADO\';window._gusPrecio=0;Swal.clickConfirm()" style="padding:12px;border-radius:12px;border:2px solid #e2e8f0;background:#f8fafc;font-weight:900;font-size:13px;color:#64748b;cursor:pointer;">Precio personalizado...</button>' +
        '</div>',
      showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Cancelar'
    });
    if (resGus.isDismissed) { document.getElementById('selectorServicios').value=""; return; }
    if (window._gusGrav === 'PERSONALIZADO') {
      const custom = await Swal.fire({ title:'Precio gusanera ($)', input:'number', inputPlaceholder:'0.00', showCancelButton:true, confirmButtonColor:'#1d4ed8' });
      if (!custom.isConfirmed || !custom.value) { document.getElementById('selectorServicios').value=""; return; }
      window._gusPrecio = parseFloat(custom.value);
    }
    precioFinal = window._gusPrecio || precioFinal;
    nombreFinal = 'GUSANERA ' + (window._gusGrav||'');
    window._gusGrav = null; window._gusPrecio = null;
  }
  else if(vLimpio.includes("absceso")||v.toUpperCase().includes("ABSCESO")) {
    const resAbs = await Swal.fire({
      title: 'Absceso — Detalles',
      width: 460,
      html:
        '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;margin-top:8px;">' +
          '<div><p style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;">Tipo de absceso</p>' +
          '<div style="display:flex;gap:6px;">' +
            '<button type="button" onclick="window._absT=\'ABIERTO\';document.querySelectorAll(\'.btn-abs-t\').forEach(b=>b.style.opacity=\'0.4\');this.style.opacity=\'1\';" class="btn-abs-t" style="flex:1;padding:10px;border-radius:10px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:11px;color:#1d4ed8;cursor:pointer;">Abierto</button>' +
            '<button type="button" onclick="window._absT=\'CERRADO\';document.querySelectorAll(\'.btn-abs-t\').forEach(b=>b.style.opacity=\'0.4\');this.style.opacity=\'1\';" class="btn-abs-t" style="flex:1;padding:10px;border-radius:10px;border:2px solid #e9d5ff;background:#faf5ff;font-weight:900;font-size:11px;color:#7c3aed;cursor:pointer;">Cerrado</button>' +
          '</div></div>' +
          '<div style="display:flex;gap:16px;">' +
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="abs_anest" style="width:16px;height:16px;accent-color:#2563eb;"><span style="font-size:11px;font-weight:700;">Con Anestesia <b>(+$10)</b></span></label>' +
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="abs_sutura" style="width:16px;height:16px;accent-color:#2563eb;"><span style="font-size:11px;font-weight:700;">Con Sutura <b>(+$15)</b></span></label>' +
          '</div>' +
          '<div><label style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Precio base ($)</label>' +
          '<input type="number" id="abs_precio_base" value="' + (precioFinal||25) + '" step="1" min="0" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:14px;font-weight:900;outline:none;box-sizing:border-box;"></div>' +
        '</div>',
      showCancelButton: true, confirmButtonText: 'Agregar', confirmButtonColor: '#1d4ed8',
      preConfirm: function() {
        const tipo   = window._absT || 'ABIERTO';
        const anest  = document.getElementById('abs_anest')?.checked||false;
        const sutura = document.getElementById('abs_sutura')?.checked||false;
        const base   = parseFloat(document.getElementById('abs_precio_base')?.value)||25;
        const total  = base+(anest?10:0)+(sutura?15:0);
        const extras = []; if(anest)extras.push('anest'); if(sutura)extras.push('sutura');
        return {tipo,total,extras};
      }
    });
    window._absT = null;
    if (!resAbs.isConfirmed) { document.getElementById('selectorServicios').value=""; return; }
    precioFinal = resAbs.value.total;
    nombreFinal = 'ABSCESO '+resAbs.value.tipo+(resAbs.value.extras.length?' ('+resAbs.value.extras.join('+')+')':"");
  }
  else if(vLimpio.includes("vacunakc")){
    // Precio base: solo -> $45, en combo con otra vacuna -> $40
    // Se inserta primero con precio base; _recalcularCombos lo ajusta al final
    precioFinal=45;
  }
  else if(vLimpio.includes("hematologiacompleta")){
    // Precio base: solo -> $23, en combo con otro lab -> $20
    precioFinal=23;
  }
  else if(vLimpio.includes("vacunaantirrabica")){
    // Precio base: solo -> $30, en combo con otra vacuna -> $25
    precioFinal=30;
  }

  const grupoID="srv-"+Date.now();
  if(visual){if(visual.innerText.includes("Sin servicios"))visual.innerHTML="";const badge=document.createElement('div');badge.id="badge-"+grupoID;badge.className="bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-200 mb-1 flex items-center gap-2";badge.innerHTML=`<span></span><span class="flex-1">${nombreFinal}</span>`;visual.appendChild(badge);}
  document.getElementById('contenedorInsumos').classList.remove('hidden');
  const cuerpo=document.getElementById('listaInsumosDinamica');
  const ft=document.createElement('tr');ft.className="bg-slate-50 border-b-2 border-slate-200 text-slate-700 font-black servicio-principal";ft.setAttribute('data-grupo',grupoID);ft.setAttribute('data-precio',precioFinal);ft.setAttribute('data-porc',porcServ);
  ft.innerHTML=`<td colspan="3" class="p-2 text-[11px] uppercase">${nombreFinal} ($${precioFinal.toFixed(2)})<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2 text-[9px] border border-blue-200">${porcServ.toFixed(1)}% DOC</span></td><td class="p-2 text-center"><button onclick="window.eliminarServicioCompleto('${grupoID}',${precioFinal},event)" class="text-red-500 font-bold text-[11px]">X</button></td>`;
  cuerpo.appendChild(ft);

  let insNuevos=[];
  // Si el servicio tiene insumos configurados en Firebase, usarlos como fuente principal
  // (incluyen el campo bloqueado). Los fijos solo se agregan si NO hay insumos en Firebase.
  if (insumosFirebase && insumosFirebase.length > 0) {
    // Usar SOLO los de Firebase — ya contienen bloqueado:true/false configurado por el admin
    insNuevos = [...insumosFirebase];
    // Agregar insumos de vacuna base si aplica y no están ya
    if(vLimpio.includes("vacuna")){
      const yaHayVial=Array.from(cuerpo.querySelectorAll('td')).some(td=>td.innerText.includes("Vial"));
      if(!yaHayVial) insNuevos=[...insNuevos,...insumosBaseVacuna];
    }
  } else {
    // Sin Firebase: usar insumos fijos + recetas como antes
    if(cuerpo.querySelectorAll('.servicio-principal').length===1) insNuevos=[...insumosFijosMedicos];
    if(vLimpio.includes("vacuna")){const yaHayVial=Array.from(cuerpo.querySelectorAll('td')).some(td=>td.innerText.includes("Vial"));if(!yaHayVial)insNuevos=[...insNuevos,...insumosBaseVacuna];}
    const lrec=Object.keys(recetas).find(k=>normalizarNombre(k)===vLimpio);
    if(lrec&&recetas[lrec].insumos)insNuevos=[...insNuevos,...recetas[lrec].insumos];
  }

  insNuevos.forEach(ins=>{
    const tr=document.createElement('tr');
    const bloq = ins.bloqueado === true;
    tr.className=`border-b border-gray-100 insumo-fila ${grupoID}`;
    tr.dataset.bloqueado = bloq ? 'true' : 'false';
    const lockIcon = bloq ? ' &#128274;' : '';
    const bgColor = bloq ? 'background:#fffbeb;' : '';
    const btnHtml = bloq
      ? '<td class="p-2 text-center" style="color:#f59e0b;font-size:13px;cursor:not-allowed;" title="Insumo obligatorio">&#128274;</td>'
      : '<td class="p-2 text-center text-red-500 font-bold cursor-pointer text-[11px]" onclick="window.intentarEliminarInsumoFila(this)">X</td>';
    tr.innerHTML=`<td class="p-2 font-bold text-gray-700 text-[11px] italic" data-nombre="${ins.nombre.toUpperCase()}" style="${bgColor}">${ins.nombre.toUpperCase()}${lockIcon}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${ins.costo.toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td>${btnHtml}`;
    cuerpo.appendChild(tr);
  });

  await window.calcularTodo();
  document.getElementById('selectorServicios').value="";
  respaldarProgresoLocal();
  // Recalcular precios de combos DESPUES de insertar (actualiza los ya existentes)
  _recalcularCombos();
  // Verificar stock DESPUES de insertar
  _verificarStockServicio(v);
};

// --- AGREGAR MEDICAMENTO ---
window.agregarMedicamento = async (nombreMed) => {
  if (!nombreMed) return;
  if (nombreMed === "OTRO") {
    // Construir modal sin template literals problemáticos
    var htmlMed = '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;margin-top:8px;">';
    htmlMed += '<div><label style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px;">Nombre del medicamento</label>';
    htmlMed += '<input type="text" id="swal_med_nombre" placeholder="Ej: Clopidogrel..." style="width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:12px;outline:none;"></div>';
    htmlMed += '<div><label style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px;">Costo para el cliente ($)</label>';
    htmlMed += '<input type="number" id="swal_med_costo" step="0.50" min="0" placeholder="0.00" style="width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:12px;outline:none;"></div>';
    htmlMed += '<div style="display:flex;align-items:center;gap:8px;background:#f5f3ff;border-radius:10px;padding:10px;">';
    htmlMed += '<input type="checkbox" id="swal_med_guardar" style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;">';
    htmlMed += '<label for="swal_med_guardar" style="font-size:10px;font-weight:900;color:#6d28d9;cursor:pointer;">Guardar permanentemente en el listado de medicamentos</label>';
    htmlMed += '</div></div>';

    const res = await Swal.fire({
      title: 'Agregar Medicamento',
      html: htmlMed,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7c3aed',
      preConfirm: () => {
        const nombre = document.getElementById('swal_med_nombre')?.value.trim();
        const costo  = parseFloat(document.getElementById('swal_med_costo')?.value) || 0;
        const guardar = document.getElementById('swal_med_guardar')?.checked || false;
        if (!nombre) { Swal.showValidationMessage('Escribe el nombre.'); return false; }
        if (costo < 0) { Swal.showValidationMessage('Costo no puede ser negativo.'); return false; }
        return { nombre, costo, guardar };
      }
    });

    if (!res.isConfirmed) { document.getElementById('selectorMedicamentos').value = ""; return; }

    const { nombre, costo, guardar } = res.value;

    // Guardar permanentemente si se marcó el checkbox
    if (guardar) {
      // Verificar que hay doctor activo
      const doctorActivo = window.doctorVerificado || '';
      if (!doctorActivo) {
        await Swal.fire({
          icon: 'warning',
          title: 'Doctor no autenticado',
          text: 'Debes seleccionar y autenticar un doctor antes de guardar un medicamento permanentemente.',
          confirmButtonColor: '#7c3aed'
        });
        _insertarMedicamentoEnTabla(nombre, costo);
        document.getElementById('selectorMedicamentos').value = "";
        return;
      }
      try {
        await setDoc(doc(db, "medicamentos_maestro", nombre.toUpperCase()), {
          nombre: nombre.toUpperCase(),
          precioCliente: costo,
          creadoEn: serverTimestamp(),
          agregadoPor: doctorActivo,
          activo: true
        }, { merge: true });
        await Swal.fire({ icon:'success', title:'Medicamento guardado', text: nombre.toUpperCase()+' agregado al listado permanente.', timer:2000, showConfirmButton:false });
        // Recargar selector
        if (typeof window.cargarSelectorMedicamentos === 'function') {
          window.cargarSelectorMedicamentos();
        }
        Swal.fire({ icon: 'success', title: 'Guardado en el listado', text: nombre, timer: 1500, showConfirmButton: false });
      } catch(e) { console.warn('Error guardando medicamento:', e); }
    }

    _insertarMedicamentoEnTabla(nombre, costo);
    document.getElementById('selectorMedicamentos').value = "";
    return;
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
  if(visual){if(visual.innerText.includes("Sin servicios"))visual.innerHTML="";const badge=document.createElement('div');badge.id="badge-"+grupoID;badge.className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200 mb-1 flex items-center gap-2";badge.innerHTML=`<span></span><span class="flex-1 font-bold text-[10px]">${descripcion}</span>`;visual.appendChild(badge);}
  document.getElementById('contenedorInsumos').classList.remove('hidden');
  const cuerpo=document.getElementById('listaInsumosDinamica');
  const ft=document.createElement('tr');ft.className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black servicio-principal";ft.setAttribute('data-grupo',grupoID);ft.setAttribute('data-precio',precioCliente);ft.setAttribute('data-porc',40);
  ft.innerHTML=`<td colspan="3" class="p-2 text-[11px] uppercase">${descripcion} ($${precioCliente.toFixed(2)})<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2 text-[9px]">MEDICAMENTO</span></td><td class="p-2 text-center"><button onclick="window.eliminarServicioCompleto('${grupoID}',${precioCliente},event)" class="text-red-500 font-bold text-[11px]">X</button></td>`;
  cuerpo.appendChild(ft);
  if(!insumosBaseMedAgregados){[{nombre:"Jeringa para medicamento",costo:0.50},{nombre:"Algodon",costo:0.10},{nombre:"Alcohol",costo:0.10}].forEach(ins=>{const tr=document.createElement('tr');tr.className=`border-b border-gray-100 insumo-fila bg-yellow-50 ${grupoID}`;tr.innerHTML=`<td class="p-2 font-bold text-[11px] italic">${ins.nombre.toUpperCase()}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${ins.costo.toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td><td class="p-2 text-center text-red-500 font-bold cursor-pointer text-[11px]" onclick="window.intentarEliminarInsumoFila(this)">X</td>`;cuerpo.appendChild(tr);});insumosBaseMedAgregados=true;}
  window.calcularTodo();respaldarProgresoLocal();
}

// --- MOTOR FINANCIERO ---
// ── ELIMINAR INSUMO DEL HISTORIAL CON VERIFICACION DE CANDADO ────────────────
window.intentarEliminarInsumoFila = async (btnEl) => {
  const tr = btnEl.closest('tr');
  if (!tr) return;
  // Leer bloqueado directamente del data attribute del TR (guardado al renderizar)
  if (tr.dataset.bloqueado === 'true') {
    const tdNom = tr.querySelector('td');
    const nombreInsumo = tdNom ? (tdNom.dataset.nombre || tdNom.textContent.replace('\u{1F512}','').trim()) : 'este insumo';
    await Swal.fire({
      icon: 'warning',
      title: 'Insumo obligatorio',
      html: '<p style="font-size:11px;">&#128274; <b>' + nombreInsumo + '</b> es un insumo obligatorio y no puede ser eliminado.<br><br>Si no se uso, avisa al administrador.</p>',
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'Entendido'
    });
    return;
  }
  tr.remove();
  window.calcularTodo();
};

window.calcularTodo = async () => {
  let totalComision=0,totalGastos=0,totalVenta=0;
  // Usa SIEMPRE el % individual del servicio (porcDoc en data-porc)
  // El porcentaje global fue eliminado — cada servicio tiene su propio %
  document.querySelectorAll('.servicio-principal').forEach(fila=>{const precio=parseFloat(fila.getAttribute('data-precio'))||0;const porc=parseFloat(fila.getAttribute('data-porc'))||0;const grupoID=fila.getAttribute('data-grupo');let gastos=0;document.querySelectorAll(`.${grupoID}.insumo-fila`).forEach(ins=>{gastos+=(parseFloat(ins.querySelector('.i-cant')?.value)||0)*(parseFloat(ins.querySelector('.i-cost')?.value)||0);});totalVenta+=precio;totalGastos+=gastos;const util=precio-gastos;if(util>0)totalComision+=util*(porc/100);});
  const iv=document.getElementById('precioVenta');if(iv)iv.value=totalVenta.toFixed(2);
  const ig=document.getElementById('gastoInsumos');if(ig)ig.value=totalGastos.toFixed(2);
  const id=document.getElementById('montoDoctor');if(id)id.innerText=`$ ${totalComision.toFixed(2)}`;
};

// --- ELIMINAR SERVICIO ---
window.eliminarServicioCompleto = async (idGrupo, precioARestar, event) => {
  if(event)event.preventDefault();if(!confirm("?Eliminar este servicio y sus insumos?"))return;
  document.getElementById("badge-"+idGrupo)?.remove();
  const ft=document.querySelector(`[data-grupo="${idGrupo}"]`);if(ft)ft.remove();
  document.querySelectorAll('tr.insumo-fila').forEach(tr=>{if(tr.classList.contains(idGrupo))tr.remove();});
  const filasRest=document.querySelectorAll('.servicio-principal');
  if(filasRest.length===0){document.getElementById('contenedorInsumos')?.classList.add('hidden');const visual=document.getElementById('visualizacionServicios');if(visual)visual.innerHTML='<p class="text-slate-400 font-normal italic text-[11px]">Sin servicios registrados...</p>';insumosBaseMedAgregados=false;}
  _recalcularCombos();
  await window.calcularTodo();
};

// --- INSUMO MANUAL ---
window.agregarInsumoManual = () => {
  const n=document.getElementById('nombreExtra');const c=document.getElementById('costoExtra');if(!n?.value)return alert("Ingrese nombre.");
  const filas=document.querySelectorAll('.servicio-principal');const ultimoGrp=filas.length>0?filas[filas.length-1].getAttribute('data-grupo'):"manual";
  const tr=document.createElement('tr');tr.className=`border-b border-gray-100 insumo-fila bg-yellow-50 ${ultimoGrp}`;tr.innerHTML=`<td class="p-2 font-bold text-[11px] italic">${n.value.toUpperCase()}</td><td class="p-2 text-center"><input type="number" value="1" oninput="window.calcularTodo()" class="i-cant w-12 text-center border rounded"></td><td class="p-2 text-center"><input type="number" value="${parseFloat(c?.value||0).toFixed(2)}" step="0.01" oninput="window.calcularTodo()" class="i-cost w-16 text-center border rounded"></td><td class="p-2 text-center text-red-500 font-bold cursor-pointer text-[11px]" onclick="window.intentarEliminarInsumoFila(this)">X</td>`;
  document.getElementById('listaInsumosDinamica').appendChild(tr);n.value="";if(c)c.value="";window.calcularTodo();
};

// --- VACUNA YA PAGADA ---
window.toggleVacunaPagada = (marcado) => {
  window.vacunaPagadaAnteriormente=marcado;const inputPrecio=document.getElementById('precioVenta');if(inputPrecio){inputPrecio.style.textDecoration=marcado?'line-through':'none';inputPrecio.style.color=marcado?'#f59e0b':'';}let aviso=document.getElementById('avisoVacunaPagada');if(!aviso){aviso=document.createElement('div');aviso.id='avisoVacunaPagada';aviso.className='no-print text-center text-[10px] font-black text-amber-600 uppercase mt-1';aviso.innerText='(!) La vacuna NO se sumara a la caja ni al doctor';document.getElementById('precioVenta')?.parentElement?.appendChild(aviso);}aviso.classList.toggle('hidden',!marcado);
};

// --- GUARDAR EN FIREBASE ---
window.guardarFirebase = async (imp) => {
  // Validaciones obligatorias ANTES del PIN
  const _dv = (id) => document.getElementById(id)?.value?.trim() || "";
  if (!_dv('hCI')) {
    await Swal.fire({ icon:'warning', title:'Cedula obligatoria', text:'Debes ingresar la cedula del propietario antes de guardar.', confirmButtonColor:'#1d4ed8' });
    document.getElementById('hCI')?.focus();
    return;
  }
  if (!_dv('hNombre')) {
    await Swal.fire({ icon:'warning', title:'Nombre del paciente obligatorio', text:'Debes ingresar el nombre de la mascota antes de guardar.', confirmButtonColor:'#1d4ed8' });
    document.getElementById('hNombre')?.focus();
    return;
  }
  const selectorDoc=document.getElementById('selectDoctor');
  let nombreDoctor=selectorDoc?selectorDoc.value:"";
  // Fallback: usar doctorVerificado si el select está vacío pero el doctor ya se autenticó
  if (!nombreDoctor && window.doctorVerificado) {
    nombreDoctor = window.doctorVerificado;
    // Restaurar el valor del select también
    if (selectorDoc) selectorDoc.value = nombreDoctor;
  }
  // Si hay sesión admin activa, usar usuario activo
  if (!nombreDoctor && window.sesionAdminActiva) {
    nombreDoctor = window.usuarioActivoSistema || 'Administrador';
  }
  if(!nombreDoctor)return alert("(!) Seleccione un doctor.");
  // Si el doctor ya se autenticó con su PIN, no pedir PIN de nuevo
  const _docVerif = (window.doctorVerificado||'').trim().toLowerCase();
  const _docSel   = (nombreDoctor||'').trim().toLowerCase();
  // Si hay sesión admin activa tampoco pedir PIN
  if (!window.sesionAdminActiva && (!_docVerif || _docVerif !== _docSel)) {
    const pinIngresado=prompt(`Firma Medica: Dr(a). ${nombreDoctor}\nIngrese su PIN:`);
    if(!pinIngresado)return;
    const esValido=await window.validarDoctorConMaster(nombreDoctor,pinIngresado);
    if(!esValido)return alert("PIN incorrecto.");
  }
  const btn=document.activeElement;const textoOrig=btn?.innerText||"Guardar";if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.innerText="? PROCESANDO...";}
  try{
    const leerImg=(a)=>new Promise(res=>{const r=new FileReader();r.readAsDataURL(a);r.onload=e=>res(e.target.result);r.onerror=()=>res("");});
    const fileH=document.getElementById('inputFotoHistoria')?.files[0];const fileT=document.getElementById('inputFotoTest')?.files[0];
    let urlFoto=fileH?await comprimirImagen(await leerImg(fileH)):(document.getElementById('pUrlExamen')?.value||"");let urlTest=fileT?await comprimirImagen(await leerImg(fileT)):(document.getElementById('pUrlTest')?.value||"");
    const listaTests=[];document.querySelectorAll('#cuerpoTablaCertificado tr').forEach(fila=>{const nombre=fila.cells[0]?.querySelector('input')?.value.trim()||fila.cells[0]?.querySelector('span')?.innerText?.trim()||"";const span=fila.cells[1]?.querySelector('.resultado-print');const sel=fila.cells[1]?.querySelector('select');const resultado=(span?.innerText?.trim()&&span.innerText.trim()!=="---")?span.innerText.trim():(sel?.value||"---");const nota=fila.cells[2]?.querySelector('input')?.value?.trim()||"";if(nombre)listaTests.push({nombre,resultado,nota});});
    // --- Preguntas extra por servicio (ej: eutanasia -> cuanto Propofol se usó) ---
    for (const fila of Array.from(document.querySelectorAll('.servicio-principal'))) {
      const nomServAsk=(fila.querySelector('td')?.innerText||'').replace(/[🔹💊]/g,'').split('(')[0].trim();
      if (!nomServAsk || fila.dataset.preguntaHecha==='1') continue;
      try {
        let snapPq = await getDoc(doc(db,"servicios_maestro",nomServAsk));
        if (!snapPq.exists()) snapPq = await getDoc(doc(db,"servicios_maestro",nomServAsk.toUpperCase()));
        if (!snapPq.exists()) continue;
        const rdPq = snapPq.data();
        if (!rdPq.preguntaActiva || !rdPq.preguntaInsumo) continue;
        const costoPote = parseFloat(rdPq.preguntaCostoPote)||0;
        const costoCC = parseFloat(rdPq.preguntaCostoCC)||parseFloat(rdPq.preguntaCostoUnidad)||0;
        const { value: respPq } = await Swal.fire({
          title: nomServAsk,
          html: '<div style="text-align:left;">'+
            '<p style="font-size:11px;color:#475569;margin-bottom:10px;">'+(rdPq.preguntaTexto||'¿Cuánto se utilizó?')+'</p>'+
            '<div style="display:flex;gap:8px;">'+
            '<select id="pq_unidad_sel" style="flex:1;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;background:#fff;">'+
            '<option value="pote">Pote(s) / Frasco(s) completo(s)</option>'+
            '<option value="cc">CC / ml</option>'+
            '</select>'+
            '<input id="pq_cant_sel" type="number" min="0" step="0.1" placeholder="Cantidad" style="flex:1;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:13px;font-weight:900;outline:none;"></div>'+
            '</div>',
          confirmButtonText: 'Confirmar',
          confirmButtonColor:'#7c3aed',
          allowOutsideClick:false,
          preConfirm: () => {
            const unidad = document.getElementById('pq_unidad_sel').value;
            const cantidad = parseFloat(document.getElementById('pq_cant_sel').value);
            if (isNaN(cantidad) || cantidad < 0) { Swal.showValidationMessage('Ingresa una cantidad válida'); return false; }
            return { unidad, cantidad };
          }
        });
        fila.dataset.preguntaHecha='1';
        if (!respPq) continue;
        const { unidad: unidadUsada, cantidad: cantidadUsada } = respPq;
        const costoPorUnidad = unidadUsada==='pote' ? costoPote : costoCC;
        const costoTotal = cantidadUsada * costoPorUnidad;
        const grupoID=fila.getAttribute('data-grupo');
        const filaInsumo=Array.from(document.querySelectorAll(`.${grupoID}.insumo-fila`)).find(ins=>(ins.cells[0]?.innerText||'').toUpperCase().includes((rdPq.preguntaInsumo||'').toUpperCase()));
        if (filaInsumo) {
          const inpCant=filaInsumo.querySelector('.i-cant');
          const inpCost=filaInsumo.querySelector('.i-cost');
          // Se guarda cantidad=1 y costo=costoTotal para que el total ($1 x costoTotal) quede correcto
          // sin importar si el doctor respondió en potes o en cc (se suma igual a insumos).
          if (inpCant) inpCant.value=1;
          if (inpCost) inpCost.value=costoTotal.toFixed(4);
        }
      } catch(e) { console.warn('Error en pregunta extra:', e); }
    }
    // Usa % individual de cada servicio (porcGlobal eliminado)
    const montoVentaTotal=parseFloat(document.getElementById('precioVenta')?.value)||0;let totalGastos=0,pagoDoctorTotal=0;const detalleInsumos=[];const serviciosRealizados=[];
    document.querySelectorAll('.servicio-principal').forEach(fila=>{const grupoID=fila.getAttribute('data-grupo');const precioServ=parseFloat(fila.getAttribute('data-precio'))||0;const pEfect=parseFloat(fila.getAttribute('data-porc'))||0;const nomServ=(fila.querySelector('td')?.innerText||'').replace(/[🔹💊]/g,'').split('(')[0].trim();serviciosRealizados.push({nombre:nomServ,precio:precioServ});let gastosGrupo=0;document.querySelectorAll(`.${grupoID}.insumo-fila`).forEach(ins=>{const cant=parseFloat(ins.querySelector('.i-cant')?.value)||0;const costo=parseFloat(ins.querySelector('.i-cost')?.value)||0;gastosGrupo+=cant*costo;detalleInsumos.push({nombre:ins.cells[0].innerText.replace(/[??]/g,'').trim(),cant,costo});});totalGastos+=gastosGrupo;const util=Math.max(0,precioServ-gastosGrupo);pagoDoctorTotal+=util*(pEfect/100);});
    let montoVacunaPendiente=0;if(window.vacunaPagadaAnteriormente){document.querySelectorAll('.servicio-principal').forEach(fila=>{if(normalizarNombre(fila.innerText).includes("vacuna"))montoVacunaPendiente+=parseFloat(fila.getAttribute('data-precio'))||0;});}
    const montoVentaFinal=window.vacunaPagadaAnteriormente?Math.max(0,montoVentaTotal-montoVacunaPendiente):montoVentaTotal;const gastosFinal=window.vacunaPagadaAnteriormente?Math.max(0,totalGastos-montoVacunaPendiente*0.3):totalGastos;const pagoDoctorFinal=window.vacunaPagadaAnteriormente?Math.max(0,pagoDoctorTotal-montoVacunaPendiente*0.5):pagoDoctorTotal;
    const leerTablaVac=()=>{const res={vacunas:[],desparasitaciones:[]};try{const tablas=document.querySelector('#bloqueVacunas')?.querySelectorAll('table');tablas?.[0]?.querySelectorAll('tbody tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length<5)return;const fecha=c[0].querySelector('input')?.value.trim()||"";const vacuna=c[1].querySelector('input')?.value.trim()||"";const peso=c[2].querySelector('input')?.value.trim()||"";const proxima=c[3].querySelector('input')?.value.trim()||"";const firma=c[4].querySelector('input')?.value.trim()||"";if(fecha||vacuna)res.vacunas.push({fecha,vacuna,peso,proxima,firma});});tablas?.[1]?.querySelectorAll('tbody tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length<5)return;const fecha=c[0].querySelector('input')?.value.trim()||"";const producto=c[1].querySelector('input')?.value.trim()||"";const peso=c[2].querySelector('input')?.value.trim()||"";const proxima=c[3].querySelector('input')?.value.trim()||"";const firma=c[4].querySelector('input')?.value.trim()||"";if(fecha||producto)res.desparasitaciones.push({fecha,producto,peso,proxima,firma});});}catch(e){console.warn(e);}return res;};const datosVac=leerTablaVac();
    const getFotos=(id)=>{const g=document.getElementById(id);if(!g)return[];return Array.from(g.querySelectorAll('img')).map(img=>img.src).filter(Boolean);};const fotosH=getFotos('previewHistoriaGallery');const fotosT=getFotos('previewTestGallery');const dInput=(id)=>document.getElementById(id)?.value?.trim()||"";
    const data={cedula:dInput('hCI'),propietario:dInput('hProp'),paciente:dInput('hNombre'),especie:dInput('hEspecie'),raza:dInput('hRaza'),sexo:dInput('hSexo'),edad:dInput('hEdad'),peso:dInput('hPeso'),color:dInput('hColor'),telefono:dInput('hTlf'),correo:dInput('hMail'),direccion:dInput('hDir'),fechaNacimiento:dInput('hFechaNac'),alerta:document.getElementById('hAlerta')?.checked||false,doctor:nombreDoctor,urlExamen:fotosH.length>0?fotosH[fotosH.length-1]:urlFoto,urlFotoTest:fotosT.length>0?fotosT[fotosT.length-1]:urlTest,fotosHistoria:fotosH,fotosTest:fotosT,testsRealizados:listaTests,vacunasAplicadas:datosVac.vacunas,desparasitacionesAplicadas:datosVac.desparasitaciones,montoVenta:montoVentaFinal,montoInsumos:gastosFinal,pagoDoctor:pagoDoctorFinal,pagoAvipet:montoVentaFinal-gastosFinal-pagoDoctorFinal,vacunaPagadaAnteriormente:window.vacunaPagadaAnteriormente||false,listaDetalladaInsumos:detalleInsumos,serviciosRealizados:serviciosRealizados,tratamiento:dInput('hTratamiento'),fecha:serverTimestamp(),fechaSimple:new Date().toLocaleDateString()};
    if (window._editandoConsultaId) {
      const idEditar = window._editandoConsultaId;
      await updateDoc(doc(db,"consultas",idEditar), {...data, ultimaEdicion:serverTimestamp(), editadoPor:nombreDoctor});
      window._editandoConsultaId = null;
      document.getElementById('bannerModoEdicion')?.classList.add('hidden');
      alert("✅ Consulta actualizada con éxito!");
    } else {
      await addDoc(collection(db,"consultas"),data);
      alert("✅ ¡Consulta guardada con éxito!");
    }
    // ── Decrementar stock de inventario por insumos usados ──────────────────
    if (detalleInsumos.length > 0) {
      try {
        const snapInv = await getDocs(collection(db,"inventario"));
        const invMap = {};
        snapInv.forEach(d => {
          const nombre = normalizarNombre(d.data().nombre || '');
          if (nombre) invMap[nombre] = { id: d.id, stock: parseFloat(d.data().cantidadStock||0) };
        });
        for (const ins of detalleInsumos) {
          const clave = normalizarNombre(ins.nombre || '');
          const entrada = invMap[clave];
          if (!entrada) continue;
          const nuevoStock = Math.max(0, entrada.stock - (ins.cant || 0));
          await updateDoc(doc(db,"inventario",entrada.id), {
            cantidadStock: nuevoStock,
            ultimaActualizacion: serverTimestamp()
          });
          await addDoc(collection(db,"movimientos_inventario"), {
            productoId: entrada.id,
            productoNombre: ins.nombre,
            tipo: "SALIDA-CONSULTA",
            cantidad: ins.cant || 0,
            stockResultante: nuevoStock,
            fecha: serverTimestamp(),
            doctor: nombreDoctor,
            cedula: data.cedula
          });
        }
      } catch(eInv) { console.warn("Error descontando stock:", eInv); }
    }
    localStorage.removeItem('respaldo_historia_activa');
    _limpiarFormularioHistoria();
    _limpiarNotasInternas();
    if(imp)window.imprimirDocumento();
  }catch(e){console.error("Error guardando:",e);alert("? Error: "+e.message);}
  finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.innerText=textoOrig;}}
};

// --- CALCULO DE EDAD DESDE FECHA DE NACIMIENTO ---
function _calcularEdadDesdeFechaNac(fechaNac) {
  if (!fechaNac) return;
  try {
    // Soporta YYYY-MM-DD (input type=date) y DD/MM/YYYY (formato local)
    let nac;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaNac)) {
      nac = new Date(fechaNac + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNac)) {
      const [d, m, y] = fechaNac.split('/');
      nac = new Date(`${y}-${m}-${d}T00:00:00`);
    } else { return; }
    if (isNaN(nac)) return;
    const hoy = new Date();
    let anios = hoy.getFullYear() - nac.getFullYear();
    let meses = hoy.getMonth() - nac.getMonth();
    let dias  = hoy.getDate() - nac.getDate();
    if (dias < 0)  { meses--; dias += 30; }
    if (meses < 0) { anios--; meses += 12; }
    let edadStr = '';
    if (anios > 0)       edadStr = anios + (anios === 1 ? ' año' : ' años');
    else if (meses > 0)  edadStr = meses + (meses === 1 ? ' mes' : ' meses');
    else                 edadStr = dias + ' días';
    const inp = document.getElementById('hEdad');
    if (inp) inp.value = edadStr;
  } catch(e) { console.warn('Error calculando edad:', e); }
}

// --- AUTOCOMPLETAR POR CEDULA + ALERTA VACUNA + NOTAS INTERNAS ---
// Verificar vacunas vencidas - funcion separada sin caracteres especiales
async function _verificarVacunasVencidas(datos) {
  if (!Array.isArray(datos.vacunasAplicadas) || datos.vacunasAplicadas.length === 0) return;
  try {
    const hoy = new Date();
    const vencidas = [];
    datos.vacunasAplicadas.forEach(function(vac) {
      if (!vac.proxima) return;
      const p = vac.proxima.split('/');
      if (p.length === 3) {
        const fp = new Date(p[2], p[1]-1, p[0]);
        if (fp < hoy) {
          vencidas.push((vac.vacuna || 'Vacuna') + ' vencio el ' + vac.proxima);
        }
      }
    });
    if (vencidas.length === 0) return;
    const lista = vencidas.map(function(v) { return '- ' + v; }).join('<br>');
    await Swal.fire({
      icon: 'warning',
      title: 'Vacunas Vencidas',
      html: '<p style="font-size:11px;color:#64748b;margin-bottom:8px;">Este paciente tiene vacunas atrasadas:</p>' +
            '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:10px;text-align:left;">' +
            '<p style="font-size:11px;color:#dc2626;font-weight:700;">' + lista + '</p>' +
            '</div>',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#dc2626',
      timer: 8000,
      timerProgressBar: true
    });
  } catch(e) { console.warn('Error verificando vacunas:', e); }
}

window.autocompletarPorCedula = async (ci) => {
  if(!ci||ci.length<3)return;
  const ciNorm = normalizarCedula(ci);
  try{
    // Buscar TODAS las consultas de esta cedula para encontrar todas las mascotas
    let snapTodas = await getDocs(query(collection(db,"consultas"),where("cedula","==",ciNorm),orderBy("fecha","desc")));
    if(snapTodas.empty && ciNorm !== ci.trim()) {
      snapTodas = await getDocs(query(collection(db,"consultas"),where("cedula","==",ci.trim()),orderBy("fecha","desc")));
    }
    if(snapTodas.empty) return;

    // Recopilar todas las mascotas unicas con sus datos mas recientes
    const mascotasMap = new Map();
    snapTodas.forEach(docSnap => {
      const r = docSnap.data();
      if (r.paciente && !mascotasMap.has(r.paciente.toUpperCase())) {
        mascotasMap.set(r.paciente.toUpperCase(), r); // guardar datos completos
      }
    });

    // Datos del propietario (del registro mas reciente)
    const datosBase = snapTodas.docs[0].data();
    const set=(id,val)=>{const el=document.getElementById(id);if(el){el.value=val||"";el.classList.add('bg-blue-50');setTimeout(()=>el.classList.remove('bg-blue-50'),1000);}};

    // Llenar datos del propietario siempre
    set('hProp', datosBase.propietario);
    set('hTlf',  datosBase.telefono);
    set('hMail', datosBase.correo||datosBase.email);
    set('hDir',  datosBase.direccion);

    // Alerta restriccion
    if(datosBase.alerta){const el=document.getElementById('hProp');if(el){el.style.color="#b91c1c";el.style.fontWeight="bold";}alert("(!) ATENCION: Este cliente tiene una RESTRICCION ADMINISTRATIVA.");}

    let datosSeleccionados = datosBase;

    if (mascotasMap.size > 1) {
      // Mostrar selector de mascotas
      const mascotas = Array.from(mascotasMap.entries());
      var htmlSel = '<p style="font-size:11px;color:#64748b;margin-bottom:10px;">Propietario: <b>' + (datosBase.propietario||'') + '</b></p>';
      htmlSel += '<div style="display:flex;flex-direction:column;gap:6px;">';
      mascotas.forEach(function(m) {
        const r = m[1];
        htmlSel += '<button class="btn-sel-mascota-vet" data-nombre="' + m[0] + '" ' +
          'style="width:100%;padding:10px 14px;border-radius:10px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:12px;color:#1d4ed8;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + m[0] + '</span>' +
          '<span style="font-size:9px;color:#64748b;font-weight:600;">' + (r.especie||'') + ' . ' + (r.raza||'') + '</span>' +
          '</button>';
      });
      htmlSel += '<button class="btn-sel-mascota-vet" data-nombre="__nueva__" ' +
        'style="width:100%;padding:10px 14px;border-radius:10px;border:2px solid #e2e8f0;background:#f8fafc;font-weight:900;font-size:11px;color:#64748b;cursor:pointer;">Nuevo paciente</button>';
      htmlSel += '</div>';

      const resSel = await Swal.fire({
        title: '? ?Cual paciente viene hoy?',
        html: htmlSel,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        didOpen: function() {
          document.querySelectorAll('.btn-sel-mascota-vet').forEach(function(btn) {
            btn.addEventListener('click', function() {
              window._mascotaSelVet = this.dataset.nombre;
              Swal.clickConfirm();
            });
          });
        }
      });

      if (resSel.isDismissed) return;
      const nombreSel = window._mascotaSelVet;
      window._mascotaSelVet = null;

      if (nombreSel === '__nueva__') {
        // Solo llenar datos del propietario, limpiar mascota
        set('hNombre',''); set('hEspecie',''); set('hRaza','');
        set('hEdad',''); set('hSexo',''); set('hPeso',''); set('hColor',''); set('hFechaNac','');
        _mostrarNotasInternas(ciNorm, datosBase.observacionesPermanentes || "");
        return;
      }

      datosSeleccionados = mascotasMap.get(nombreSel) || datosBase;
    }

    // Llenar datos de la mascota seleccionada
    set('hNombre',   datosSeleccionados.paciente);
    set('hEspecie',  datosSeleccionados.especie);
    set('hRaza',     datosSeleccionados.raza);
    set('hEdad',     datosSeleccionados.edad);
    set('hSexo',     datosSeleccionados.sexo);
    set('hPeso',     datosSeleccionados.peso);
    set('hColor',    datosSeleccionados.color);
    set('hFechaNac', datosSeleccionados.fechaNacimiento);
    _calcularEdadDesdeFechaNac(datosSeleccionados.fechaNacimiento);

    // Verificar vacunas vencidas
    await _verificarVacunasVencidas(datosSeleccionados);

    // Notas internas
    _mostrarNotasInternas(ciNorm, datosBase.observacionesPermanentes || "");

  }catch(e){console.error("Error autocompletar:",e);}
};

// --- NOTAS INTERNAS POR PACIENTE ---
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
  } catch(e){console.error(e);alert("? Error: "+e.message);}
};

// --- FOTOS ---
window.previsualizarFotoHistoria = (event) => {
  const files=event.target.files;const galeria=document.getElementById('previewHistoriaGallery');const cont=document.getElementById('previewHistoriaContainer');const hidden=document.getElementById('pUrlExamen');if(!files?.length||!galeria)return;
  Array.from(files).forEach(file=>{const reader=new FileReader();reader.onload=async(e)=>{const dataUrl=await comprimirImagen(e.target.result);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${dataUrl}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHiddenHistoria()">X</button>`;galeria.appendChild(wrapper);if(cont)cont.classList.remove('hidden');if(hidden)hidden.value=dataUrl;};reader.readAsDataURL(file);});event.target.value="";
};
window.sincronizarHiddenHistoria=()=>{const galeria=document.getElementById('previewHistoriaGallery');const hidden=document.getElementById('pUrlExamen');if(!galeria||!hidden)return;const imgs=galeria.querySelectorAll('img');if(imgs.length===0){hidden.value="";document.getElementById('previewHistoriaContainer')?.classList.add('hidden');}else hidden.value=imgs[imgs.length-1].src;};
window.previsualizarFotoTest=(event)=>{const files=event.target.files;const galeria=document.getElementById('previewTestGallery');const cont=document.getElementById('previewTestContainer');const hidden=document.getElementById('pUrlTest');if(!files?.length||!galeria)return;Array.from(files).forEach(file=>{const reader=new FileReader();reader.onload=async(e)=>{const dataUrl=await comprimirImagen(e.target.result);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${dataUrl}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHiddenTest()">X</button>`;galeria.appendChild(wrapper);if(cont)cont.classList.remove('hidden');if(hidden)hidden.value=dataUrl;};reader.readAsDataURL(file);});event.target.value="";};
window.sincronizarHiddenTest=()=>{const galeria=document.getElementById('previewTestGallery');const hidden=document.getElementById('pUrlTest');if(!galeria||!hidden)return;const imgs=galeria.querySelectorAll('img');if(imgs.length===0){hidden.value="";document.getElementById('previewTestContainer')?.classList.add('hidden');}else hidden.value=imgs[imgs.length-1].src;};

// --- QR MOVIL ---
window.generarEnlaceMovil=(tipo='historia')=>{const cedula=document.getElementById('hCI')?.value.trim();if(!cedula)return alert("(!) Escribe la Cedula primero.");const qrDivID=tipo==='test'?"qrcodeTest":"qrcode";const contID=tipo==='test'?"qrContainerTest":"qrContainer";const qrDiv=document.getElementById(qrDivID);if(qrDiv)qrDiv.innerHTML="";const url=`${window.location.origin}${window.location.pathname}?mode=mobile&ci=${cedula}&tipo=${tipo}`;new QRCode(qrDiv,{text:url,width:128,height:128});document.getElementById(contID)?.classList.remove('hidden');const ahora=new Date();if(tipo==='historia')window._ultimaSesionQRHistoria=ahora;if(tipo==='test')window._ultimaSesionQRTest=ahora;const q=query(collection(db,"transferencias_fotos"),where("ci","==",cedula),where("tipo","==",tipo));if(tipo==='historia'&&window._unsubHist)window._unsubHist();if(tipo==='test'&&window._unsubTest)window._unsubTest();const unsub=onSnapshot(q,snap=>{const galeriaId=tipo==='test'?'previewTestGallery':'previewHistoriaGallery';const contIdG=tipo==='test'?'previewTestContainer':'previewHistoriaContainer';const hiddenId=tipo==='test'?'pUrlTest':'pUrlExamen';const galeria=document.getElementById(galeriaId);const cont=document.getElementById(contIdG);const hidden=document.getElementById(hiddenId);if(!galeria||!cont)return;const urlsExist=new Set(Array.from(galeria.querySelectorAll('img')).map(img=>img.src));const inicio=tipo==='historia'?window._ultimaSesionQRHistoria:window._ultimaSesionQRTest;snap.forEach(docSnap=>{const d=docSnap.data();if(!d.url)return;if(d.fecha?.toDate&&d.fecha.toDate()<inicio)return;if(urlsExist.has(d.url))return;urlsExist.add(d.url);const wrapper=document.createElement('div');wrapper.className="relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";wrapper.innerHTML=`<img src="${d.url}" class="w-full h-full object-cover"><button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold" onclick="this.parentElement.remove();window.sincronizarHidden${tipo==='test'?'Test':'Historia'}()">X</button>`;galeria.appendChild(wrapper);if(hidden)hidden.value=d.url;});if(urlsExist.size>0)cont.classList.remove('hidden');});if(tipo==='historia')window._unsubHist=unsub;if(tipo==='test')window._unsubTest=unsub;};
window.mostrarInterfazSoloCamara=(ci,tipo)=>{const colorB=tipo==='test'?'bg-emerald-600':tipo==='compras'?'bg-purple-600':'bg-blue-600';const colorTx=tipo==='test'?'text-emerald-400':tipo==='compras'?'text-purple-400':'text-blue-400';document.body.innerHTML=`<div class="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center font-sans"><div class="w-full max-w-sm bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 text-center"><h1 class="text-xl font-black uppercase italic ${colorTx}">${tipo==='test'?'? TEST':'? HISTORIA'}</h1><p class="text-slate-400 text-[10px] mb-6 uppercase">CI: <b>${ci}</b></p><input type="file" id="mobileFileCamera" accept="image/*" capture="environment" class="hidden" onchange="window.procesarSubidaMovil(this,'${ci}','${tipo}')"><input type="file" id="mobileFileGallery" accept="image/*" multiple class="hidden" onchange="window.procesarSubidaMovil(this,'${ci}','${tipo}')"><div class="flex flex-col gap-3"><button onclick="document.getElementById('mobileFileCamera').click()" class="w-full ${colorB} py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95">TOMAR FOTO</button><button onclick="document.getElementById('mobileFileGallery').click()" class="w-full bg-slate-600 py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95">GALERIA</button></div><div id="statusMovil" class="mt-6 text-sm font-medium text-blue-300 italic">Listo...</div></div></div>`;};
window.procesarSubidaMovil=async(input,ci,tipo)=>{const status=document.getElementById('statusMovil');const files=input.files;if(!files?.length)return;if(status)status.innerText=`? Procesando ${files.length} foto(s)...`;let enviadas=0;try{for(const file of files){const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=e=>rej(e);r.readAsDataURL(file);});const comprimida=await comprimirImagen(base64);await addDoc(collection(db,"transferencias_fotos"),{ci,tipo,url:comprimida,fecha:serverTimestamp()});enviadas++;if(status)status.innerText=`? ${enviadas}/${files.length}...`;}if(status)status.innerHTML=`<b class='text-emerald-400'>${enviadas} foto(s) enviada(s)</b>`;}catch(e){if(status)status.innerText="? "+e.message;}};

// --- IMPRIMIR ---
window.imprimirDocumento=()=>{const doctor=document.getElementById('selectDoctor')?.value.toUpperCase()||"";const hTrat=document.getElementById('hTratamiento');const hPrint=document.getElementById('hTratamientoPrint');if(hTrat&&hPrint)hPrint.innerText=hTrat.value;try{const galPrev=document.getElementById('previewHistoriaGallery');const galPrint=document.getElementById('printHistoriaGallery');const contP=document.getElementById('printExamenCont');if(galPrev&&galPrint&&contP){galPrint.innerHTML="";const imgs=galPrev.querySelectorAll('img');imgs.forEach(img=>{const w=document.createElement('div');w.className="max-w-[45%] border border-slate-300 rounded-lg overflow-hidden";w.innerHTML=`<img src="${img.src}" class="w-full h-auto max-h-[300px] object-contain foto-anexo">`;galPrint.appendChild(w);});contP.classList.toggle('hidden',imgs.length===0);}}catch(e){console.warn(e);}setTimeout(()=>window.print(),500);};
window.imprimirRecetaLimpia=()=>{const texto=document.getElementById('hTratamiento')?.value||"";const paciente=document.getElementById('hNombre')?.value||"";const prop=document.getElementById('hProp')?.value||"";const urlExamen=document.getElementById('pUrlExamen')?.value||"";const win=window.open("","_blank","width=800,height=600");if(!win)return;win.document.write(`<html><head><title>Receta - AVIPET</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;}.header{border-bottom:3px solid #3b82f6;padding-bottom:10px;margin-bottom:20px;}h1{font-size:24px;margin:0;color:#1e3a8a;}.content{background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;min-height:200px;}pre{white-space:pre-wrap;font-size:14px;line-height:1.6;margin:0;}</style></head><body><div class="header"><h1>AVIPET - Centro Veterinario</h1><h2 style="font-size:13px;color:#64748b;margin:5px 0;">Paciente: <b>${paciente}</b> | Propietario: ${prop}</h2></div><div class="content"><pre>${texto}</pre></div>${urlExamen?`<div style="margin-top:20px;text-align:center;"><img src="${urlExamen}" style="max-width:350px;border-radius:10px;border:1px solid #ddd;"></div>`:''}<div style="margin-top:30px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #eee;padding-top:10px;">Documento generado por AVIPET.</div></body></html>`);win.document.close();win.onload=()=>setTimeout(()=>{win.focus();win.print();},300);};

// --- HOJA DE VACUNAS ---
window.abrirHojaVacunasDesdeHistoria=()=>{const dVal=(id)=>document.getElementById(id)?.value.trim()||"";const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||"";};const f=new Date();set('hv_fecha',`${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`);const campos={'hv_propietario':'hProp','hv_cedula':'hCI','hv_telefono':'hTlf','hv_direccion':'hDir','hv_especie':'hEspecie','hv_raza':'hRaza','hv_paciente':'hNombre','hv_edad':'hEdad','hv_sexo':'hSexo','hv_color':'hColor','hv_peso':'hPeso'};Object.entries(campos).forEach(([d,o])=>set(d,dVal(o)));set('hv_fechaNacimiento',dVal('hFechaNac'));document.getElementById('sectionHistoria')?.classList.add('hidden');const v=document.getElementById('sectionHojaVacunas');if(v){v.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}};

// --- SALA DE ESPERA ---
window.enviarAColaEspera=async()=>{
  try{
    const dVal=(id)=>document.getElementById(id)?.value.trim()||"";
    if(!dVal('hCI')||!dVal('hNombre')||!dVal('hProp')){
      alert("(!) Cedula, Propietario y Paciente son obligatorios.");return;
    }

    // Preguntar a que doctor se asigna
    var htmlDocSel = '<p style="font-size:11px;color:#64748b;margin-bottom:12px;">Asignar <b>' + dVal('hNombre') + '</b> a:</p>';
    htmlDocSel += '<div style="display:flex;flex-direction:column;gap:8px;">';
    htmlDocSel += '<button id="btnDocDarwin" type="button" style="width:100%;padding:14px;border-radius:12px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:14px;color:#1d4ed8;cursor:pointer;">Dr. Darwin Sandoval</button>';
    htmlDocSel += '<button id="btnDocJoan" type="button" style="width:100%;padding:14px;border-radius:12px;border:2px solid #a7f3d0;background:#ecfdf5;font-weight:900;font-size:14px;color:#065f46;cursor:pointer;">Dr. Joan Silva</button>';
    htmlDocSel += '</div>';
    const resDoc = await Swal.fire({
      title: 'Asignar Doctor',
      html: htmlDocSel,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      didOpen: function() {
        document.getElementById('btnDocDarwin').addEventListener('click', function() {
          window._docEspera = 'Darwin Sandoval'; Swal.clickConfirm();
        });
        document.getElementById('btnDocJoan').addEventListener('click', function() {
          window._docEspera = 'Joan Silva'; Swal.clickConfirm();
        });
      }
    });
    if (resDoc.isDismissed) return;
    const doctorAsignado = window._docEspera || '';
    window._docEspera = null;
    if (!doctorAsignado) return;

    const data={
      cedula:dVal('hCI'),propietario:dVal('hProp'),paciente:dVal('hNombre'),
      especie:dVal('hEspecie'),raza:dVal('hRaza'),edad:dVal('hEdad'),
      sexo:dVal('hSexo'),peso:dVal('hPeso'),telefono:dVal('hTlf'),
      correo:dVal('hMail'),direccion:dVal('hDir'),color:dVal('hColor'),
      fechaNacimiento:dVal('hFechaNac'),
      doctorAsignado,
      fechaIngreso:serverTimestamp(),
      fechaSimple:new Date().getDate()+'/'+(new Date().getMonth()+1)+'/'+new Date().getFullYear(),
      estado:"en_espera"
    };

    await addDoc(collection(db,"espera"),data);
    localStorage.removeItem("respaldo_historia_activa");
    _limpiarFormularioHistoria();
    _limpiarNotasInternas();
    await Swal.fire({
      icon:"success",
      title:"? Enviado a Sala de Espera",
      html:"<b>"+data.paciente+"</b><br><span class='text-[11px] text-slate-500'>Asignado al Dr. "+doctorAsignado+"</span>",
      timer:2500,showConfirmButton:false
    });
  }catch(e){console.error(e);alert("? Error: "+e.message);}
};
window.cargarListaEspera=async()=>{const cont=document.getElementById('listaEspera');if(!cont)return;cont.innerHTML="<p class='text-center text-slate-400 text-[10px]'>Cargando...</p>";try{const snap=await getDocs(collection(db,"espera"));const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));const filtrados=items.filter(i=>i.estado==="en_espera").sort((a,b)=>(a.fechaIngreso?.seconds||0)-(b.fechaIngreso?.seconds||0));if(!filtrados.length){cont.innerHTML="<p class='text-center text-slate-400 text-[10px]'>No hay pacientes en espera.</p>";return;}cont.innerHTML="";filtrados.forEach(p=>{const div=document.createElement('div');div.className="border rounded-lg p-2 bg-slate-50 flex justify-between items-center gap-2";const docAsig=p.doctorAsignado||"Sin asignar";const colorDoc=docAsig.includes("Darwin")?"text-blue-600":docAsig.includes("Joan")?"text-emerald-600":"text-slate-500";div.innerHTML=`<div><p class="font-bold uppercase text-[11px] text-slate-800">${p.paciente}</p><p class="text-[9px] text-slate-500">${p.propietario} . CI: ${p.cedula}</p><p class="text-[8px] font-black ${colorDoc} uppercase">${docAsig}</p></div><div class="flex gap-2"><button class="bg-blue-600 text-white text-[10px] px-3 py-1 rounded font-black uppercase" onclick="window.abrirPacienteDesdeEspera('${p.id}','${docAsig}')">Atender</button><button class="bg-red-500 text-white text-[10px] px-3 py-1 rounded font-black uppercase" onclick="window.eliminarDeSalaEspera('${p.id}')">Eliminar</button></div>`;cont.appendChild(div);});}catch(e){console.error(e);cont.innerHTML="<p class='text-center text-red-500 text-[10px]'>Error al cargar.</p>";}};
window.abrirPacienteDesdeEspera=async(idEspera, doctorAsignado)=>{try{const snap=await getDoc(doc(db,"espera",idEspera));if(!snap.exists()){alert("Registro no encontrado.");return;}const d=snap.data();
  // Verificar si el doctor activo es el correcto
  const doctorActivo = window.doctorVerificado || "";
  const docAsig = doctorAsignado || d.doctorAsignado || "";
  if (docAsig && doctorActivo && !doctorActivo.includes(docAsig.split(" ")[0]) && !docAsig.includes(doctorActivo.split(" ")[0])) {
    const res = await Swal.fire({
      icon: "warning",
      title: "(!) Paciente de otro doctor",
      html: `<p class="text-[11px] text-slate-600">Este paciente fue asignado al <b>${docAsig}</b>.<br><br>Estas conectado como <b>${doctorActivo}</b>.<br><br>?Deseas atenderlo de todas formas?</p>`,
      showCancelButton: true,
      confirmButtonText: "Si, atender",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f59e0b"
    });
    if (!res.isConfirmed) return;
  }const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||"";};set('hCI',d.cedula);set('hProp',d.propietario);set('hNombre',d.paciente);set('hEspecie',d.especie);set('hRaza',d.raza);set('hEdad',d.edad);set('hSexo',d.sexo);set('hPeso',d.peso);set('hTlf',d.telefono);set('hMail',d.correo);set('hDir',d.direccion);set('hColor',d.color);set('hFechaNac',d.fechaNacimiento);await updateDoc(doc(db,"espera",idEspera),{estado:"atendiendo",fechaAtencion:serverTimestamp()});window.showTab('historia');alert(`? ${d.paciente} cargado.`);}catch(e){console.error(e);alert("? Error: "+e.message);}};
window.eliminarDeSalaEspera=async(idEspera)=>{if(!confirm("?Eliminar de la sala de espera?"))return;try{await updateDoc(doc(db,"espera",idEspera),{estado:"eliminado",fechaEliminacion:serverTimestamp()});alert("? Eliminado.");window.cargarListaEspera();}catch(e){console.error(e);alert("? Error: "+e.message);}};

// --- LIMPIAR FORMULARIO COMPLETO -------------------------------------------
function _limpiarFormularioHistoria() {
  // Campos de texto
  ['hCI','hProp','hNombre','hEspecie','hRaza','hSexo','hEdad',
   'hPeso','hColor','hTlf','hMail','hDir','hTratamiento','hFechaNac']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  // Checkbox alerta
  const chkAlerta = document.getElementById('hAlerta');
  if (chkAlerta) { chkAlerta.checked = false; }

  // Fotos galeria historia
  const galeriaH = document.getElementById('previewHistoriaGallery');
  if (galeriaH) galeriaH.innerHTML = "";
  document.getElementById('previewHistoriaContainer')?.classList.add('hidden');
  const pUrlExamen = document.getElementById('pUrlExamen');
  if (pUrlExamen) pUrlExamen.value = "";

  // Fotos galeria test
  const galeriaT = document.getElementById('previewTestGallery');
  if (galeriaT) galeriaT.innerHTML = "";
  document.getElementById('previewTestContainer')?.classList.add('hidden');
  const pUrlTest = document.getElementById('pUrlTest');
  if (pUrlTest) pUrlTest.value = "";

  // QR containers
  document.getElementById('qrContainer')?.classList.add('hidden');
  document.getElementById('qrContainerTest')?.classList.add('hidden');

  // Servicios y tabla de insumos
  const visual = document.getElementById('visualizacionServicios');
  if (visual) visual.innerHTML = '<p class="text-[10px] text-slate-400 italic">Sin servicios registrados</p>';
  const cuerpo = document.getElementById('listaInsumosDinamica');
  if (cuerpo) cuerpo.innerHTML = "";
  document.getElementById('contenedorInsumos')?.classList.add('hidden');
  insumosBaseMedAgregados = false;

  // Montos
  const pv = document.getElementById('precioVenta');
  if (pv) pv.value = "0.00";
  const md = document.getElementById('montoDoctor');
  if (md) md.innerText = "$ 0.00";

  // Vacuna pagada
  const chkVac = document.getElementById('chkVacunaPagada');
  if (chkVac) chkVac.checked = false;
  window.vacunaPagadaAnteriormente = false;
  window.toggleVacunaPagada(false);

  // Color de advertencia en propietario
  const hProp = document.getElementById('hProp');
  if (hProp) { hProp.style.color = ""; hProp.style.fontWeight = ""; }

  // Selector de medicamentos y servicios
  const selServ = document.getElementById('selectorServicios');
  if (selServ) selServ.value = "";
  const selMed = document.getElementById('selectorMedicamentos');
  if (selMed) selMed.value = "";

  // Tratamiento print
  const hTratPrint = document.getElementById('hTratamientoPrint');
  if (hTratPrint) hTratPrint.innerText = "";
}
window._limpiarFormularioHistoria = _limpiarFormularioHistoria;
window._limpiarNotasInternas = _limpiarNotasInternas;

// --- EDITAR CONSULTA DESDE BUSCADOR ----------------------------------------
window.abrirConsultaParaEditar = async (idConsulta) => {
  // Confirmar con el usuario
  const res = await Swal.fire({
    title: '? Editar Consulta',
    html: `<p class="text-[11px] text-slate-600">Se cargara esta consulta en el formulario de Historia Clinica para que puedas editarla y guardar los cambios.<br><br><b>?Continuar?</b></p>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Si, editar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2563eb'
  });
  if (!res.isConfirmed) return;

  try {
    const snap = await getDoc(doc(db, "consultas", idConsulta));
    if (!snap.exists()) { alert("? Consulta no encontrada."); return; }
    const d = snap.data();

    // Guardar ID para actualizar en lugar de crear nuevo
    window._editandoConsultaId = idConsulta;

    // Ir a Historia Clinica y limpiar primero
    window.showTab('historia');
    await new Promise(r => setTimeout(r, 300));
    _limpiarFormularioHistoria();

    // Llenar los campos con los datos existentes
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set('hCI',       d.cedula);
    set('hProp',     d.propietario);
    set('hNombre',   d.paciente);
    set('hEspecie',  d.especie);
    set('hRaza',     d.raza);
    set('hSexo',     d.sexo);
    set('hEdad',     d.edad);
    set('hPeso',     d.peso);
    set('hColor',    d.color);
    set('hTlf',      d.telefono);
    set('hMail',     d.correo || d.email);
    set('hDir',      d.direccion);
    set('hFechaNac', d.fechaNacimiento);
    _calcularEdadDesdeFechaNac(d.fechaNacimiento);
    set('hTratamiento', d.tratamiento);

    // Checkbox alerta
    const chkAlerta = document.getElementById('hAlerta');
    if (chkAlerta) chkAlerta.checked = d.alerta || false;

    // Restaurar fotos existentes (array completo, no solo urlExamen)
    const galeriaH = document.getElementById('previewHistoriaGallery');
    const contH    = document.getElementById('previewHistoriaContainer');
    const fotosARestaurar = d.fotosHistoria && d.fotosHistoria.length > 0
      ? d.fotosHistoria
      : (d.urlExamen ? [d.urlExamen] : []);
    if (galeriaH && fotosARestaurar.length > 0) {
      fotosARestaurar.forEach(urlF => {
        const wrapper = document.createElement('div');
        wrapper.className = "relative w-20 h-20 border-2 border-blue-500 rounded-lg overflow-hidden shadow-sm bg-white";
        wrapper.innerHTML = `<img src="${urlF}" class="w-full h-full object-cover">
          <button type="button" class="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 font-bold"
                  onclick="this.parentElement.remove();window.sincronizarHiddenHistoria()">X</button>`;
        galeriaH.appendChild(wrapper);
      });
      contH?.classList.remove('hidden');
      if (typeof window.sincronizarHiddenHistoria === 'function') window.sincronizarHiddenHistoria();
    }

    // Restaurar servicios realizados con precios históricos
    if (Array.isArray(d.serviciosRealizados) && d.serviciosRealizados.length > 0) {
      for (const serv of d.serviciosRealizados) {
        if (serv.nombre) {
          await window.insertarServicio(serv.nombre);
          // Sobreescribir con el precio guardado históricamente
          if (serv.precio != null && serv.precio > 0) {
            const filas = document.querySelectorAll('.servicio-principal');
            filas.forEach(fila => {
              const nomFila = (fila.querySelector('td')?.innerText || '').replace(/[🔹💊]/g,'').split('(')[0].trim();
              if (normalizarNombre(nomFila) === normalizarNombre(serv.nombre)) {
                fila.setAttribute('data-precio', serv.precio);
              }
            });
          }
        }
      }
      // Restaurar el total guardado (evita que precios actuales distorsionen el historial)
      const inpPrecio = document.getElementById('precioVenta');
      if (inpPrecio && d.montoVenta > 0) inpPrecio.value = d.montoVenta;
    } else if (d.montoVenta > 0) {
      // Si no hay serviciosRealizados pero hay monto, mostrar aviso
      const visual = document.getElementById('visualizacionServicios');
      if (visual) {
        visual.innerHTML = '<p style="font-size:10px;color:#f59e0b;font-weight:700;">Esta consulta fue guardada sin detalle de servicios. Agrega los servicios manualmente.</p>';
      }
    }

    // Mostrar banner de edicion
    _mostrarBannerEdicion(d.paciente, d.fechaSimple);

    await Swal.fire({
      icon: 'info',
      title: '? Modo Edicion',
      html: `<p class="text-[11px]">Datos de <b>${d.paciente}</b> cargados.<br>Modifica lo que necesites y presiona <b>"Guardar Datos"</b>.</p>`,
      timer: 3000,
      showConfirmButton: false
    });

  } catch (e) {
    console.error(e);
    alert("? Error al cargar: " + e.message);
  }
};

function _mostrarBannerEdicion(paciente, fecha) {
  let banner = document.getElementById('bannerModoEdicion');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bannerModoEdicion';
    banner.className = "no-print mb-3 bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex items-center justify-between";
    // Insertar antes del primer campo del formulario
    const section = document.getElementById('sectionHistoria');
    const firstChild = section?.querySelector('.grid');
    if (firstChild) section.insertBefore(banner, firstChild);
  }
  banner.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-xl font-black text-slate-400">!</span>
      <div>
        <p class="text-[10px] font-black text-amber-700 uppercase">Modo Edicion</p>
        <p class="text-[9px] text-amber-600">Editando: <b>${paciente}</b> . ${fecha || ''}</p>
      </div>
    </div>
    <button type="button" onclick="window.cancelarEdicion()"
            class="text-[9px] font-black text-red-500 uppercase border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50">
      ? Cancelar edicion
    </button>`;
  banner.classList.remove('hidden');
}

window.cancelarEdicion = () => {
  window._editandoConsultaId = null;
  document.getElementById('bannerModoEdicion')?.classList.add('hidden');
  _limpiarFormularioHistoria();
};

// guardarFirebase original detecta _editandoConsultaId internamente:
// usa updateDoc si estamos editando, addDoc si es consulta nueva.
const _guardarFirebaseOriginal = window.guardarFirebase;
window.guardarFirebase = async (imp) => _guardarFirebaseOriginal(imp);

// --- FUNCIONES DE AJUSTES (movidas aqui para garantizar carga) ---
window.cargarSelectorServicios = async () => {
  const sel = document.getElementById('selectorServicios');
  if (!sel) return;

  try {
    const snap = await getDocs(collection(db, "servicios_maestro"));
    if (snap.empty) return;

    // Construir mapa de todos los servicios de Firebase: id → data
    const serviciosFirebase = {};
    snap.forEach(d => {
      const data = d.data();
      if (data.activo === false) return;
      serviciosFirebase[d.id.toUpperCase()] = { id: d.id, ...data };
    });

    // 1. Actualizar options que ya existen en el selector HTML (sin moverlos ni duplicarlos)
    Array.from(sel.querySelectorAll('option')).forEach(opt => {
      const key = opt.value.toUpperCase();
      if (serviciosFirebase[key]) {
        // Solo actualizar el textContent sin precio y guardar precio en dataset
        opt.textContent = serviciosFirebase[key].id;
        opt.dataset.precioFirebase = parseFloat(serviciosFirebase[key].precioVenta||0).toFixed(2);
        opt.dataset.porcFirebase   = parseFloat(serviciosFirebase[key].porcDoc||30);
        delete serviciosFirebase[key]; // marcar como ya procesado
      }
    });

    // 2. Los servicios que quedaron (nuevos, no estaban en el HTML) → agregar en su categoría
    const nuevos = Object.values(serviciosFirebase);
    console.log('[AVIPET] Servicios nuevos (no en HTML):', nuevos.map(s=>s.id+'→'+s.categoria));
    if (nuevos.length === 0) return;

    // Agrupar por categoría
    const porCat = {};
    nuevos.forEach(s => {
      const cat = (s.categoria || 'OTROS').toUpperCase();
      if (!porCat[cat]) porCat[cat] = [];
      porCat[cat].push(s);
    });

    Object.entries(porCat).sort().forEach(([cat, servicios]) => {
      // Buscar optgroup existente limpiando emojis del label
      const _limpiar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
      let grp = Array.from(sel.querySelectorAll('optgroup'))
        .find(g => _limpiar(g.label) === _limpiar(cat) || _limpiar(g.label).includes(_limpiar(cat)) || _limpiar(cat).includes(_limpiar(g.label)));

      if (!grp) {
        grp = document.createElement('optgroup');
        grp.label = cat;
        sel.appendChild(grp);
      }

      servicios.sort((a,b) => a.id.localeCompare(b.id)).forEach(s => {
        // Verificar que no exista ya con value exacto
        const yaExiste = Array.from(sel.querySelectorAll('option'))
          .some(o => o.value.toUpperCase() === s.id.toUpperCase());
        if (yaExiste) return;
        const opt = document.createElement('option');
        opt.value                  = s.id;
        opt.textContent            = s.id;
        opt.dataset.firebase       = 'true';
        opt.dataset.precioFirebase = parseFloat(s.precioVenta||0).toFixed(2);
        opt.dataset.porcFirebase   = parseFloat(s.porcDoc||30);
        grp.appendChild(opt);
      });
    });

  } catch(e) {
    console.warn('Error cargando selector servicios:', e);
  }
};

// --- ABRIR MODAL NUEVO SERVICIO ---------------------------
window.abrirModalNuevoServicio = async () => {
  // Recoger categorias existentes del selector HTML + Firebase
  const sel = document.getElementById('selectorServicios');
  const catsExistentes = new Set();
  if (sel) {
    Array.from(sel.querySelectorAll('optgroup')).forEach(g => {
      // Limpiar el label: quitar caracteres especiales/emojis y espacios extra
      const limpio = g.label.replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').trim().toUpperCase();
      if (limpio) catsExistentes.add(limpio);
    });
  }
  // Tambien traer categorias de Firebase
  try {
    const snapF = await getDocs(collection(db, "servicios_maestro"));
    snapF.forEach(d => {
      const cat = (d.data().categoria||'').toUpperCase().trim();
      if (cat) catsExistentes.add(cat);
    });
  } catch(e) {}

  const catsOrdenadas = Array.from(catsExistentes).sort();

  var htmlModal = '<div class="space-y-3 text-left">';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Nombre del Servicio</label>';
  htmlModal += '<input id="ns_nombre" type="text" placeholder="Ej: RADIOGRAFIA SIMPLE" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-blue-500"></div>';
  htmlModal += '<div class="grid grid-cols-2 gap-2">';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Precio ($)</label>';
  htmlModal += '<input id="ns_precio" type="number" placeholder="0.00" step="0.50" min="0" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">% Doctor</label>';
  htmlModal += '<input id="ns_porc" type="number" placeholder="40" step="0.5" min="0" max="100" value="40" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Categoria</label>';
  htmlModal += '<select id="ns_categoria" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500 bg-white">';
  catsOrdenadas.forEach(cat => {
    htmlModal += '<option value="' + cat + '">' + cat + '</option>';
  });
  htmlModal += '<option value="__nueva__">+ Crear nueva categoria...</option>';
  htmlModal += '</select>';
  htmlModal += '<input id="ns_categoria_nueva" type="text" placeholder="Ej: CIRUGIAS, HOSPITALIZACION..." style="display:none" class="w-full border-2 border-blue-300 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-blue-500 mt-2"></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Es una vacuna?</label>';
  htmlModal += '<div class="flex gap-3">';
  htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_si" value="si" class="accent-blue-600"> <span class="text-[10px] font-bold">Si</span></label>';
  htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_no" value="no" checked class="accent-blue-600"> <span class="text-[10px] font-bold">No</span></label>';
  htmlModal += '</div></div>';
  htmlModal += '<div class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[9px] text-blue-700 font-bold">El % Doctor se aplica sobre (Precio - Insumos), no sobre el precio bruto.</div>';
  htmlModal += '</div>';

  const res = await Swal.fire({
    title: 'Nuevo Servicio',
    html: htmlModal,
    showCancelButton: true,
    confirmButtonText: 'Crear Servicio',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2563eb',
    didOpen: () => {
      const catSel = document.getElementById('ns_categoria');
      if (catSel) {
        catSel.addEventListener('change', function() {
          const inp = document.getElementById('ns_categoria_nueva');
          if (inp) inp.style.display = this.value === '__nueva__' ? 'block' : 'none';
        });
      }
    },
    preConfirm: () => {
      const nombre    = document.getElementById('ns_nombre')?.value.trim().toUpperCase();
      const precio    = parseFloat(document.getElementById('ns_precio')?.value) || 0;
      const porc      = parseFloat(document.getElementById('ns_porc')?.value)   || 40;
      const catSel    = document.getElementById('ns_categoria')?.value || 'OTROS';
      const catNueva  = document.getElementById('ns_categoria_nueva')?.value.trim().toUpperCase();
      const categoria = catSel === '__nueva__' ? catNueva : catSel;
      const esVacuna  = document.getElementById('ns_vacuna_si')?.checked || false;
      if (catSel === '__nueva__' && !catNueva) { Swal.showValidationMessage('Escribe el nombre de la nueva categoria'); return false; }
      if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
      if (precio <= 0) { Swal.showValidationMessage('El precio debe ser mayor a 0'); return false; }
      return { nombre, precio, porc, categoria, esVacuna };
    }
  });

  if (!res.isConfirmed) return;
  const { nombre, precio, porc, categoria, esVacuna } = res.value;

  try {
    const existe = await getDoc(doc(db, "servicios_maestro", nombre));
    if (existe.exists()) {
      Swal.fire({ icon:'warning', title:'Ya existe', text:'Un servicio con ese nombre ya esta registrado.', timer:2500, showConfirmButton:false });
      return;
    }

    await setDoc(doc(db, "servicios_maestro", nombre), {
      precioVenta: precio,
      porcDoc:     porc,
      categoria,
      esVacuna,
      creadoEn:    serverTimestamp(),
      activo:      true
    });

    await window.renderizarTablaMaestra();
    await window.cargarSelectorServicios();

    await Swal.fire({
      icon: 'success',
      title: 'Servicio creado',
      html: '<b>' + nombre + '</b><br>$' + precio.toFixed(2) + ' &middot; ' + porc + '% doctor &middot; ' + categoria,
      timer: 2500,
      showConfirmButton: false
    });

  } catch(e) { console.error(e); alert('Error: '+e.message); }
};

// --- ELIMINAR SERVICIO ------------------------------------
window.eliminarServicioMaestro = async (nombreServicio) => {
  const res = await Swal.fire({
    title: '? Eliminar Servicio',
    html: `<p class="text-[11px] text-slate-600">Eliminar <b>${nombreServicio}</b> del listado?<br><br>Ya no aparecera en el selector de Historia Clinica.</p>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Si, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626'
  });
  if (!res.isConfirmed) return;

  try {
    await deleteDoc(doc(db, "servicios_maestro", nombreServicio));
    await window.renderizarTablaMaestra();
    await window.cargarSelectorServicios();
    Swal.fire({ icon:'success', title:'? Eliminado', timer:1500, showConfirmButton:false });
  } catch(e) { console.error(e); alert('? Error: '+e.message); }
};

// --- EDITAR INSUMOS DE UN SERVICIO -----------------------
window.editarInsumosServicio = async (nombreServicio) => {
  try {
    const snap = await getDoc(doc(db, "servicios_maestro", nombreServicio));
    if (!snap.exists()) { alert("Servicio no encontrado."); return; }
    const data = snap.data();
    const normNombre = normalizarNombre(nombreServicio);
    const recetaBase = Object.entries(recetas).find(([k]) => normalizarNombre(k) === normNombre);

    // Array reactivo en memoria
    let lista = (data.insumos || (recetaBase ? recetaBase[1].insumos : [])).map(ins => ({
      nombre:   ins.nombre,
      costo:    parseFloat(ins.costo || 0),
      bloqueado: ins.bloqueado === true
    }));

    // Cargar insumos_maestro para el selector
    const snapIns = await getDocs(collection(db, "insumos_maestro"));
    const insumosMaestro = [];
    snapIns.forEach(d => {
      const r = d.data();
      const nombre = (r.nombre || d.id || '').trim();
      if (nombre) insumosMaestro.push({ nombre, costo: parseFloat(r.costo||0) });
    });
    insumosMaestro.sort((a,b) => a.nombre.localeCompare(b.nombre));
    let optsInsumos = '<option value="">-- Seleccionar del catálogo --</option>';
    insumosMaestro.forEach(i => {
      optsInsumos += '<option value="'+i.nombre+'" data-costo="'+i.costo+'">'+i.nombre+' ($'+i.costo.toFixed(2)+')</option>';
    });

    // ── Función render: reconstruye la lista visual desde `lista` ──
    const renderLista = () => {
      const cont = document.getElementById('listaInsumosModal');
      if (!cont) return;
      cont.innerHTML = '';
      if (lista.length === 0) {
        cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:12px;font-weight:700;">Sin insumos. Agrega uno abajo.</p>';
        return;
      }
      lista.forEach((ins, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:auto 1fr 80px auto auto;align-items:center;gap:6px;padding:7px 8px;margin-bottom:4px;border-radius:8px;border:1px solid '+(ins.bloqueado?'#fde68a':'#f1f5f9')+';background:'+(ins.bloqueado?'#fffbeb':'#fff')+';';

        // Candado
        const btnLock = document.createElement('button');
        btnLock.type = 'button';
        btnLock.innerHTML = ins.bloqueado ? '&#128274;' : '&#128275;';
        btnLock.title = ins.bloqueado ? 'Desbloquear' : 'Bloquear';
        btnLock.style.cssText = 'background:'+(ins.bloqueado?'#f59e0b':'#e2e8f0')+';border:none;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:13px;';
        btnLock.addEventListener('click', function() {
          lista[idx].bloqueado = !lista[idx].bloqueado;
          renderLista();
        });

        // Nombre
        const nomSpan = document.createElement('span');
        nomSpan.style.cssText = 'font-size:11px;font-weight:'+(ins.bloqueado?'900':'700')+';color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nomSpan.textContent = ins.nombre;

        // Costo
        const inpCosto = document.createElement('input');
        inpCosto.type = 'number'; inpCosto.step = '0.01'; inpCosto.min = '0';
        inpCosto.value = ins.costo.toFixed(2);
        inpCosto.style.cssText = 'border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;font-size:11px;font-weight:700;text-align:center;width:100%;';
        inpCosto.addEventListener('input', function() { lista[idx].costo = parseFloat(this.value)||0; });

        // Etiqueta bloqueado
        const tagBloq = document.createElement('span');
        tagBloq.style.cssText = 'font-size:8px;font-weight:900;color:'+(ins.bloqueado?'#f59e0b':'#94a3b8')+';text-align:center;';
        tagBloq.textContent = ins.bloqueado ? 'OBLIG.' : 'LIBRE';

        // Btn ELIMINAR — usa índice capturado en closure
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.textContent = '✕';
        btnDel.title = 'Eliminar insumo';
        btnDel.style.cssText = 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:3px 8px;font-size:13px;font-weight:900;cursor:pointer;';
        btnDel.addEventListener('click', (function(i) {
          return function() {
            lista.splice(i, 1);
            renderLista();
          };
        })(idx));

        row.appendChild(btnLock);
        row.appendChild(nomSpan);
        row.appendChild(inpCosto);
        row.appendChild(tagBloq);
        row.appendChild(btnDel);
        cont.appendChild(row);
      });
    };

    const htmlModal =
      '<div style="text-align:left;">' +
      '<p style="font-size:9px;color:#64748b;margin:0 0 8px 0;">&#128274; = doctor NO puede eliminar en Historia Clínica. ✕ = quitar del servicio.</p>' +
      '<div id="listaInsumosModal" style="max-height:260px;overflow-y:auto;margin-bottom:10px;"></div>' +
      '<div style="border-top:2px solid #e2e8f0;padding-top:10px;display:flex;flex-direction:column;gap:8px;">' +
      '<p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0;">Agregar insumo del catálogo:</p>' +
      '<div style="display:flex;gap:6px;align-items:center;">' +
      '<select id="selInsumoAgregar" style="flex:1;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:11px;font-weight:700;background:white;outline:none;">' + optsInsumos + '</select>' +
      '<button id="btnAgregarInsumo" type="button" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:7px 14px;font-weight:900;font-size:11px;cursor:pointer;white-space:nowrap;">+ Agregar</button>' +
      '</div>' +
      '<p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0;">O escribe un insumo nuevo:</p>' +
      '<div style="display:flex;gap:6px;">' +
      '<input id="inpNombreNuevo" type="text" placeholder="Nombre del insumo..." style="flex:1;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:11px;font-weight:700;outline:none;">' +
      '<input id="inpCostoNuevo" type="number" placeholder="$0.00" step="0.01" min="0" style="width:80px;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:11px;font-weight:700;outline:none;">' +
      '<button id="btnAgregarManual" type="button" style="background:#10b981;color:white;border:none;border-radius:8px;padding:7px 14px;font-weight:900;font-size:11px;cursor:pointer;white-space:nowrap;">+ Agregar</button>' +
      '</div>' +
      '</div></div>';

    const res = await Swal.fire({
      title: 'Insumos: ' + nombreServicio,
      html: htmlModal,
      width: 560,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      didOpen: function() {
        renderLista();

        // Agregar desde catálogo
        document.getElementById('btnAgregarInsumo').addEventListener('click', function() {
          const sel = document.getElementById('selInsumoAgregar');
          const opt = sel?.options[sel.selectedIndex];
          if (!opt || !opt.value) return;
          const yaEsta = lista.some(i => i.nombre.toUpperCase() === opt.value.toUpperCase());
          if (yaEsta) { alert('Este insumo ya está en la lista.'); return; }
          lista.push({ nombre: opt.value, costo: parseFloat(opt.dataset.costo)||0, bloqueado: false });
          sel.value = '';
          renderLista();
        });

        // Agregar manual
        document.getElementById('btnAgregarManual').addEventListener('click', function() {
          const nombre = document.getElementById('inpNombreNuevo')?.value.trim().toUpperCase();
          const costo  = parseFloat(document.getElementById('inpCostoNuevo')?.value) || 0;
          if (!nombre) { alert('Escribe el nombre del insumo'); return; }
          const yaEsta = lista.some(i => i.nombre.toUpperCase() === nombre);
          if (yaEsta) { alert('Este insumo ya está en la lista.'); return; }
          lista.push({ nombre, costo, bloqueado: false });
          document.getElementById('inpNombreNuevo').value = '';
          document.getElementById('inpCostoNuevo').value  = '';
          renderLista();
        });
      }
    });

    if (!res.isConfirmed) return;

    await setDoc(doc(db, "servicios_maestro", nombreServicio), { insumos: lista }, { merge: true });
    await Swal.fire({
      icon:'success', title:'Insumos guardados',
      html:'<b>'+nombreServicio+'</b><br>'+lista.length+' insumo(s) guardados.',
      timer:2000, showConfirmButton:false
    });

  } catch(e) { console.error(e); alert('Error: ' + e.message); }
};

// --- CARGAR SELECTOR MEDICAMENTOS DESDE FIREBASE ----------
window.cargarSelectorMedicamentos = async () => {
  const sel = document.getElementById('selectorMedicamentos');
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, "medicamentos_maestro"));
    if (snap.empty) return;
    const yaExisten = new Set(
      Array.from(sel.querySelectorAll('option')).map(o => o.value.toUpperCase())
    );
    snap.forEach(d => {
      const r = d.data();
      const nombre = (r.nombre || d.id).toUpperCase();
      if (!yaExisten.has(nombre)) {
        const opt = document.createElement('option');
        opt.value = nombre;
        opt.textContent = nombre + ' ($' + parseFloat(r.precioCliente||0).toFixed(2) + ')';
        const optOtro = sel.querySelector('option[value="OTRO"]');
        if (optOtro) sel.insertBefore(opt, optOtro);
        else sel.appendChild(opt);
      }
    });
  } catch(e) { console.warn('Error cargando medicamentos:', e); }
};

// --- FILTRAR TABLA DE SERVICIOS ---------------------------
window.filtrarTablaServicios = () => {
  const filtro = document.getElementById('filtroServiciosMaestro')?.value.toUpperCase().trim() || '';
  document.querySelectorAll('#tablaServiciosMaestro [data-card-id]').forEach(card => {
    const nombre = (card.dataset.nombre || card.dataset.cardId || '').toUpperCase();
    card.style.display = (!filtro || nombre.includes(filtro)) ? '' : 'none';
  });
  // Ocultar categorías vacías
  document.querySelectorAll('#tablaServiciosMaestro > div').forEach(grpDiv => {
    const cards = grpDiv.querySelectorAll('[data-card-id]');
    if (cards.length === 0) return;
    const alguno = Array.from(cards).some(c => c.style.display !== 'none');
    grpDiv.style.display = alguno ? '' : 'none';
  });
};

// Búsqueda de insumos
window.filtrarTablaInsumos = () => {
  const filtro = document.getElementById('filtroInsumosMaestro')?.value.toUpperCase().trim() || '';
  document.querySelectorAll('#tablaInsumosMaestro [data-card-insumo]').forEach(card => {
    const nombre = (card.dataset.cardInsumo || '').toUpperCase();
    card.style.display = (!filtro || nombre.includes(filtro)) ? '' : 'none';
  });
};

// Búsqueda de medicamentos
window.filtrarTablaMedicamentos = () => {
  const filtro = document.getElementById('filtroMedicamentosMaestro')?.value.toUpperCase().trim() || '';
  document.querySelectorAll('#tablaMedicamentosMaestro [data-card-med]').forEach(card => {
    const nombre = (card.dataset.cardMed || '').toUpperCase();
    card.style.display = (!filtro || nombre.includes(filtro)) ? '' : 'none';
  });
};

window.renderizarTablaMaestra = async () => {
  const cont = document.getElementById('tablaServiciosMaestro');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center text-[9px] animate-pulse text-blue-500 font-black uppercase italic py-4">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db, "servicios_maestro"));
    if (snap.empty) { cont.innerHTML = '<p class="text-center text-slate-400 text-[9px] italic py-4">Sin servicios.</p>'; return; }
    const servicios = [];
    snap.forEach(d => servicios.push({ id: d.id, ...d.data() }));
    servicios.sort((a,b) => (a.categoria||'').localeCompare(b.categoria||'') || a.id.localeCompare(b.id));
    cont.innerHTML = '';
    // Agrupar por categoria
    const grupos = {};
    servicios.forEach(r => { const c = r.categoria||'OTROS'; if(!grupos[c]) grupos[c]=[]; grupos[c].push(r); });
    Object.entries(grupos).forEach(([cat, items]) => {
      const catDiv = document.createElement('div');
      catDiv.style.cssText = 'margin-bottom:12px;';
      catDiv.innerHTML = '<p style="font-size:9px;font-weight:900;color:#fff;background:#1e293b;padding:4px 8px;border-radius:6px;text-transform:uppercase;margin-bottom:4px;">'+cat+'</p>';
      items.forEach(r => {
        const card = document.createElement('div');
        card.dataset.cardId = r.id;
        card.dataset.nombre = r.id.toUpperCase();
        card.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:6px;';
        // Fila 1: nombre + categoria actual
        const f1 = document.createElement('div');
        f1.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
        f1.innerHTML = '<p style="font-size:11px;font-weight:900;color:#1e293b;text-transform:uppercase;flex:1;">'+r.id+'</p>';
        card.appendChild(f1);
        // Fila 2: precio + % doc editables
        const f2 = document.createElement('div');
        f2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
        f2.innerHTML =
          '<div><label style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;display:block;">Precio $</label>'+
          '<input type="number" step="0.50" min="0" value="'+(r.precioVenta||0)+'" data-campo="precioVenta" data-id="'+r.id+'" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:5px 8px;font-size:12px;font-weight:900;outline:none;box-sizing:border-box;"></div>'+
          '<div><label style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;display:block;">% Doctor</label>'+
          '<input type="number" step="0.5" min="0" max="100" value="'+(r.porcDoc||r.porcentajeDoc||30)+'" data-campo="porcDoc" data-id="'+r.id+'" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:5px 8px;font-size:12px;font-weight:900;outline:none;box-sizing:border.box;"></div>';
        card.appendChild(f2);
        // Fila 3: botones
        const f3 = document.createElement('div');
        f3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;';
        const f3b = document.createElement('div');
        f3b.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;';
        // Btn Guardar
        const btnG = document.createElement('button');
        btnG.textContent = 'Guardar precio'; btnG.dataset.id = r.id;
        btnG.style.cssText = 'padding:8px 6px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        btnG.addEventListener('click', async function() {
          const cardEl = document.querySelector('#tablaServiciosMaestro [data-card-id="'+this.dataset.id+'"]');
          const inpP = cardEl?.querySelector('input[data-campo="precioVenta"]');
          const inpPc = cardEl?.querySelector('input[data-campo="porcDoc"]');
          this.textContent = '...'; this.disabled = true; this.style.background = '#94a3b8';
          const btn = this;
          try {
            const nuevoP = parseFloat(inpP?.value)||0;
            const nuevoPc = parseFloat(inpPc?.value)||30;
            await setDoc(doc(db,"servicios_maestro",this.dataset.id),{ precioVenta:nuevoP, porcDoc:nuevoPc, actualizadoEn:serverTimestamp() },{merge:true});
            // Actualizar el selector de historia clinica inmediatamente
            if (typeof window.cargarSelectorServicios === 'function') await window.cargarSelectorServicios();
            // porcGlobal eliminado — cada servicio usa su porcDoc individual
            btn.textContent = 'OK'; btn.style.background = '#16a34a';
            inpP.style.borderColor = '#16a34a'; inpPc.style.borderColor = '#16a34a';
            setTimeout(()=>{ btn.textContent='Guardar'; btn.disabled=false; btn.style.background='#2563eb'; inpP.style.borderColor=''; inpPc.style.borderColor=''; }, 2000);
          } catch(e) { btn.textContent='Error'; btn.style.background='#dc2626'; btn.disabled=false; setTimeout(()=>{ btn.textContent='Guardar'; btn.style.background='#2563eb'; },2500); }
        });
        f3.appendChild(btnG);
        // Btn Editar nombre/categoria
        const btnE = document.createElement('button');
        btnE.textContent = 'Editar nombre'; btnE.dataset.id = r.id; btnE.dataset.cat = r.categoria||'OTROS';
        btnE.style.cssText = 'padding:8px 6px;border-radius:8px;border:none;background:#f59e0b;color:#fff;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        btnE.addEventListener('click', async function() {
          const idActual = this.dataset.id;
          const catActual = this.dataset.cat;
          const snapCats = await getDocs(collection(db,"servicios_maestro"));
          const catsSet = new Set(['CONSULTAS','VACUNAS','LABORATORIO','TESTS RAPIDOS','REFERIDOS','OTROS PROCEDIMIENTOS','OTROS']);
          snapCats.forEach(d => { const c=(d.data().categoria||'').trim().toUpperCase(); if(c) catsSet.add(c); });
          let optsHtml = Array.from(catsSet).sort().map(c => '<option value="'+c+'"'+(c===catActual.toUpperCase()?' selected':'')+'>'+c+'</option>').join('');
          optsHtml += '<option value="__nueva__">+ Nueva categoria...</option>';
          // Leer precio y % actuales del card
          const cardEl2 = document.querySelector('#tablaServiciosMaestro [data-card-id="'+idActual+'"]');
          const precioActual = parseFloat(cardEl2?.querySelector('input[data-campo="precioVenta"]')?.value||0);
          const porcActual   = parseFloat(cardEl2?.querySelector('input[data-campo="porcDoc"]')?.value||30);

          const res = await Swal.fire({
            title: 'Editar: '+idActual, width:440,
            html: '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Nombre</label>'+
              '<input id="esn" type="text" value="'+idActual+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:900;text-transform:uppercase;outline:none;box-sizing:border-box;"></div>'+
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Precio ($)</label>'+
              '<input id="esp" type="number" step="0.50" min="0" value="'+precioActual+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:13px;font-weight:900;outline:none;box-sizing:border-box;"></div>'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">% Doctor</label>'+
              '<input id="espc" type="number" step="0.5" min="0" max="100" value="'+porcActual+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:13px;font-weight:900;outline:none;box-sizing:border-box;"></div></div>'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Categoria</label>'+
              '<select id="esc" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;background:#fff;box-sizing:border-box;">'+optsHtml+'</select>'+
              '<input id="escn" type="text" placeholder="Nueva categoria..." style="display:none;width:100%;border:2px solid #3b82f6;border-radius:10px;padding:8px;font-size:12px;font-weight:700;text-transform:uppercase;outline:none;box-sizing:border-box;margin-top:6px;"></div></div>',
            showCancelButton:true, confirmButtonText:'Guardar todo', confirmButtonColor:'#f59e0b',
            didOpen:()=>{ document.getElementById('esc').addEventListener('change',function(){ document.getElementById('escn').style.display=this.value==='__nueva__'?'block':'none'; }); },
            preConfirm:()=>{
              const n=document.getElementById('esn').value.trim().toUpperCase();
              const p=parseFloat(document.getElementById('esp').value)||0;
              const pc=parseFloat(document.getElementById('espc').value)||30;
              const cs=document.getElementById('esc').value;
              const cn=document.getElementById('escn').value.trim().toUpperCase();
              const c=cs==='__nueva__'?cn:cs;
              if(!n){Swal.showValidationMessage('Nombre requerido');return false;}
              if(p<=0){Swal.showValidationMessage('El precio debe ser mayor a 0');return false;}
              if(cs==='__nueva__'&&!cn){Swal.showValidationMessage('Escribe la categoria');return false;}
              return {n,p,pc,c};
            }
          });
          if(!res.isConfirmed) return;
          const {n:nuevoNom, p:nuevoPrecio, pc:nuevoPorcDoc, c:nuevaCat} = res.value;
          try {
            const snapOld = await getDoc(doc(db,"servicios_maestro",idActual));
            const dataOld = snapOld.exists()?snapOld.data():{};
            const dataNueva = {...dataOld, precioVenta:nuevoPrecio, porcDoc:nuevoPorcDoc, categoria:nuevaCat, actualizadoEn:serverTimestamp()};
            if(nuevoNom !== idActual) {
              await setDoc(doc(db,"servicios_maestro",nuevoNom), dataNueva);
              await deleteDoc(doc(db,"servicios_maestro",idActual));
            } else {
              await setDoc(doc(db,"servicios_maestro",idActual), dataNueva, {merge:true});
            }
            console.log('[AVIPET] Servicio actualizado:', nuevoNom, '→ $'+nuevoPrecio+' / '+nuevoPorcDoc+'%');
            await Swal.fire({icon:'success',title:'Guardado',html:'<b>'+nuevoNom+'</b><br>$'+nuevoPrecio.toFixed(2)+' · '+nuevoPorcDoc+'% doc · '+nuevaCat,timer:2000,showConfirmButton:false});
            window.renderizarTablaMaestra(); window.cargarSelectorServicios();
          } catch(e){ Swal.fire({icon:'error',title:'Error',text:e.message}); }
        });
        f3.appendChild(btnE);
        // Btn Insumos
        const btnI = document.createElement('button');
        btnI.textContent = 'Editar Insumos'; btnI.dataset.id = r.id;
        btnI.style.cssText = 'padding:8px 6px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        btnI.addEventListener('click', function(){ window.editarInsumosServicio(this.dataset.id); });
        f3b.appendChild(btnI);
        // Btn Pregunta Extra (ej: cuanto Propofol se usó en eutanasia)
        const btnQ = document.createElement('button');
        const tienePregunta = r.preguntaActiva === true;
        btnQ.textContent = tienePregunta ? '❓ Pregunta: ON' : '❓ Pregunta extra';
        btnQ.dataset.id = r.id;
        btnQ.style.cssText = 'padding:8px 6px;border-radius:8px;border:none;background:'+(tienePregunta?'#7c3aed':'#a78bfa')+';color:#fff;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        btnQ.addEventListener('click', async function(){
          const idServ = this.dataset.id;
          const snapR = await getDoc(doc(db,'servicios_maestro',idServ));
          const rd = snapR.exists()?snapR.data():{};
          const insumosServ = rd.insumos || [];
          const optsIns = insumosServ.map(i => '<option value="'+(i.nombre||'')+'"'+((rd.preguntaInsumo||'')===i.nombre?' selected':'')+'>'+i.nombre+'</option>').join('');
          const res = await Swal.fire({
            title: 'Pregunta extra: '+idServ, width:440,
            html: '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">'+
              '<label style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;color:#1e293b;"><input type="checkbox" id="pq_activa" '+(rd.preguntaActiva?'checked':'')+' style="width:16px;height:16px;accent-color:#7c3aed;"> Activar ventana emergente al guardar</label>'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Texto de la pregunta</label>'+
              '<input id="pq_texto" type="text" value="'+(rd.preguntaTexto||'¿Cuánto se utilizó?')+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;"></div>'+
              '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Insumo afectado</label>'+
              '<select id="pq_insumo" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;background:#fff;box-sizing:border-box;">'+
              (optsIns||'<option value="">-- Este servicio no tiene insumos --</option>')+'</select></div>'+
              '<p style="font-size:9px;color:#64748b;font-weight:700;">El doctor podrá responder en la unidad que use realmente (ej: potes/frascos completos, o cc/ml sueltos). Define el costo de cada una:</p>'+
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f5f3ff;border-radius:10px;padding:8px;">'+
              '<div><label style="font-size:9px;font-weight:900;color:#7c3aed;text-transform:uppercase;display:block;margin-bottom:4px;">Costo por pote/frasco ($)</label>'+
              '<input id="pq_costo_pote" type="number" step="0.01" min="0" value="'+(rd.preguntaCostoPote||0)+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:900;outline:none;box-sizing:border-box;"></div>'+
              '<div><label style="font-size:9px;font-weight:900;color:#7c3aed;text-transform:uppercase;display:block;margin-bottom:4px;">Costo por cc/ml ($)</label>'+
              '<input id="pq_costo_cc" type="number" step="0.01" min="0" value="'+(rd.preguntaCostoCC||rd.preguntaCostoUnidad||0)+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:900;outline:none;box-sizing:border-box;"></div></div>'+
              '<p style="font-size:9px;color:#7c3aed;background:#f5f3ff;border-radius:8px;padding:8px;">Al guardar este servicio en Historia Clínica, se abrirá esta pregunta con un selector "Potes / CC". Sea cual sea la unidad y cantidad que indique el doctor, el costo se calcula y se suma automáticamente al total de insumos — afectando el pago del doctor y el ingreso de Avipet.</p>'+
              '</div>',
            showCancelButton:true, confirmButtonText:'Guardar', confirmButtonColor:'#7c3aed',
            preConfirm: () => ({
              activa: document.getElementById('pq_activa').checked,
              texto: document.getElementById('pq_texto').value.trim() || '¿Cuánto se utilizó?',
              insumo: document.getElementById('pq_insumo').value || '',
              costoPote: parseFloat(document.getElementById('pq_costo_pote').value) || 0,
              costoCC: parseFloat(document.getElementById('pq_costo_cc').value) || 0
            })
          });
          if (!res.isConfirmed) return;
          try {
            await setDoc(doc(db,'servicios_maestro',idServ), {
              preguntaActiva: res.value.activa,
              preguntaTexto: res.value.texto,
              preguntaInsumo: res.value.insumo,
              preguntaCostoPote: res.value.costoPote,
              preguntaCostoCC: res.value.costoCC,
              actualizadoEn: serverTimestamp()
            }, {merge:true});
            await Swal.fire({icon:'success',title:'Guardado',timer:1200,showConfirmButton:false});
            window.renderizarTablaMaestra();
          } catch(e){ Swal.fire({icon:'error',title:'Error',text:e.message}); }
        });
        f3b.appendChild(btnQ);
        // Btn Eliminar
        const btnD = document.createElement('button');
        btnD.textContent = 'Eliminar servicio'; btnD.dataset.id = r.id;
        btnD.style.cssText = 'padding:8px 6px;border-radius:8px;border:none;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        btnD.addEventListener('click', function(){ window.eliminarServicioMaestro(this.dataset.id); });
        f3b.appendChild(btnD);
        card.appendChild(f3);
        card.appendChild(f3b);
        catDiv.appendChild(card);
      });
      cont.appendChild(catDiv);
    });
  } catch(e) { cont.innerHTML = '<p class="text-red-500 text-[9px] text-center italic py-4">Error: '+e.message+'</p>'; }
};

window.renderizarTablaInsumos = async () => {
  const cont = document.getElementById('tablaInsumosMaestro');
  if (!cont) return;
  cont.innerHTML = '<p class="text-center text-[9px] animate-pulse text-blue-500 font-black uppercase italic py-4">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db, "insumos_maestro"));
    if (snap.empty) { cont.innerHTML = '<p class="text-center text-slate-400 text-[9px] italic py-4">Sin insumos.</p>'; return; }
    const lista = []; snap.forEach(d => lista.push({id:d.id,...d.data()}));
    lista.sort((a,b) => (a.nombre||a.id).localeCompare(b.nombre||b.id));
    cont.innerHTML = '';
    lista.forEach(r => {
      const nombreMostrar = r.nombre || r.id;
      const bloqueado = r.bloqueado === true;
      const card = document.createElement('div');
      card.style.cssText = 'background:'+(bloqueado?'#fffbeb':'#f8fafc')+';border:2px solid '+(bloqueado?'#fde68a':'#e2e8f0')+';border-radius:10px;padding:8px 10px;margin-bottom:6px;';
      card.dataset.cardInsumo = nombreMostrar.toUpperCase();
      // Fila 1: nombre + icono candado
      const f1 = document.createElement('div');
      f1.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
      f1.innerHTML = '<p style="font-size:11px;font-weight:900;color:#1e293b;">'+(bloqueado?'&#128274; ':'')+nombreMostrar+'</p>';
      card.appendChild(f1);
      // Input costo
      const f2 = document.createElement('div');
      f2.style.cssText = 'margin-bottom:6px;';
      f2.innerHTML = '<label style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;display:block;margin-bottom:3px;">Costo ($)</label>';
      const inp = document.createElement('input');
      inp.type='number'; inp.step='0.01'; inp.min='0';
      inp.value=parseFloat(r.costo||0).toFixed(2);
      inp.dataset.id=r.id;
      inp.style.cssText='width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:6px 8px;font-size:13px;font-weight:900;outline:none;box-sizing:border-box;';
      inp.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();_guardarCostoInsumoFila(inp,null);} });
      f2.appendChild(inp); card.appendChild(f2);
      // Botones
      const f3 = document.createElement('div');
      f3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;';
      const mkBtn = (txt,bg,cb) => {
        const b=document.createElement('button');
        b.textContent=txt;
        b.style.cssText='padding:7px 4px;border-radius:8px;border:none;background:'+bg+';color:#fff;font-size:9px;font-weight:900;cursor:pointer;text-transform:uppercase;';
        b.addEventListener('click',cb); return b;
      };
      // Guardar
      const btnG = mkBtn('Guardar','#10b981', function(){
        const btn=this; btn.textContent='...'; btn.disabled=true; btn.style.background='#94a3b8';
        _guardarCostoInsumoFila(inp, btn);
      });
      f3.appendChild(btnG);
      // Editar insumo — modal completo
      f3.appendChild(mkBtn('Editar','#f59e0b', async function(){
        const idActual    = r.id;
        const nomActual   = nombreMostrar;
        const costoActual = parseFloat(r.costo||0);
        const bloqActual  = r.bloqueado === true;

        // Cargar todos los servicios y clasificar cuáles ya tienen este insumo
        let serviciosConInsumo   = []; // ya lo tiene
        let serviciosSinInsumo   = []; // no lo tiene (para agregar)
        try {
          const snapS = await getDocs(collection(db,'servicios_maestro'));
          snapS.forEach(sd => {
            const ins = sd.data().insumos || [];
            const yaEsta = ins.some(i => (i.nombre||'').toUpperCase() === nomActual.toUpperCase() ||
                                         (i.nombre||'').toUpperCase() === idActual.toUpperCase());
            if (yaEsta) serviciosConInsumo.push(sd.id);
            else        serviciosSinInsumo.push(sd.id);
          });
          serviciosConInsumo.sort();
          serviciosSinInsumo.sort();
        } catch(e){}

        // HTML de servicios donde ya está (badges)
        let htmlServiciosActuales = '';
        if (serviciosConInsumo.length === 0) {
          htmlServiciosActuales = '<p style="font-size:10px;color:#94a3b8;font-style:italic;margin:0;">No está en ningún servicio aún.</p>';
        } else {
          htmlServiciosActuales = serviciosConInsumo.map(s =>
            '<span style="display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:3px 8px;font-size:9px;font-weight:900;margin:2px;">'+s+'</span>'
          ).join('');
        }

        // HTML selector de servicios adicionales (los que NO lo tienen)
        let optsAgregar = '<option value="">-- Seleccionar servicio --</option>';
        serviciosSinInsumo.forEach(s => { optsAgregar += '<option value="'+s+'">'+s+'</option>'; });

        // HTML selector de servicios para QUITAR (los que SÍ lo tienen)
        let optsQuitar = '<option value="">-- Seleccionar servicio --</option>';
        serviciosConInsumo.forEach(s => { optsQuitar += '<option value="'+s+'">'+s+'</option>'; });

        const htmlModal =
          '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;">' +

          // Nombre
          '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Nombre del insumo</label>' +
          '<input id="ei_nombre" type="text" value="'+nomActual+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:13px;font-weight:900;text-transform:uppercase;outline:none;box-sizing:border-box;"></div>' +

          // Costo + Bloqueado
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Costo ($)</label>' +
          '<input id="ei_costo" type="number" step="0.01" min="0" value="'+costoActual.toFixed(2)+'" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:14px;font-weight:900;outline:none;box-sizing:border-box;"></div>' +
          '<div style="display:flex;flex-direction:column;justify-content:flex-end;">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:#fffbeb;border:2px solid #fde68a;border-radius:10px;padding:8px;">' +
          '<input type="checkbox" id="ei_bloqueado" '+(bloqActual?'checked':'')+' style="width:16px;height:16px;accent-color:#f59e0b;cursor:pointer;">' +
          '<span style="font-size:10px;font-weight:900;color:#92400e;">&#128274; Bloqueado</span></label></div>' +
          '</div>' +

          // Servicios donde ya está
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;">' +
          '<p style="font-size:9px;font-weight:900;color:#16a34a;text-transform:uppercase;margin:0 0 6px 0;">Servicios donde ya está ('+serviciosConInsumo.length+')</p>' +
          htmlServiciosActuales +
          '</div>' +

          // Agregar a servicio adicional
          (serviciosSinInsumo.length > 0 ?
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;">' +
          '<label style="font-size:9px;font-weight:900;color:#2563eb;text-transform:uppercase;display:block;margin-bottom:6px;">+ Agregar a otro servicio</label>' +
          '<select id="ei_agregar" style="width:100%;border:2px solid #bfdbfe;border-radius:8px;padding:8px;font-size:11px;font-weight:700;outline:none;background:#fff;box-sizing:border-box;">'+optsAgregar+'</select>' +
          '</div>' : '') +

          // Quitar de un servicio
          (serviciosConInsumo.length > 0 ?
          '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:10px;">' +
          '<label style="font-size:9px;font-weight:900;color:#dc2626;text-transform:uppercase;display:block;margin-bottom:6px;">— Quitar de un servicio</label>' +
          '<select id="ei_quitar" style="width:100%;border:2px solid #fca5a5;border-radius:8px;padding:8px;font-size:11px;font-weight:700;outline:none;background:#fff;box-sizing:border-box;">'+optsQuitar+'</select>' +
          '</div>' : '') +

          '</div>';

        const res = await Swal.fire({
          title: 'Editar Insumo: '+nomActual,
          html: htmlModal,
          width: 500,
          showCancelButton: true,
          confirmButtonText: 'Guardar cambios',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#f59e0b',
          preConfirm: function() {
            const nombre = document.getElementById('ei_nombre').value.trim().toUpperCase();
            const costo  = parseFloat(document.getElementById('ei_costo').value) || 0;
            const bloq   = document.getElementById('ei_bloqueado').checked;
            const agregar = document.getElementById('ei_agregar')?.value || '';
            const quitar  = document.getElementById('ei_quitar')?.value  || '';
            if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
            return { nombre, costo, bloq, agregar, quitar };
          }
        });

        if (!res.isConfirmed) return;
        const { nombre:nuevoNom, costo:nuevoCosto, bloq:nuevoBloq, agregar:servAgregar, quitar:servQuitar } = res.value;

        try {
          Swal.fire({ title:'Guardando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });

          // 1. Actualizar insumos_maestro
          const snapOld = await getDoc(doc(db,'insumos_maestro',idActual));
          const dataOld = snapOld.exists() ? snapOld.data() : {};
          const dataNueva = { ...dataOld, nombre:nuevoNom, costo:nuevoCosto, bloqueado:nuevoBloq, actualizadoEn:serverTimestamp() };
          if (nuevoNom !== idActual) {
            await setDoc(doc(db,'insumos_maestro',nuevoNom), dataNueva);
            await deleteDoc(doc(db,'insumos_maestro',idActual));
          } else {
            await setDoc(doc(db,'insumos_maestro',idActual), dataNueva, { merge:true });
          }

          // 2. Renombrar/actualizar en todos los servicios que ya lo usan
          let actualizados = 0;
          const snapServs = await getDocs(collection(db,'servicios_maestro'));
          for (const sDoc of snapServs.docs) {
            const sData = sDoc.data();
            if (!Array.isArray(sData.insumos)) continue;
            const tieneInsumo = sData.insumos.some(ins =>
              (ins.nombre||'').toUpperCase() === idActual.toUpperCase() ||
              (ins.nombre||'').toUpperCase() === nomActual.toUpperCase()
            );

            // Si es el servicio a quitar, filtrar el insumo fuera
            if (servQuitar && sDoc.id === servQuitar) {
              const insLimpios = sData.insumos.filter(ins =>
                (ins.nombre||'').toUpperCase() !== idActual.toUpperCase() &&
                (ins.nombre||'').toUpperCase() !== nomActual.toUpperCase()
              );
              await setDoc(doc(db,'servicios_maestro',sDoc.id), { insumos:insLimpios }, { merge:true });
              actualizados++;
              continue;
            }

            if (!tieneInsumo) continue;
            // Renombrar y actualizar costo/bloqueado
            const insActualizados = sData.insumos.map(ins => {
              const nomIns = (ins.nombre||'').toUpperCase();
              if (nomIns === idActual.toUpperCase() || nomIns === nomActual.toUpperCase()) {
                return { ...ins, nombre:nuevoNom, costo:nuevoCosto, bloqueado:nuevoBloq };
              }
              return ins;
            });
            await setDoc(doc(db,'servicios_maestro',sDoc.id), { insumos:insActualizados }, { merge:true });
            actualizados++;
          }

          // 3. Agregar a servicio adicional
          let msgAgregar = '';
          if (servAgregar) {
            const snapAg = await getDoc(doc(db,'servicios_maestro',servAgregar));
            if (snapAg.exists()) {
              const insAg = snapAg.data().insumos || [];
              const yaEsta = insAg.some(ins => (ins.nombre||'').toUpperCase() === nuevoNom.toUpperCase());
              if (!yaEsta) {
                insAg.push({ nombre:nuevoNom, costo:nuevoCosto, bloqueado:nuevoBloq });
                await setDoc(doc(db,'servicios_maestro',servAgregar), { insumos:insAg }, { merge:true });
                msgAgregar = '<br><span style="font-size:10px;color:#2563eb;">✅ Agregado a: '+servAgregar+'</span>';
              }
            }
          }

          Swal.close();
          console.log('[AVIPET] Insumo editado:', idActual, '→', nuevoNom, '$'+nuevoCosto, 'actualizados:'+actualizados);
          await Swal.fire({
            icon:'success', title:'Insumo actualizado',
            html:'<b>'+nuevoNom+'</b> — $'+nuevoCosto.toFixed(2)+(nuevoBloq?' 🔒':'')+
              (actualizados>0?'<br><span style="font-size:10px;color:#16a34a;">Actualizado en '+actualizados+' servicio(s)</span>':'')+
              msgAgregar,
            timer:2500, showConfirmButton:false
          });
          window.renderizarTablaInsumos();
        } catch(e){ Swal.close(); Swal.fire({icon:'error',title:'Error',text:e.message}); }
      }));
      // Candado
      f3.appendChild(mkBtn(bloqueado?'Desbloquear':'Bloquear', bloqueado?'#f59e0b':'#64748b', async function(){
        const conf=await Swal.fire({icon:bloqueado?'question':'warning',title:(bloqueado?'Desbloquear':'Bloquear')+': '+nombreMostrar,html:'<p style="font-size:11px;">'+(bloqueado?'Los doctores podran eliminarlo del historial.':'Los doctores NO podran eliminarlo.')+'</p>',showCancelButton:true,confirmButtonColor:bloqueado?'#64748b':'#f59e0b',confirmButtonText:bloqueado?'Desbloquear':'Bloquear'});
        if(!conf.isConfirmed) return;
        try { await updateDoc(doc(db,"insumos_maestro",r.id),{bloqueado:!bloqueado,actualizadoEn:serverTimestamp()}); window.renderizarTablaInsumos(); }
        catch(e){alert('Error: '+e.message);}
      }));
      // Eliminar
      f3.appendChild(mkBtn('Del','#fca5a5', function(){
        this.style.color='#dc2626'; window.eliminarInsumoIndividual(r.id,nombreMostrar);
      }));
      card.appendChild(f3);
      cont.appendChild(card);
    });
  } catch(e){ cont.innerHTML='<p class="text-red-500 text-[9px] text-center italic py-4">Error: '+e.message+'</p>'; }
};


// Función interna para guardar costo con feedback visual
async function _guardarCostoInsumoFila(inputEl, btnEl) {
  if (!inputEl) return;
  const idInsumo = inputEl.dataset.id;
  const valor = parseFloat(inputEl.value);
  if (isNaN(valor) || valor < 0) {
    inputEl.style.borderColor = '#dc2626';
    setTimeout(function(){ inputEl.style.borderColor = ''; }, 1500);
    return;
  }
  // Feedback visual en botón
  if (btnEl) { btnEl.textContent = '...'; btnEl.disabled = true; btnEl.style.background = '#94a3b8'; }
  try {
    await updateDoc(doc(db, "insumos_maestro", idInsumo), {
      costo: valor,
      actualizadoEn: serverTimestamp()
    });
    // Exito: input verde + botón verde
    inputEl.style.borderColor = '#16a34a';
    inputEl.style.background = '#f0fdf4';
    if (btnEl) { btnEl.textContent = 'OK'; btnEl.style.background = '#16a34a'; }
    setTimeout(function(){
      inputEl.style.borderColor = '';
      inputEl.style.background = '';
      if (btnEl) { btnEl.textContent = 'Guardar'; btnEl.style.background = ''; btnEl.disabled = false; btnEl.className = 'text-[8px] px-2 py-1.5 bg-emerald-500 text-white rounded-lg font-black hover:bg-emerald-600 transition-all uppercase'; }
    }, 1800);
  } catch(e) {
    console.error('Error guardando insumo:', e);
    inputEl.style.borderColor = '#dc2626';
    if (btnEl) { btnEl.textContent = 'Error'; btnEl.style.background = '#dc2626'; btnEl.disabled = false; }
    setTimeout(function(){
      inputEl.style.borderColor = '';
      if (btnEl) { btnEl.textContent = 'Guardar'; btnEl.style.background = ''; btnEl.className = 'text-[8px] px-2 py-1.5 bg-emerald-500 text-white rounded-lg font-black hover:bg-emerald-600 transition-all uppercase'; }
    }, 2500);
  }
}

window.actualizarCostoInsumo=async(idInsumo,valor)=>{try{await updateDoc(doc(db,"insumos_maestro",idInsumo),{costo:parseFloat(valor)||0,actualizadoEn:serverTimestamp()});}catch(e){console.error(e);}};

window.eliminarInsumoIndividual=async(idInsumo,nombreInsumo)=>{
  const clave=prompt('Eliminar "'+nombreInsumo+'"\nCLAVE MAESTRA:');
  if(!clave||clave.trim()!==MASTER_KEY()){alert('Clave incorrecta.');return;}
  if(!confirm('Eliminar "'+nombreInsumo+'".\nConfirmas?'))return;
  try{
    // 1. Eliminar de insumos_maestro
    await deleteDoc(doc(db,'insumos_maestro',idInsumo));
    // 2. Eliminar de todos los servicios_maestro que lo usan
    let serviciosActualizados=0;
    const snapServs=await getDocs(collection(db,'servicios_maestro'));
    for(const sDoc of snapServs.docs){
      const sData=sDoc.data();
      if(!Array.isArray(sData.insumos))continue;
      const tieneInsumo=sData.insumos.some(ins=>(ins.nombre||'').toUpperCase()===(nombreInsumo||'').toUpperCase()||
        (ins.nombre||'').toUpperCase()===(idInsumo||'').toUpperCase());
      if(!tieneInsumo)continue;
      const insumosLimpios=sData.insumos.filter(ins=>{
        const nomIns=(ins.nombre||'').toUpperCase();
        return nomIns!==(nombreInsumo||'').toUpperCase()&&nomIns!==(idInsumo||'').toUpperCase();
      });
      await setDoc(doc(db,'servicios_maestro',sDoc.id),{insumos:insumosLimpios},{merge:true});
      serviciosActualizados++;
    }
    console.log('[AVIPET] Insumo eliminado:',nombreInsumo,'— servicios actualizados:',serviciosActualizados);
    alert('Eliminado. Actualizado en '+serviciosActualizados+' servicio(s).');
    window.renderizarTablaInsumos();
  }catch(e){console.error(e);alert('Error: '+e.message);}
};;

// --- INICIALIZAR BD ---
window.inicializarBaseDeDatosCompleta=async()=>{const clave=prompt("? CLAVE MAESTRA:");if(!clave||clave.trim()!==MASTER_KEY()){alert("? Clave incorrecta.");return;}if(!confirm("(!) ?Inicializar catalogo de servicios en Firebase?"))return;
const SERVICIOS_DEFAULT={"CONSULTA GENERAL":{precioVenta:30,porcDoc:40},"CONSULTA OFTALMOLOGICA":{precioVenta:80,porcDoc:12.5},"CONSULTA DE EMERGENCIA":{precioVenta:40,porcDoc:40},"ABSCESO":{precioVenta:25,porcDoc:50},"ECOGRAFIA":{precioVenta:30,porcDoc:40},"COLOCACION VIA":{precioVenta:15,porcDoc:50},"ADMINISTRACION MEDICINA":{precioVenta:10,porcDoc:50},"TOMA DE MUESTRA SANGRE":{precioVenta:10,porcDoc:50},"VACUNA SEXTUPLE":{precioVenta:40,porcDoc:50},"VACUNA PUPPY":{precioVenta:40,porcDoc:50},"VACUNA ANTIRRABICA":{precioVenta:30,porcDoc:50},"VACUNA KC (TOS DE LAS PERRERAS)":{precioVenta:45,porcDoc:50},"VACUNA TRIPLE FELINA":{precioVenta:45,porcDoc:50},"VACUNA QUINTUPLE FELINA":{precioVenta:50,porcDoc:50},"VACUNA BIOVETA":{precioVenta:60,porcDoc:50},"HEMATOLOGIA COMPLETA":{precioVenta:23,porcDoc:34.78},"QUIMICA SANGUINEA":{precioVenta:60,porcDoc:50},"DESCARTE HEMOPARASITO":{precioVenta:50,porcDoc:50},"DISTEMPER":{precioVenta:35,porcDoc:50},"PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"FILARIASIS":{precioVenta:40,porcDoc:50},"SIDA - LEUCEMIA":{precioVenta:40,porcDoc:50},"TEST HELICOBACTER PYLORI AG":{precioVenta:40,porcDoc:50},"HEMATOLOGIA + QUIMICA + HEMOPARASITOS":{precioVenta:110,porcDoc:50},"EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"CITOLOGIA 1 OIDO":{precioVenta:15,porcDoc:50},"CITOLOGIA 2 OIDOS":{precioVenta:20,porcDoc:50},"RASPADO PIEL":{precioVenta:10,porcDoc:50},"PERFIL ANEMICO":{precioVenta:25,porcDoc:17.5},"EUTANASIA HASTA 5KG":{precioVenta:80,porcDoc:50},"EUTANASIA HASTA 15KG":{precioVenta:110,porcDoc:50},"EUTANASIA HASTA 25KG":{precioVenta:140,porcDoc:50},"EUTANASIA HASTA 35KG":{precioVenta:170,porcDoc:50},"REFERIDO: EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"REFERIDO: EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"REFERIDO: CULTIVOS":{precioVenta:30,porcDoc:50},"REFERIDO: DESCARTE HEMOPARASITO":{precioVenta:40,porcDoc:50},"REFERIDO: DISTEMPER":{precioVenta:35,porcDoc:50},"REFERIDO: PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"CONSULTA CAMADA 3-4 CACHORROS":{precioVenta:50,porcDoc:40},"CONSULTA CAMADA HASTA 8 CACHORROS":{precioVenta:80,porcDoc:40},"CONSULTA CAMADA MAS DE 8 CACHORROS":{precioVenta:100,porcDoc:40}};
try{Swal.fire({title:'? Inicializando...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});let cnt=0;for(const[nombre,datos]of Object.entries(SERVICIOS_DEFAULT)){await setDoc(doc(db,"servicios_maestro",nombre),{...datos,actualizadoEn:serverTimestamp()},{merge:true});cnt++;}Swal.close();alert(`? ${cnt} servicios inicializados.`);window.renderizarTablaMaestra();}catch(e){Swal.close();console.error(e);alert("? Error: "+e.message);}};

// --- CAMBIAR SUB-TAB CONFIG ---
window.cambiarSubTabConfig = (tab) => {
  ['servicios','insumos','medicamentos','seguridad','tarifa','compras'].forEach(t => {
    const panel = document.getElementById('panel_subTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn   = document.getElementById('btn_subTab'   + t.charAt(0).toUpperCase() + t.slice(1));
    const activo = t === tab;
    panel?.classList.toggle('hidden', !activo);
    if (btn) {
      // Usar estilos inline para garantizar igualdad sin depender de Tailwind
      btn.style.background  = activo ? '#2563eb' : 'transparent';
      btn.style.color       = activo ? '#ffffff' : '#64748b';
      btn.style.fontWeight  = '900';
      btn.style.fontSize    = '10px';
      btn.style.padding     = '8px 4px';
      btn.style.borderRadius = '8px';
      btn.style.border      = 'none';
      btn.style.cursor      = 'pointer';
      btn.style.textTransform = 'uppercase';
      btn.style.whiteSpace  = 'nowrap';
      btn.style.overflow    = 'hidden';
      btn.style.textOverflow = 'ellipsis';
    }
  });
  if (tab === 'servicios')    window.renderizarTablaMaestra();
  if (tab === 'insumos')      _llamarFuncion('renderizarTablaInsumos');
  if (tab === 'medicamentos') _llamarFuncion('renderizarTablaMedicamentos');
  if (tab === 'compras')      _llamarFuncion('cargarRegistroCompras');
};




// ─── ABRIR CONSULTA PARA EDITAR DESDE BUSCADOR ───────────────────────────────
// Esta funcion es llamada por buscador.js cuando el usuario hace click en "Editar Consulta"
window._abrirConsultaParaEditar = async (idConsulta) => {
  try {
    const snap = await getDoc(doc(db, "consultas", idConsulta));
    if (!snap.exists()) {
      Swal.fire({ icon:'error', title:'No encontrado', text:'La consulta no existe en Firebase.', timer:2500, showConfirmButton:false });
      return;
    }
    const r = snap.data();

    // Navegar a historia primero
    if (typeof window.showTab === 'function') window.showTab('historia');

    // Esperar a que la section este visible, luego llenar
    setTimeout(function() {
      const set = function(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; };
      const setCheck = function(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; };

      // Datos del paciente
      set('hCI',       r.cedula);
      set('hProp',     r.propietario);
      set('hNombre',   r.paciente);
      set('hEspecie',  r.especie);
      set('hRaza',     r.raza);
      set('hSexo',     r.sexo);
      set('hEdad',     r.edad);
      set('hPeso',     r.peso);
      set('hColor',    r.color);
      set('hTlf',      r.telefono);
      set('hMail',     r.correo);
      set('hDir',      r.direccion);
      set('hFechaNac', r.fechaNacimiento);
      setCheck('hAlerta', r.alerta);

      // Datos clinicos
      set('hTratamiento', r.tratamiento);
      set('precioVenta',  r.montoVenta);

      // Guardar el ID para que al guardar actualice en vez de crear
      window._editandoConsultaId = idConsulta;

      // Seleccionar el doctor
      if (r.doctor) {
        const selDoc = document.getElementById('selectorDoctor');
        if (selDoc) {
          const opciones = selDoc.querySelectorAll('button');
          opciones.forEach(function(btn) {
            if (btn.dataset && btn.dataset.doctor && r.doctor.includes(btn.dataset.doctor)) {
              btn.click();
            }
          });
        }
      }

      // Restaurar servicios realizados con precios historicos
      if (Array.isArray(r.serviciosRealizados) && r.serviciosRealizados.length > 0) {
        (async function() {
          for (var serv of r.serviciosRealizados) {
            if (serv.nombre) {
              await window.insertarServicio(serv.nombre);
              if (serv.precio != null && serv.precio > 0) {
                document.querySelectorAll('.servicio-principal').forEach(function(fila) {
                  var nomFila = (fila.querySelector('td')?.innerText || '').replace(/[🔹💊]/g,'').split('(')[0].trim();
                  if (normalizarNombre(nomFila) === normalizarNombre(serv.nombre)) {
                    fila.setAttribute('data-precio', serv.precio);
                  }
                });
              }
            }
          }
          // Restaurar el total guardado
          var inpPrecio = document.getElementById('precioVenta');
          if (inpPrecio && r.montoVenta > 0) inpPrecio.value = r.montoVenta;
        })();
      } else if (r.montoVenta > 0) {
        var visual = document.getElementById('visualizacionServicios');
        if (visual) visual.innerHTML = '<p style="font-size:10px;color:#f59e0b;font-weight:700;">Consulta guardada sin detalle de servicios. Agrega los servicios manualmente.</p>';
      }

      // Mostrar aviso
      Swal.fire({
        icon: 'info',
        title: 'Consulta cargada para editar',
        html: '<p style="font-size:11px;color:#64748b;">Paciente: <b>' + (r.paciente||'---') + '</b><br>' +
              'Fecha original: ' + (r.fechaSimple||'---') + '<br><br>' +
              '<span style="color:#dc2626;font-weight:900;">Al guardar se actualizara el registro existente.</span></p>',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1d4ed8'
      });

      // Mostrar banner de edicion
      if (typeof _mostrarBannerEdicion === 'function') _mostrarBannerEdicion(r.paciente, r.fechaSimple);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 600);

  } catch(e) {
    console.error('Error cargando consulta:', e);
    Swal.fire({ icon:'error', title:'Error', text: e.message, timer:3000, showConfirmButton:false });
  }
};

// ─── SERVICIO SIN MASCOTA (MUESTRAS: SANGRE, ORINA, HECES, ETC.) ─────────────
// Permite registrar un servicio veterinario donde solo traen la muestra,
// sin que el paciente este fisicamente presente.
// Se guarda en la misma coleccion "consultas" con flag muestra:true
window.registrarServicioSinMascota = async () => {
  try {
    // Paso 1 — datos del propietario y tipo de muestra
    const res1 = await Swal.fire({
      title: 'Servicio sin Mascota',
      width: 500,
      html:
        '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">' +
          '<div><label style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Propietario / Cliente</label>' +
          '<input type="text" id="sm_prop" placeholder="Nombre del propietario..." ' +
            'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;margin-top:4px;"></div>' +
          '<div><label style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Cedula (opcional)</label>' +
          '<input type="text" id="sm_ci" placeholder="CI del propietario..." ' +
            'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;margin-top:4px;"></div>' +
          '<div><label style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;">Tipo de muestra / Paciente referencia</label>' +
          '<input type="text" id="sm_paciente" placeholder="Ej: Muestra sangre Max, Heces Coco..." ' +
            'style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;margin-top:4px;"></div>' +
        '</div>',
      showCancelButton: true,
      confirmButtonText: 'Siguiente: Servicios',
      cancelButtonText: 'Cancelar',
      preConfirm: function() {
        const prop = document.getElementById('sm_prop')?.value.trim();
        if (!prop) { Swal.showValidationMessage('Escribe el nombre del propietario'); return false; }
        const pac = document.getElementById('sm_paciente')?.value.trim();
        if (!pac) { Swal.showValidationMessage('Escribe el tipo de muestra o nombre del paciente'); return false; }
        return {
          propietario: prop,
          cedula: document.getElementById('sm_ci')?.value.trim() || 'SIN-CI',
          paciente: pac
        };
      }
    });
    if (!res1.isConfirmed) return;
    const datosBase = res1.value;

    // Paso 2 — elegir doctor
    const res2 = await Swal.fire({
      title: 'Asignar Doctor',
      html:
        '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
          '<button type="button" onclick="window._smDoctor=\'Darwin\';document.querySelectorAll(\'.btn-sm-doc\').forEach(function(b){b.style.opacity=\'0.4\';});this.style.opacity=\'1\';" ' +
            'class="btn-sm-doc" style="width:100%;padding:12px;border-radius:12px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:12px;color:#1d4ed8;cursor:pointer;">Dr. Darwin Sandoval</button>' +
          '<button type="button" onclick="window._smDoctor=\'Joan\';document.querySelectorAll(\'.btn-sm-doc\').forEach(function(b){b.style.opacity=\'0.4\';});this.style.opacity=\'1\';" ' +
            'class="btn-sm-doc" style="width:100%;padding:12px;border-radius:12px;border:2px solid #bbf7d0;background:#f0fdf4;font-weight:900;font-size:12px;color:#15803d;cursor:pointer;">Dr. Joan Silva</button>' +
        '</div>',
      showCancelButton: true,
      confirmButtonText: 'Siguiente: Servicios',
      cancelButtonText: 'Cancelar',
      preConfirm: function() {
        if (!window._smDoctor) { Swal.showValidationMessage('Selecciona un doctor'); return false; }
        return window._smDoctor;
      }
    });
    if (!res2.isConfirmed) return;
    const doctorSel = res2.value === 'Darwin' ? 'Dr. Darwin Sandoval' : 'Dr. Joan Silva';
    window._smDoctor = null;

    // Paso 3 — seleccionar servicios desde servicios_maestro (igual que en historia)
    const snapServ = await getDocs(collection(db, "servicios_maestro"));
    const listaServ = [];
    snapServ.forEach(function(d){ listaServ.push({ id:d.id, ...d.data() }); });
    listaServ.sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });

    let htmlServ = '<p style="font-size:9px;color:#64748b;margin-bottom:8px;">Selecciona los servicios realizados:</p>';
    htmlServ += '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">';
    listaServ.forEach(function(s) {
      const precio = parseFloat(s.precioVenta||0).toFixed(2);
      const porc   = parseFloat(s.porcDoc||s.porcentajeDoc||30);
      htmlServ +=
        '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;background:#f8fafc;">' +
          '<input type="checkbox" class="chk-sm-serv" value="' + s.id + '" data-nombre="' + (s.nombre||'') + '" data-precio="' + precio + '" data-porc="' + porc + '" style="width:16px;height:16px;accent-color:#2563eb;">' +
          '<span style="flex:1;font-size:11px;font-weight:700;color:#1e293b;">' + (s.nombre||'---') + '</span>' +
          '<span style="font-size:11px;font-weight:900;color:#16a34a;">$' + precio + '</span>' +
          '<span style="font-size:9px;color:#64748b;">' + porc + '%</span>' +
        '</label>';
    });
    htmlServ += '</div>';

    const res3 = await Swal.fire({
      title: 'Servicios para: ' + datosBase.paciente,
      width: 550,
      html: htmlServ,
      showCancelButton: true,
      confirmButtonText: 'Calcular y Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: function() {
        const seleccionados = Array.from(document.querySelectorAll('.chk-sm-serv:checked'));
        if (seleccionados.length === 0) { Swal.showValidationMessage('Selecciona al menos un servicio'); return false; }
        return seleccionados.map(function(el) {
          return {
            id:     el.value,
            nombre: el.dataset.nombre,
            precio: parseFloat(el.dataset.precio),
            porc:   parseFloat(el.dataset.porc)
          };
        });
      }
    });
    if (!res3.isConfirmed) return;
    const serviciosSeleccionados = res3.value;

    // Calcular totales con logica de insumos igual que en guardarFirebase
    let montoVenta = 0, montoInsumos = 0, pagoDoctor = 0;
    const serviciosRealizados = [];
    const detalleInsumos = [];

    // Porccentaje global de configuracion
    // Usa % individual de cada servicio (porcGlobal eliminado)
    for (let i = 0; i < serviciosSeleccionados.length; i++) {
      const s = serviciosSeleccionados[i];
      const snapS = await getDoc(doc(db, "servicios_maestro", s.id));
      let insumosServicio = [];
      let porcFinal = s.porc || 30;

      if (snapS.exists()) {
        const sd = snapS.data();
        insumosServicio = sd.insumos || [];
        porcFinal = parseFloat(sd.porcDoc || sd.porcentajeDoc || s.porc || 30);
      }

      // Calcular costo insumos de este servicio
      let costoServicio = 0;
      for (let j = 0; j < insumosServicio.length; j++) {
        const ins = insumosServicio[j];
        const costoIns = parseFloat(ins.costoUso || ins.costo || 0);
        costoServicio += costoIns;
        if (costoIns > 0) {
          detalleInsumos.push({ nombre: ins.nombre||'---', costo: costoIns, servicio: s.nombre });
        }
      }

      const utilidad = s.precio - costoServicio;
      const docPago  = utilidad > 0 ? parseFloat((utilidad * porcFinal / 100).toFixed(4)) : 0;

      montoVenta   += s.precio;
      montoInsumos += costoServicio;
      pagoDoctor   += docPago;

      serviciosRealizados.push({
        nombre: s.nombre,
        precio: s.precio,
        insumos: costoServicio,
        pagoDoc: docPago,
        porcentaje: porcFinal
      });
    }

    const pagoAvipet = montoVenta - montoInsumos - pagoDoctor;

    // Mostrar resumen antes de guardar
    let resHtml = '<div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:left;">';
    serviciosRealizados.forEach(function(s) {
      resHtml += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #f1f5f9;">' +
        '<span style="font-weight:700;">' + s.nombre + '</span>' +
        '<span style="font-weight:900;color:#16a34a;">$' + s.precio.toFixed(2) + '</span></div>';
    });
    resHtml += '</div>';
    resHtml +=
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;">' +
        '<div style="background:#eff6ff;border-radius:10px;padding:8px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#2563eb;text-transform:uppercase;margin:0;">Venta</p>' +
          '<p style="font-size:16px;font-weight:900;color:#1d4ed8;margin:2px 0;">$' + montoVenta.toFixed(2) + '</p></div>' +
        '<div style="background:#fef3c7;border-radius:10px;padding:8px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#92400e;text-transform:uppercase;margin:0;">Insumos</p>' +
          '<p style="font-size:16px;font-weight:900;color:#92400e;margin:2px 0;">$' + montoInsumos.toFixed(4) + '</p></div>' +
        '<div style="background:#eff6ff;border-radius:10px;padding:8px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#2563eb;text-transform:uppercase;margin:0;">Doctor</p>' +
          '<p style="font-size:16px;font-weight:900;color:#1d4ed8;margin:2px 0;">$' + pagoDoctor.toFixed(4) + '</p></div>' +
      '</div>' +
      '<div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;margin-top:8px;">' +
        '<p style="font-size:8px;font-weight:900;color:#16a34a;text-transform:uppercase;margin:0;">Neto Avipet</p>' +
        '<p style="font-size:22px;font-weight:900;color:#16a34a;margin:4px 0;">$' + pagoAvipet.toFixed(2) + '</p></div>';

    const resConf = await Swal.fire({
      title: 'Confirmar y Guardar',
      width: 520,
      html: resHtml,
      showCancelButton: true,
      confirmButtonText: 'Guardar en Firebase',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a'
    });
    if (!resConf.isConfirmed) return;

    // Guardar en Firebase en coleccion "consultas"
    const hoy = new Date();
    await addDoc(collection(db, "consultas"), {
      cedula:          datosBase.cedula,
      propietario:     datosBase.propietario,
      paciente:        datosBase.paciente,
      especie:         'Muestra',
      raza:            '',
      doctor:          doctorSel,
      montoVenta:      parseFloat(montoVenta.toFixed(2)),
      montoInsumos:    parseFloat(montoInsumos.toFixed(4)),
      pagoDoctor:      parseFloat(pagoDoctor.toFixed(4)),
      pagoAvipet:      parseFloat(pagoAvipet.toFixed(2)),
      serviciosRealizados: serviciosRealizados,
      listaDetalladaInsumos: detalleInsumos,
      tratamiento:     serviciosRealizados.map(function(s){ return s.nombre; }).join(', '),
      esMuestra:       true,
      fecha:           serverTimestamp(),
      fechaSimple:     hoy.getDate() + '/' + (hoy.getMonth()+1) + '/' + hoy.getFullYear()
    });

    await Swal.fire({
      icon: 'success',
      title: 'Servicio guardado',
      html: '<p style="font-size:12px;color:#64748b;">' + datosBase.paciente + '<br>' +
            '<b style="color:#16a34a;">$' + montoVenta.toFixed(2) + '</b> — ' + doctorSel + '</p>',
      timer: 2500,
      showConfirmButton: false
    });

  } catch(e) {
    console.error('Error servicio sin mascota:', e);
    Swal.fire({ icon:'error', title:'Error', text: e.message });
  }
};



// =========================================================
// MODULO COMPRAS / FACTURAS DE INSUMOS
// Coleccion Firebase: "compras_insumos"
// Campos: insumo, cantidad, precioUnitario, precioTotal,
//         proveedor, notas, fotoFactura, fecha, fechaSimple,
//         registradoPor, moneda
// =========================================================

window.abrirModalNuevaCompra = async () => {
  // Verificar clave maestra o PIN de Aiby (2222)
  const clave = prompt('Clave maestra o PIN:');
  if (!clave) return;
  const claveValida =
    clave.trim() === (window.MASTER_KEY_SISTEMA || 'AVIPET2026') ||
    clave.trim() === 'AVIPET2026' ||
    clave.trim() === '2222';
  if (!claveValida) {
    await Swal.fire({ icon:'error', title:'Acceso denegado', text:'Clave o PIN incorrecto.', timer:2000, showConfirmButton:false });
    return;
  }
  const registradoPor = clave.trim() === '2222' ? 'Aiby' : 'Administrador';

  // Cargar insumos del catálogo — incluye todos los documentos con y sin campo nombre
  const insumosCatalogo = [];
  try {
    const snapIns = await getDocs(collection(db, "insumos_maestro"));
    snapIns.forEach(d => {
      const r = d.data();
      // Usar campo nombre si existe, si no usar el ID del documento
      const nombreInsumo = (r.nombre || d.id || '').trim();
      if (nombreInsumo) insumosCatalogo.push(nombreInsumo);
    });
    insumosCatalogo.sort();
  } catch(e) { console.warn('Error cargando insumos para compras:', e); }

  let optsInsumos = '<option value="">-- Seleccionar insumo --</option><option value="__otro__">Otro (escribir)</option>';
  insumosCatalogo.forEach(n => { optsInsumos += '<option value="'+n+'">'+n+'</option>'; });

  const hoy = new Date();
  const fechaHoy = hoy.getFullYear()+'-'+(hoy.getMonth()+1).toString().padStart(2,'0')+'-'+hoy.getDate().toString().padStart(2,'0');

  // Lista reactiva de insumos de esta compra
  let listaItems = []; // { insumo, cantidad, precioUnit }
  window._fotoFacturaB64 = null;

  const renderItems = () => {
    const cont = document.getElementById('cmp_lista_items');
    if (!cont) return;
    if (listaItems.length === 0) {
      cont.innerHTML = '<p style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;font-style:italic;">Sin insumos agregados aún.</p>';
    } else {
      cont.innerHTML = '';
      let totalGeneral = 0;
      listaItems.forEach((item, idx) => {
        const subtotal = item.cantidad * item.precioUnit;
        totalGeneral += subtotal;
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:1fr 60px 70px 70px auto;gap:6px;align-items:center;padding:6px 8px;background:#f8fafc;border-radius:8px;margin-bottom:4px;border:1px solid #e2e8f0;';
        row.innerHTML =
          '<span style="font-size:10px;font-weight:900;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+item.insumo+'</span>' +
          '<span style="font-size:10px;font-weight:700;color:#64748b;text-align:center;">x'+item.cantidad+'</span>' +
          '<span style="font-size:10px;font-weight:700;color:#64748b;text-align:center;">$'+item.precioUnit.toFixed(2)+'</span>' +
          '<span style="font-size:11px;font-weight:900;color:#16a34a;text-align:center;">$'+subtotal.toFixed(2)+'</span>' +
          '<button type="button" data-idx="'+idx+'" class="btn-cmp-del" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:900;cursor:pointer;">✕</button>';
        cont.appendChild(row);
      });
      // Total general
      const totalDiv = document.createElement('div');
      totalDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f0fdf4;border-radius:8px;border:2px solid #bbf7d0;margin-top:4px;';
      totalDiv.innerHTML = '<span style="font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;">Total factura</span><span style="font-size:16px;font-weight:900;color:#16a34a;font-family:monospace;">$'+totalGeneral.toFixed(2)+'</span>';
      cont.appendChild(totalDiv);
    }
    // Bind botones eliminar
    cont.querySelectorAll('.btn-cmp-del').forEach(btn => {
      btn.addEventListener('click', function() {
        listaItems.splice(parseInt(this.dataset.idx), 1);
        renderItems();
      });
    });
  };

  const htmlModal =
    '<div style="display:flex;flex-direction:column;gap:10px;text-align:left;">' +

    // Proveedor y fecha (datos de la factura)
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
    '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Proveedor / Farmacia</label>' +
    '<input id="cmp_proveedor" type="text" placeholder="Nombre del proveedor..." style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;"></div>' +
    '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Fecha de compra</label>' +
    '<input id="cmp_fecha" type="date" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;"></div>' +
    '</div>' +

    // Notas
    '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Notas generales</label>' +
    '<input id="cmp_notas" type="text" placeholder="Observaciones, lote, vencimiento..." style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;"></div>' +

    // Separador AGREGAR INSUMOS
    '<div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:10px;">' +
    '<p style="font-size:9px;font-weight:900;color:#2563eb;text-transform:uppercase;margin:0 0 8px 0;">+ Agregar insumos a esta compra</p>' +

    // Selector insumo
    '<div style="margin-bottom:6px;">' +
    '<select id="cmp_insumo_sel" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:11px;font-weight:700;background:#fff;outline:none;box-sizing:border-box;">' + optsInsumos + '</select>' +
    '<input id="cmp_insumo_otro" type="text" placeholder="Nombre del insumo..." style="display:none;width:100%;border:2px solid #3b82f6;border-radius:8px;padding:7px;font-size:11px;font-weight:700;outline:none;box-sizing:border-box;margin-top:6px;text-transform:uppercase;"></div>' +

    // Cantidad y precio
    '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:flex-end;">' +
    '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Cantidad</label>' +
    '<input id="cmp_cantidad" type="number" step="1" min="1" value="1" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:13px;font-weight:900;outline:none;box-sizing:border-box;"></div>' +
    '<div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:3px;">Precio unitario ($)</label>' +
    '<input id="cmp_precio_unit" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:7px;font-size:13px;font-weight:900;outline:none;box-sizing:border-box;"></div>' +
    '<button type="button" id="btn_cmp_agregar" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;">+ Agregar</button>' +
    '</div></div>' +

    // Lista de items agregados
    '<div><p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 6px 0;">Insumos en esta compra:</p>' +
    '<div id="cmp_lista_items" style="max-height:200px;overflow-y:auto;"></div></div>' +

    // Foto factura
    '<div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:10px;padding:10px;text-align:center;">' +
    '<p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 8px 0;">Foto de factura (opcional)</p>' +
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:6px;flex-wrap:wrap;">' +
    '<button type="button" id="btn_cmp_camara" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:900;cursor:pointer;">Cámara</button>' +
    '<button type="button" id="btn_cmp_galeria" style="background:#64748b;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:900;cursor:pointer;">Galería</button>' +
    '<button type="button" id="btn_cmp_qr" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:900;cursor:pointer;">QR Móvil</button>' +
    '</div>' +
    '<input type="file" id="cmp_foto_cam" accept="image/*" capture="environment" style="display:none">' +
    '<input type="file" id="cmp_foto_gal" accept="image/*" style="display:none">' +
    '<div id="cmp_qr_container" style="display:none;margin:8px auto 0;text-align:center;">' +
    '<p style="font-size:9px;color:#7c3aed;font-weight:900;margin:0 0 4px 0;">Escanea desde tu teléfono para subir la foto</p>' +
    '<div id="cmp_qr_div" style="display:inline-block;padding:8px;background:#fff;border-radius:8px;border:2px solid #e2e8f0;"></div>' +
    '<p style="font-size:8px;color:#94a3b8;margin:4px 0 0 0;">La foto llegará automáticamente aquí</p>' +
    '</div>' +
    '<div id="cmp_foto_preview" style="display:none;margin-top:6px;">' +
    '<img id="cmp_foto_img" style="max-width:100%;max-height:120px;border-radius:8px;border:2px solid #bfdbfe;object-fit:contain;" src="">' +
    '<button type="button" id="btn_cmp_quitar" style="display:block;margin:4px auto 0;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:3px 10px;font-size:9px;font-weight:900;cursor:pointer;">Quitar foto</button>' +
    '</div>' +
    '<p id="cmp_foto_status" style="font-size:9px;color:#94a3b8;margin:4px 0 0 0;"></p>' +
    '</div>' +
    '</div>';

  const res = await Swal.fire({
    title: 'Nueva Compra / Factura',
    html: htmlModal,
    width: 560,
    showCancelButton: true,
    confirmButtonText: 'Guardar Compra',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#16a34a',
    didOpen: function() {
      document.getElementById('cmp_fecha').value = fechaHoy;
      renderItems();

      // Mostrar/ocultar campo libre
      document.getElementById('cmp_insumo_sel').addEventListener('change', function() {
        document.getElementById('cmp_insumo_otro').style.display = this.value === '__otro__' ? 'block' : 'none';
      });

      // Botón agregar item a la lista
      document.getElementById('btn_cmp_agregar').addEventListener('click', function() {
        const sel      = document.getElementById('cmp_insumo_sel');
        const otro     = document.getElementById('cmp_insumo_otro').value.trim().toUpperCase();
        const insumo   = sel.value === '__otro__' ? otro : sel.value;
        const cantidad = parseFloat(document.getElementById('cmp_cantidad').value) || 0;
        const precio   = parseFloat(document.getElementById('cmp_precio_unit').value) || 0;

        if (!insumo)     { alert('Selecciona o escribe el insumo'); return; }
        if (cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return; }
        if (precio <= 0)   { alert('El precio debe ser mayor a 0'); return; }

        listaItems.push({ insumo, cantidad, precioUnit: precio });
        // Limpiar campos para siguiente insumo
        sel.value = '';
        document.getElementById('cmp_insumo_otro').style.display = 'none';
        document.getElementById('cmp_insumo_otro').value = '';
        document.getElementById('cmp_cantidad').value = '1';
        document.getElementById('cmp_precio_unit').value = '';
        renderItems();
      });

      // Foto
      const procesarFoto = async (input) => {
        const file = input.files[0];
        if (!file) return;
        const status = document.getElementById('cmp_foto_status');
        if (status) status.textContent = 'Procesando...';
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const comprimida = await comprimirImagen(e.target.result, 1000, 0.7);
            window._fotoFacturaB64 = comprimida;
            document.getElementById('cmp_foto_img').src = comprimida;
            document.getElementById('cmp_foto_preview').style.display = 'block';
            if (status) status.textContent = 'Foto lista ✓';
          } catch(err) {
            if (status) status.textContent = 'Error procesando imagen';
          }
        };
        reader.readAsDataURL(file);
        input.value = '';
      };
      document.getElementById('btn_cmp_camara').addEventListener('click', () => document.getElementById('cmp_foto_cam').click());
      document.getElementById('btn_cmp_galeria').addEventListener('click', () => document.getElementById('cmp_foto_gal').click());
      document.getElementById('cmp_foto_cam').addEventListener('change', function() { procesarFoto(this); });
      document.getElementById('cmp_foto_gal').addEventListener('change', function() { procesarFoto(this); });
      document.getElementById('btn_cmp_quitar').addEventListener('click', function() {
        window._fotoFacturaB64 = null;
        document.getElementById('cmp_foto_img').src = '';
        document.getElementById('cmp_foto_preview').style.display = 'none';
        const status = document.getElementById('cmp_foto_status');
        if (status) status.textContent = '';
      });

      // QR Móvil — genera un ID único para esta sesión de compra
      const sesionCompraId = 'compra_' + Date.now();
      window._unsubCompraFoto = null;
      window._sesionCompraInicio = null;

      document.getElementById('btn_cmp_qr').addEventListener('click', function() {
        const qrCont = document.getElementById('cmp_qr_container');
        const qrDiv  = document.getElementById('cmp_qr_div');
        if (!qrDiv) return;

        // Generar URL con modo=mobile y tipo=compras + sesionId
        const url = window.location.origin + window.location.pathname + '?mode=mobile&ci='+sesionCompraId+'&tipo=compras';
        qrDiv.innerHTML = '';
        new QRCode(qrDiv, { text:url, width:128, height:128 });
        qrCont.style.display = 'block';
        window._sesionCompraInicio = new Date();

        const status = document.getElementById('cmp_foto_status');
        if (status) status.textContent = 'Esperando foto desde el móvil...';

        // Escuchar en tiempo real las fotos que lleguen
        if (window._unsubCompraFoto) window._unsubCompraFoto();
        const q = query(
          collection(db, 'transferencias_fotos'),
          where('ci', '==', sesionCompraId),
          where('tipo', '==', 'compras')
        );
        window._unsubCompraFoto = onSnapshot(q, function(snap) {
          const inicio = window._sesionCompraInicio;
          snap.forEach(function(docSnap) {
            const d = docSnap.data();
            if (!d.url) return;
            if (d.fecha?.toDate && d.fecha.toDate() < inicio) return;
            // Llegó una foto — mostrarla
            window._fotoFacturaB64 = d.url;
            document.getElementById('cmp_foto_img').src = d.url;
            document.getElementById('cmp_foto_preview').style.display = 'block';
            qrCont.style.display = 'none';
            if (status) status.textContent = '✓ Foto recibida desde el móvil';
          });
        });
      });
    },
    preConfirm: function() {
      if (listaItems.length === 0) {
        Swal.showValidationMessage('Agrega al menos un insumo a la compra');
        return false;
      }
      const proveedor  = document.getElementById('cmp_proveedor').value.trim();
      const fechaVal   = document.getElementById('cmp_fecha').value;
      const notas      = document.getElementById('cmp_notas').value.trim();
      if (!fechaVal) { Swal.showValidationMessage('Ingresa la fecha de compra'); return false; }
      const partes = fechaVal.split('-');
      const fechaSimple = partes[2]+'/'+partes[1]+'/'+partes[0];
      return { proveedor, fechaSimple, notas };
    }
  });

  if (!res.isConfirmed) {
    window._fotoFacturaB64 = null;
    if (window._unsubCompraFoto) { window._unsubCompraFoto(); window._unsubCompraFoto = null; }
    return;
  }
  const { proveedor, fechaSimple, notas } = res.value;

  try {
    await Swal.fire({ title:'Guardando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });

    const totalFactura = listaItems.reduce((s,i) => s + i.cantidad * i.precioUnit, 0);

    // Guardar un documento por insumo (para filtros individuales) + documento resumen
    for (const item of listaItems) {
      await addDoc(collection(db, "compras_insumos"), {
        insumo:         item.insumo,
        cantidad:       item.cantidad,
        precioUnitario: item.precioUnit,
        precioTotal:    item.cantidad * item.precioUnit,
        proveedor:      proveedor || 'Sin especificar',
        notas,
        fotoFactura:    window._fotoFacturaB64 || null,
        fechaSimple,
        registradoPor,
        totalFactura,
        itemsFactura:   listaItems.length,
        fecha:          serverTimestamp()
      });
    }

    window._fotoFacturaB64 = null;
    if (window._unsubCompraFoto) { window._unsubCompraFoto(); window._unsubCompraFoto = null; }
    Swal.close();
    await Swal.fire({
      icon: 'success',
      title: 'Compra registrada',
      html: '<b>'+listaItems.length+' insumo(s)</b> guardados<br>Total: <b style="color:#16a34a;">$'+totalFactura.toFixed(2)+'</b>',
      timer: 2500,
      showConfirmButton: false
    });
    if (typeof window.cargarRegistroCompras === 'function') window.cargarRegistroCompras();
  } catch(e) {
    Swal.close();
    Swal.fire({ icon:'error', title:'Error', text: e.message });
  }
}

// Preview foto factura
window._previewFactura = async (input) => {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('cmp_foto_status');
  if (status) status.textContent = 'Procesando...';
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // Comprimir igual que en historia clínica
      const comprimida = await comprimirImagen(e.target.result, 1000, 0.7);
      window._fotoFacturaB64 = comprimida;
      const img = document.getElementById('cmp_foto_img');
      const prev = document.getElementById('cmp_foto_preview');
      if (img) img.src = comprimida;
      if (prev) prev.style.display = 'block';
      if (status) status.textContent = '';
    } catch(err) {
      if (status) status.textContent = 'Error procesando imagen';
    }
  };
  reader.readAsDataURL(file);
  input.value = '';
};

window._limpiarFotoFactura = () => {
  window._fotoFacturaB64 = null;
  const img  = document.getElementById('cmp_foto_img');
  const prev = document.getElementById('cmp_foto_preview');
  if (img)  img.src = '';
  if (prev) prev.style.display = 'none';
};

// Cargar y mostrar el registro de compras
window.cargarRegistroCompras = async () => {
  const tablaDiv   = document.getElementById('tablaCompras');
  const resumenDiv = document.getElementById('resumenCompras');
  if (!tablaDiv) return;

  tablaDiv.innerHTML = '<p style="text-align:center;padding:16px;font-size:10px;color:#94a3b8;font-weight:700;">Cargando...</p>';

  try {
    const snap = await getDocs(collection(db, "compras_insumos"));
    let compras = [];
    snap.forEach(d => compras.push({ id: d.id, ...d.data() }));

    // Filtrar por mes si está seleccionado
    const filtroMes = document.getElementById('filtroComprasMes')?.value; // "2025-05"
    if (filtroMes) {
      const [anio, mes] = filtroMes.split('-');
      compras = compras.filter(c => {
        if (!c.fechaSimple) return false;
        const p = c.fechaSimple.split('/');
        return p[2] === anio && p[1] === mes.replace(/^0/,'');
      });
    }

    // Filtrar por insumo si está seleccionado
    const filtroIns = document.getElementById('filtroComprasInsumo')?.value;
    if (filtroIns) {
      compras = compras.filter(c => c.insumo === filtroIns);
    }

    // Ordenar por fecha más reciente
    compras.sort((a,b) => (b.fecha?.seconds||0) - (a.fecha?.seconds||0));

    // Actualizar selector de insumos con los únicos
    const selIns = document.getElementById('filtroComprasInsumo');
    if (selIns && selIns.children.length <= 1) {
      const todosSnap = await getDocs(collection(db, "compras_insumos"));
      const insUnicos = new Set();
      todosSnap.forEach(d => { if (d.data().insumo) insUnicos.add(d.data().insumo); });
      Array.from(insUnicos).sort().forEach(n => {
        if (!selIns.querySelector('option[value="'+n+'"]')) {
          const opt = document.createElement('option');
          opt.value = n; opt.textContent = n;
          selIns.appendChild(opt);
        }
      });
    }

    // Resumen
    const totalGastado  = compras.reduce((s,c) => s + parseFloat(c.precioTotal||0), 0);
    const totalUnidades = compras.reduce((s,c) => s + parseFloat(c.cantidad||0), 0);
    const proveedores   = new Set(compras.map(c => c.proveedor).filter(Boolean));

    if (resumenDiv) {
      resumenDiv.innerHTML =
        '<div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">Total gastado</p>' +
          '<p style="font-size:20px;font-weight:900;color:#16a34a;margin:0;font-family:monospace;">$'+totalGastado.toFixed(2)+'</p>' +
        '</div>' +
        '<div style="background:#eff6ff;border-radius:10px;padding:10px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">Registros</p>' +
          '<p style="font-size:20px;font-weight:900;color:#2563eb;margin:0;">'+compras.length+'</p>' +
        '</div>' +
        '<div style="background:#faf5ff;border-radius:10px;padding:10px;text-align:center;">' +
          '<p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 2px 0;">Proveedores</p>' +
          '<p style="font-size:20px;font-weight:900;color:#7c3aed;margin:0;">'+proveedores.size+'</p>' +
        '</div>';
    }

    if (compras.length === 0) {
      tablaDiv.innerHTML = '<p style="text-align:center;padding:24px;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Sin compras registradas para este filtro</p>';
      return;
    }

    tablaDiv.innerHTML = '';
    compras.forEach(c => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px;';

      const tieneNotas = c.notas && c.notas.trim();
      const tieneFoto  = c.fotoFactura;

      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<div>' +
            '<p style="font-size:12px;font-weight:900;color:#1e293b;margin:0;text-transform:uppercase;">'+c.insumo+'</p>' +
            '<p style="font-size:9px;color:#64748b;margin:2px 0;">'+c.fechaSimple+' &middot; '+( c.proveedor||'Sin proveedor')+'</p>' +
            (tieneNotas ? '<p style="font-size:9px;color:#94a3b8;margin:2px 0;font-style:italic;">'+c.notas+'</p>' : '') +
          '</div>' +
          '<div style="text-align:right;">' +
            '<p style="font-size:14px;font-weight:900;color:#16a34a;margin:0;font-family:monospace;">$'+parseFloat(c.precioTotal||0).toFixed(2)+'</p>' +
            '<p style="font-size:9px;color:#64748b;margin:2px 0;">'+c.cantidad+' × $'+parseFloat(c.precioUnitario||0).toFixed(2)+'</p>' +
            '<p style="font-size:8px;color:#94a3b8;margin:0;">Por: '+( c.registradoPor||'---')+'</p>' +
          '</div>' +
        '</div>' +
        (tieneFoto ?
          '<div style="margin-top:6px;">' +
            '<img src="'+c.fotoFactura+'" style="max-height:80px;border-radius:8px;border:2px solid #bfdbfe;cursor:pointer;object-fit:cover;" ' +
            'onclick="Swal.fire({imageUrl:\''+c.fotoFactura+'\',imageAlt:\'Factura\',showCloseButton:true,showConfirmButton:false,width:400})" ' +
            'title="Ver factura">' +
          '</div>' : '');

      tablaDiv.appendChild(card);
    });

  } catch(e) {
    console.error(e);
    tablaDiv.innerHTML = '<p style="color:#dc2626;text-align:center;padding:16px;font-size:10px;font-weight:900;">Error: '+e.message+'</p>';
  }
};

// Cargar servicios de Firebase al iniciar (fix: no desaparecen al refrescar)
setTimeout(() => window.cargarSelectorServicios?.(), 400);

// Calcular edad automáticamente cuando el usuario cambia la fecha de nacimiento
setTimeout(() => {
  const inpFechaNac = document.getElementById('hFechaNac');
  if (inpFechaNac) {
    inpFechaNac.addEventListener('change', () => _calcularEdadDesdeFechaNac(inpFechaNac.value));
  }
}, 600);
