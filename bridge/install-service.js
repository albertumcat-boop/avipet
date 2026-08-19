// ============================================================
// install-service.js — Instala el bridge como servicio Windows
// Ejecutar UNA SOLA VEZ como Administrador:
//   node install-service.js
// Para desinstalar:
//   node install-service.js --uninstall
// ============================================================
const Service = require('node-windows').Service;
const path    = require('path');

const svc = new Service({
  name:        'AVIPET Bridge',
  description: 'Bridge local AVIPET ↔ Aclas CR2050 — máquina fiscal',
  script:      path.join(__dirname, 'server.js'),
  nodeOptions: [],
  env: [{ name: 'NODE_ENV', value: 'production' }]
});

const uninstall = process.argv.includes('--uninstall');

if (uninstall) {
  svc.on('uninstall', () => {
    console.log('✅ Servicio AVIPET Bridge desinstalado.');
  });
  svc.uninstall();
} else {
  svc.on('install', () => {
    svc.start();
    console.log('✅ Servicio AVIPET Bridge instalado y arrancado.');
    console.log('   Se iniciará automáticamente con Windows.');
    console.log('   Para verificar: Administrador de Servicios → "AVIPET Bridge"');
  });
  svc.on('alreadyinstalled', () => {
    console.log('ℹ️  El servicio ya estaba instalado.');
  });
  svc.install();
}
