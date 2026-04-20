#!/usr/bin/env node

const si = require('systeminformation');
const { getMacConnections, getAppBreakdown } = require('./network/mac.js');
const { TerminalUI } = require('./ui.js');
const chalk = require('chalk');

let lastRxBytes = 0;
let lastTxBytes = 0;
let lastTime = Date.now();

async function getNetworkStats() {
  try {
    const networkStats = await si.networkStats();
    
    if (networkStats && networkStats.length > 0) {
      const current = networkStats.find(iface => iface.rx_bytes > 0) || networkStats[0];
      
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      
      let downloadSpeed = 0;
      let uploadSpeed = 0;
      
      if (lastRxBytes > 0 && deltaTime > 0) {
        downloadSpeed = (current.rx_bytes - lastRxBytes) / deltaTime;
        uploadSpeed = (current.tx_bytes - lastTxBytes) / deltaTime;
        
        if (downloadSpeed < 0) downloadSpeed = 0;
        if (uploadSpeed < 0) uploadSpeed = 0;
        if (downloadSpeed > 100 * 1024 * 1024) downloadSpeed = 0;
        if (uploadSpeed > 100 * 1024 * 1024) uploadSpeed = 0;
      }
      
      lastRxBytes = current.rx_bytes;
      lastTxBytes = current.tx_bytes;
      lastTime = now;
      
      return { downloadSpeed, uploadSpeed };
    }
  } catch (error) {}
  
  return { downloadSpeed: 0, uploadSpeed: 0 };
}

async function main() {
  const ui = new TerminalUI();
  
  console.log(chalk.cyan('⚡ NetPulse — Scanning your network...\n'));
  
  setInterval(async () => {
    try {
      const connections = getMacConnections();
      const appStats = getAppBreakdown(connections);
      const stats = await getNetworkStats();
      ui.updateStats(stats, connections, appStats);
    } catch (error) {
      ui.showError(error);
    }
  }, 2000);
}

module.exports = { main };

if (require.main === module) {
  main().catch(console.error);
}