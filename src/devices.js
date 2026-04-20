#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const os = require('os');

// Get local IP based on platform
function getLocalIP() {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      return execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    } else if (platform === 'linux') {
      return execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
    } else if (platform === 'win32') {
      const output = execSync('ipconfig', { encoding: 'utf8' });
      const match = output.match(/IPv4.*?:\s*([\d.]+)/);
      return match ? match[1] : null;
    }
  } catch (e) {}
  return null;
}

// Get gateway IP
function getGateway() {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const output = execSync('netstat -rn | grep default', { encoding: 'utf8' });
      return output.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
    } else if (platform === 'linux') {
      const output = execSync("ip route | grep default", { encoding: 'utf8' });
      return output.match(/via (\d+\.\d+\.\d+\.\d+)/)?.[1];
    } else if (platform === 'win32') {
      const output = execSync('ipconfig', { encoding: 'utf8' });
      return output.match(/Default Gateway.*?:\s*([\d.]+)/)?.[1];
    }
  } catch (e) {}
  return null;
}

// Get ARP table
function getArpTable() {
  const arpMap = new Map();
  try {
    const arpOutput = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
    for (const line of arpOutput.split('\n')) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+).*?([a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2})/i);
      if (match) {
        arpMap.set(match[1], match[2].toUpperCase().replace(/-/g, ':'));
      }
    }
  } catch (e) {}
  return arpMap;
}

// Identify manufacturer from MAC
function getManufacturer(mac) {
  if (!mac) return null;
  const manufacturers = {
    'AC:84:C6': 'Apple', 'B8:09:8A': 'Apple', 'F4:5C:89': 'Apple',
    'C8:3A:35': 'Apple', '34:12:98': 'Apple', '9C:F3:87': 'Apple',
    '14:10:9F': 'Apple', '10:9A:DD': 'Apple', '8C:85:90': 'Apple',
    'A8:BE:27': 'Apple', '00:17:F2': 'Apple', 'F0:18:98': 'Apple',
    '70:56:81': 'Samsung', 'D0:53:49': 'Xiaomi', 'A4:C3:6B': 'Google',
    '50:2B:73': 'TP-Link', 'CC:2D:21': 'Netgear', '00:1A:A9': 'D-Link',
    '3C:2E:F9': 'Intel', '00:0C:29': 'VMware', '08:00:27': 'VirtualBox',
    '00:11:22': 'Dell', 'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
    '00:50:56': 'VMware', '00:1B:21': 'Intel', '48:2C:6A': 'Realtek',
    'D4:61:9D': 'OnePlus', '94:65:2D': 'OnePlus', '00:E0:4C': 'Realtek',
    'FC:F5:C4': 'Huawei', '00:18:82': 'Huawei', '28:6E:D4': 'Huawei',
    '54:EE:75': 'Xiaomi', 'AC:C1:EE': 'Xiaomi', 'F8:A2:D6': 'Xiaomi'
  };
  const prefix = mac.slice(0, 8);
  for (const [oui, name] of Object.entries(manufacturers)) {
    if (prefix.startsWith(oui)) return name;
  }
  return null;
}

// Check if device is active (ping)
function isAlive(ip) {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      execSync(`ping -n 1 -w 500 ${ip}`, { stdio: 'ignore', timeout: 1000 });
    } else {
      execSync(`ping -c 1 -W 1 ${ip} > /dev/null 2>&1`, { stdio: 'ignore', timeout: 1500 });
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Detect open ports and guess device type
function detectDeviceType(ip, manufacturer) {
  if (manufacturer) {
    if (manufacturer === 'Apple') return { type: 'Apple Device', emoji: '🍎' };
    if (manufacturer === 'Samsung') return { type: 'Samsung Device', emoji: '📱' };
    if (manufacturer === 'Xiaomi') return { type: 'Xiaomi Device', emoji: '📱' };
    if (manufacturer === 'Raspberry Pi') return { type: 'Raspberry Pi', emoji: '🥧' };
    if (manufacturer === 'TP-Link' || manufacturer === 'Netgear' || manufacturer === 'D-Link') {
      return { type: 'Network Device', emoji: '📡' };
    }
  }

  const portChecks = [
    { port: 22, type: 'Linux/SSH Server', emoji: '🐧' },
    { port: 631, type: 'Printer', emoji: '🖨️' },
    { port: 8200, type: 'Printer', emoji: '🖨️' },
    { port: 548, type: 'Mac (File Share)', emoji: '🍎' },
    { port: 445, type: 'Windows PC', emoji: '🪟' },
    { port: 3306, type: 'Database Server', emoji: '🗄️' },
    { port: 27017, type: 'MongoDB Server', emoji: '🗄️' },
    { port: 80, type: 'Web Server', emoji: '🌐' },
    { port: 443, type: 'HTTPS Server', emoji: '🔒' },
    { port: 8080, type: 'Web Server', emoji: '🌐' },
    { port: 53, type: 'DNS Server', emoji: '🔍' },
  ];

  for (const { port, type, emoji } of portChecks) {
    try {
      execSync(`nc -z -w 1 ${ip} ${port} 2>/dev/null`, { timeout: 500, stdio: 'ignore' });
      return { type, emoji };
    } catch (e) {}
  }

  return { type: 'Unknown Device', emoji: '❓' };
}

// Estimate activity level based on ping response time
function getActivityLevel(ip) {
  try {
    const platform = os.platform();
    let output;
    if (platform === 'win32') {
      output = execSync(`ping -n 1 ${ip}`, { encoding: 'utf8', timeout: 2000 });
      const match = output.match(/Average = (\d+)ms/);
      const ms = match ? parseInt(match[1]) : 999;
      if (ms < 5) return { level: '🔥 High', color: 'red' };
      if (ms < 20) return { level: '🟢 Active', color: 'green' };
      if (ms < 100) return { level: '🟡 Low', color: 'yellow' };
    } else {
      output = execSync(`ping -c 1 ${ip}`, { encoding: 'utf8', timeout: 2000 });
      const match = output.match(/time=(\d+\.?\d*)/);
      const ms = match ? parseFloat(match[1]) : 999;
      if (ms < 5) return { level: '🔥 High', color: 'red' };
      if (ms < 20) return { level: '🟢 Active', color: 'green' };
      if (ms < 100) return { level: '🟡 Low', color: 'yellow' };
    }
  } catch (e) {}
  return { level: '😴 Idle', color: 'gray' };
}

// Main scan function
async function scanDevices(live = false) {
  const localIP = getLocalIP();
  const gateway = getGateway();

  if (!localIP) {
    console.log(chalk.red('❌ Could not detect your IP. Are you connected to WiFi?'));
    process.exit(1);
  }

  const subnet = localIP.split('.').slice(0, 3).join('.');
  const devices = [];

  console.clear();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  📡 NETPULSE DEVICE SCANNER                                               ║`));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.yellow(`🌐 Your IP:   ${localIP}`));
  console.log(chalk.yellow(`🔀 Gateway:   ${gateway || 'Unknown'}`));
  console.log(chalk.yellow(`🔍 Scanning:  ${subnet}.0/24`));
  console.log(chalk.dim(`⏳ This may take 30-60 seconds...\n`));

  const arpTable = getArpTable();

  // Scan all IPs in subnet
  for (let i = 1; i <= 254; i++) {
    const target = `${subnet}.${i}`;

    process.stdout.write(chalk.dim(`\r   Scanning ${target}...`));

    if (!isAlive(target)) continue;

    const mac = arpTable.get(target);
    const manufacturer = getManufacturer(mac);
    const { type, emoji } = detectDeviceType(target, manufacturer);
    const activity = getActivityLevel(target);

    const isLocal = target === localIP;
    const isRouter = target === gateway;

    devices.push({
      ip: target,
      mac: mac || 'Unknown',
      manufacturer: manufacturer || 'Unknown',
      type: isRouter ? 'Router/Gateway' : type,
      emoji: isRouter ? '📡' : emoji,
      activity,
      isLocal,
      isRouter
    });
  }

  // Display results
  console.clear();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  📡 NETPULSE — DEVICE MONITOR                   Found: ${String(devices.length).padEnd(3)} devices      ║`));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.yellow(`🌐 Your IP: ${localIP}   🔀 Gateway: ${gateway || 'Unknown'}   🔍 Subnet: ${subnet}.0/24\n`));

  // Table header
  console.log('┌─────────────────┬────────────────────┬─────────────────────┬─────────────┬──────────────┐');
  console.log('│ IP ADDRESS      │ DEVICE TYPE        │ MANUFACTURER        │ MAC         │ ACTIVITY     │');
  console.log('├─────────────────┼────────────────────┼─────────────────────┼─────────────┼──────────────┤');

  for (const device of devices) {
    const ip = device.ip.padEnd(15);
    const type = `${device.emoji} ${device.isLocal ? 'YOU — ' : ''}${device.isRouter ? 'Router' : device.type}`.slice(0, 18).padEnd(18);
    const manufacturer = device.manufacturer.slice(0, 19).padEnd(19);
    const mac = (device.mac || 'Unknown').slice(0, 11).padEnd(11);
    const activity = device.activity.level.slice(0, 12).padEnd(12);

    let ipDisplay = ip;
    if (device.isLocal) ipDisplay = chalk.green(ip);
    else if (device.isRouter) ipDisplay = chalk.cyan(ip);
    else if (device.type === 'Unknown Device') ipDisplay = chalk.red(ip);

    console.log(`│ ${ipDisplay} │ ${type} │ ${manufacturer} │ ${mac} │ ${activity} │`);
  }

  console.log('└─────────────────┴────────────────────┴─────────────────────┴─────────────┴──────────────┘');

  // Alerts
  const unknownDevices = devices.filter(d => d.type === 'Unknown Device' && !d.isLocal && !d.isRouter);
  if (unknownDevices.length > 0) {
    console.log(chalk.red(`\n⚠️  ALERT: ${unknownDevices.length} unknown device(s) found on your network!`));
    unknownDevices.forEach(d => {
      console.log(chalk.red(`   → ${d.ip}  MAC: ${d.mac}`));
    });
    console.log(chalk.yellow(`\n💡 Run: netpulse spy --device <ip> to investigate\n`));
  }

  // Summary
  console.log(chalk.green(`\n📊 SUMMARY`));
  console.log(`   ├─ Total Devices:    ${chalk.bold(devices.length)}`);
  console.log(`   ├─ Known Devices:    ${chalk.green(devices.filter(d => d.manufacturer !== 'Unknown').length)}`);
  console.log(`   ├─ Unknown Devices:  ${chalk.red(unknownDevices.length)}`);
  console.log(`   └─ Your Device:      ${chalk.cyan(localIP)}`);

  console.log(chalk.dim(`\n💡 Run 'netpulse spy --device <ip>' to deep scan any device`));
  console.log(chalk.dim(`💡 Run 'netpulse dns' to monitor DNS queries on your network\n`));

  // Live mode — rescan every 30s
  if (live) {
    console.log(chalk.yellow(`\n🔄 Live mode ON — rescanning every 30 seconds... (Ctrl+C to stop)\n`));
    setTimeout(() => scanDevices(true), 30000);
  }
}

module.exports = { scanDevices };