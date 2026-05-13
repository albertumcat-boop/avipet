// AVIPET — permisos.js
// Restringe tabs cuando un doctor esta activo
(function() {
  function aplicar(ocultar) {
    ['[data-tab="reporte"]','[data-tab="inventario"]','[data-tab="config_precios"]'].forEach(function(s) {
      document.querySelectorAll(s).forEach(function(b){ b.style.display = ocultar ? 'none' : ''; });
    });
    var aj = document.querySelector('button[onclick*="config_precios"]');
    if (aj) aj.style.display = ocultar ? 'none' : '';
  }
  var t = setInterval(function() {
    if (typeof window.onDoctorAutenticado !== 'function') return;
    clearInterval(t);
    var orig = window.onDoctorAutenticado;
    window.onDoctorAutenticado = function(id) { orig(id); aplicar(!!id); };
    var origV = window.validarAccesoDoctor;
    if (typeof origV === 'function') {
      window.validarAccesoDoctor = async function(n) { await origV(n); if (!n) aplicar(false); };
    }
  }, 200);
  console.log('permisos.js v1 cargado');
})();
