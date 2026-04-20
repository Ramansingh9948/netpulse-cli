#!/usr/bin/env node

const args = process.argv.slice(2);

if (args[0] === 'scan') {
  const { scanDevices } = require('../src/scan.js');
  scanDevices();
} else if (args[0] === 'watch' && args[1]) {
  const { watchApp } = require('../src/watch.js');
  watchApp(args[1]);
} else if (args[0] === 'devices') {
  const { scanDevices } = require('../src/devices.js');
  const live = args.includes('--live');
  scanDevices(live);
} else if (args[0] === 'dns') {
  const { startDNSMonitor } = require('../src/dns.js');
  startDNSMonitor(args.slice(1));
} else if (args[0] === 'spy') {
  const { startSpy } = require('../src/spy.js');
  startSpy(args.slice(1));
} else if (args[0] === 'watch') {
  console.log('Usage: netpulse watch <app-name>');
  console.log('Example: netpulse watch instagram');
  process.exit(0);
} else {
  const { main } = require('../src/index.js');
  main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}