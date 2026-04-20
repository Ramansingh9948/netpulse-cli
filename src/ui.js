const asciichart = require('asciichart');
const chalk = require('chalk');

class TerminalUI {
  constructor() {
    this.downloadHistory = [];
    this.uploadHistory = [];
    this.startTime = Date.now();
    this.totalDownload = 0;
    this.totalUpload = 0;
  }
  
  isSuspicious(ip) {
    if (!ip || ip === '0.0.0.0:*') return false;
    
    const privateRanges = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', 
                          '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                          '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                          '172.30.', '172.31.', '192.168.', '127.', '::1', 'localhost'];
    
    for (const range of privateRanges) {
      if (ip.startsWith(range)) return false;
    }
    
    return true;
  }
  
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  formatSpeed(bytes) {
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  
  getUptime() {
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  
  displayAppBreakdown(appStats) {
    console.log(chalk.magenta('📱 APP BREAKDOWN (Who is talking where?)'));
    console.log('┌──────────┬────────────┬─────────────┬──────────────┐');
    console.log('│ APP      │ CONNECTIONS│ UNIQUE IPs  │ PORTS        │');
    console.log('├──────────┼────────────┼─────────────┼──────────────┤');
    
    const sortedApps = Object.entries(appStats)
      .sort((a, b) => b[1].connections - a[1].connections)
      .slice(0, 8);
    
    for (const [app, data] of sortedApps) {
      const appName = app.slice(0, 9).padEnd(9);
      const conns = String(data.connections).padStart(11);
      const ips = String(data.uniqueIPs).padStart(12);
      const ports = String(data.uniquePorts).padStart(13);
      
      let displayApp = appName;
      if (data.connections > 10) {
        displayApp = chalk.yellow(appName);
      }
      if (app === 'unknown') {
        displayApp = chalk.gray(appName);
      }
      
      console.log(`│ ${displayApp} │ ${conns} │ ${ips} │ ${ports} │`);
    }
    
    console.log('└──────────┴────────────┴─────────────┴──────────────┘');
    
    // Alerts for suspicious activity
    for (const [app, data] of sortedApps) {
      if (data.connections > 20) {
        console.log(chalk.yellow(`\n⚠️  ALERT: ${app} has ${data.connections} connections! Possible background activity.\n`));
      }
      if (data.uniqueIPs > 15) {
        console.log(chalk.yellow(`⚠️  ALERT: ${app} is talking to ${data.uniqueIPs} different servers!\n`));
      }
    }
  }
  
  updateStats(stats, connections, appStats) {
    console.clear();
    
    this.totalDownload += stats.downloadSpeed * 2;
    this.totalUpload += stats.uploadSpeed * 2;
    
    this.downloadHistory.push(stats.downloadSpeed);
    this.uploadHistory.push(stats.uploadSpeed);
    
    if (this.downloadHistory.length > 40) this.downloadHistory.shift();
    if (this.uploadHistory.length > 40) this.uploadHistory.shift();
    
    // Header
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan(`║  ⚡ NETPULSE — Your network heartbeat                    Uptime: ${this.getUptime().padEnd(10)}║`));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n'));
    
    // Download graph
    console.log(chalk.green('📥 DOWNLOAD SPEED'));
    console.log(asciichart.plot(this.downloadHistory, { height: 6, colors: [asciichart.green] }));
    console.log(`   └─ Current: ${chalk.green(this.formatSpeed(stats.downloadSpeed))}\n`);
    
    // Upload graph
    console.log(chalk.red('📤 UPLOAD SPEED'));
    console.log(asciichart.plot(this.uploadHistory, { height: 6, colors: [asciichart.red] }));
    console.log(`   └─ Current: ${chalk.red(this.formatSpeed(stats.uploadSpeed))}\n`);
    
    // Stats summary
    const avgDown = this.downloadHistory.reduce((a,b) => a+b, 0) / this.downloadHistory.length;
    const avgUp = this.uploadHistory.reduce((a,b) => a+b, 0) / this.uploadHistory.length;
    
    console.log(chalk.yellow('📊 STATISTICS'));
    console.log(`   ├─ Avg Speed:  ↓ ${this.formatSpeed(avgDown)}  ↑ ${this.formatSpeed(avgUp)}`);
    console.log(`   ├─ Total Data: ↓ ${chalk.green(this.formatBytes(this.totalDownload))}  ↑ ${chalk.red(this.formatBytes(this.totalUpload))}`);
    console.log(`   └─ Connections: ${chalk.cyan(connections.length)} active\n`);
    
    if (connections.length > 50) {
      console.log(chalk.yellow('⚠️  High number of connections! Check for background activity.\n'));
    }
    
    // Connections table
    console.log(chalk.cyan('🔗 ACTIVE CONNECTIONS'));
    console.log('┌──────┬────────────────────────┬────────────────────────────┬──────────┐');
    console.log('│ PROC │ LOCAL                  │ REMOTE                     │ STATUS   │');
    console.log('├──────┼────────────────────────┼────────────────────────────┼──────────┤');
    
    const displayConns = connections.slice(0, 10);
    for (const conn of displayConns) {
      let proc = (conn.process || '?').slice(0, 5).padEnd(5);
      let local = (conn.local || '').slice(0, 22).padEnd(22);
      let remote = (conn.remote || '').slice(0, 26).padEnd(26);
      let status = (conn.state || 'ESTAB').slice(0, 9).padEnd(9);
      
      if (this.isSuspicious(conn.remote) && conn.remote !== '0.0.0.0:*') {
        remote = chalk.red(remote);
      }
      
      console.log(`│ ${proc} │ ${local} │ ${remote} │ ${status} │`);
    }
    
    console.log('└──────┴────────────────────────┴────────────────────────────┴──────────┘');
    
    if (connections.length > 10) {
      console.log(`\n   ${chalk.dim(`... and ${connections.length - 10} more connections`)}`);
    }
    
    // App breakdown
    console.log('');
    this.displayAppBreakdown(appStats);
    
    // Tips
    const tips = [
      `💡 Press ${chalk.bold('Ctrl+C')} to exit`,
      `🔥 Run ${chalk.bold('netpulse scan')} to find open ports`,
      `🌍 Set ${chalk.bold('GEOIP_API_KEY')} for location data`,
      `🔍 Suspicious IPs marked in ${chalk.red('red')} are public addresses`,
      `📱 Check APP BREAKDOWN to see which apps are most active`,
      `⚠️  Apps with >20 connections might be suspicious`
    ];
    console.log(`\n${tips[Math.floor(Math.random() * tips.length)]}\n`);
  }
  
  showError(error) {
    console.clear();
    console.log(chalk.red('╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.red('║  ❌ NETPULSE ERROR                                                      ║'));
    console.log(chalk.red('╚════════════════════════════════════════════════════════════════════════════╝\n'));
    console.log(`🔴 ${error.message}\n`);
    
    if (error.message.includes('permission') || error.message.includes('EACCES')) {
      console.log(chalk.yellow('💡 Solution: Run with sudo'));
      console.log(`   ${chalk.cyan('sudo netpulse')}\n`);
    } else if (error.message.includes('command not found')) {
      console.log(chalk.yellow('💡 Solution: Install globally first'));
      console.log(`   ${chalk.cyan('npm install -g netpulse-cli')}\n`);
    }
    
    console.log(chalk.dim('📚 Documentation: https://github.com/ramansingh/netpulse-cli\n'));
  }
}

module.exports = { TerminalUI };