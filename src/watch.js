#!/usr/bin/env node

const { getMacConnections, getAppBreakdown } = require('./network/mac.js');
const chalk = require('chalk');

function watchApp(appName) {
  console.log(chalk.cyan(`\n🔍 Watching: ${chalk.bold(appName)}`));
  console.log(chalk.dim(`Press Ctrl+C to stop\n`));
  
  let lastConnections = [];
  
  setInterval(() => {
    const connections = getMacConnections();
    const appConnections = connections.filter(conn => 
      conn.process.toLowerCase().includes(appName.toLowerCase())
    );
    
    const stats = {
      total: appConnections.length,
      uniqueIPs: new Set(),
      uniquePorts: new Set(),
      dataFlow: { up: 0, down: 0 } // Would need additional tracking
    };
    
    appConnections.forEach(conn => {
      if (conn.remote) {
        const ip = conn.remote.split(':')[0];
        stats.uniqueIPs.add(ip);
      }
      if (conn.port) stats.uniquePorts.add(conn.port);
    });
    
    console.clear();
    console.log(chalk.cyan(`╔════════════════════════════════════════════════════════════════════════════╗`));
    console.log(chalk.cyan(`║  🔍 WATCHING: ${appName.padEnd(67)}║`));
    console.log(chalk.cyan(`╚════════════════════════════════════════════════════════════════════════════╝\n`));
    
    console.log(chalk.yellow(`📊 STATISTICS`));
    console.log(`   ├─ Active Connections: ${chalk.green(stats.total)}`);
    console.log(`   ├─ Unique Remote IPs:  ${chalk.yellow(stats.uniqueIPs.size)}`);
    console.log(`   └─ Unique Ports:       ${chalk.magenta(stats.uniquePorts.size)}\n`);
    
    if (appConnections.length === 0) {
      console.log(chalk.gray(`   ℹ️  No active connections found for "${appName}"`));
    } else {
      console.log(chalk.cyan(`🔗 CONNECTIONS`));
      console.log(`┌──────┬────────────────────────────┬────────────────────────────┬──────────┐`);
      console.log(`│ PORT │ LOCAL                      │ REMOTE                     │ STATUS   │`);
      console.log(`├──────┼────────────────────────────┼────────────────────────────┼──────────┤`);
      
      appConnections.slice(0, 15).forEach(conn => {
        const port = (conn.port || '?').slice(0, 5).padEnd(5);
        const local = (conn.local || '').slice(0, 26).padEnd(26);
        let remote = (conn.remote || '').slice(0, 26).padEnd(26);
        const status = (conn.state || 'ESTAB').slice(0, 9).padEnd(9);
        
        // Highlight suspicious remote IPs
        if (conn.remote && !conn.remote.includes('192.168') && !conn.remote.includes('127.0.0.1')) {
          remote = chalk.red(remote);
        }
        
        console.log(`│ ${port} │ ${local} │ ${remote} │ ${status} │`);
      });
      
      console.log(`└──────┴────────────────────────────┴────────────────────────────┴──────────┘`);
      
      if (appConnections.length > 15) {
        console.log(chalk.dim(`\n   ... and ${appConnections.length - 15} more connections`));
      }
      
      // Alert for new connections
      const newConns = appConnections.filter(c => 
        !lastConnections.some(lc => lc.remote === c.remote)
      );
      
      if (newConns.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${newConns.length} new connection(s) detected!`));
        newConns.forEach(conn => {
          console.log(chalk.dim(`   → ${conn.remote}`));
        });
      }
    }
    
    console.log(chalk.dim(`\n💡 Last updated: ${new Date().toLocaleTimeString()}`));
    lastConnections = appConnections;
    
  }, 2000);
}

module.exports = { watchApp };