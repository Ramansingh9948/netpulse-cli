#!/usr/bin/env node

const { execSync } = require('child_process');
const dns   = require('dns').promises;
const chalk = require('chalk');
const os    = require('os');

// ─── Full OUI Manufacturer DB ──────────────────────────────────────────────
const OUI_DB = {
  // Apple
  'AC:84:C6': 'Apple','B8:09:8A': 'Apple','F4:5C:89': 'Apple',
  'C8:3A:35': 'Apple','34:12:98': 'Apple','9C:F3:87': 'Apple',
  '14:10:9F': 'Apple','10:9A:DD': 'Apple','8C:85:90': 'Apple',
  'A8:BE:27': 'Apple','00:17:F2': 'Apple','F0:18:98': 'Apple',
  '3C:06:30': 'Apple','D0:03:4B': 'Apple','F8:FF:C2': 'Apple',
  'BC:92:6B': 'Apple','60:F8:1D': 'Apple','A4:83:E7': 'Apple',
  '18:65:90': 'Apple','70:73:CB': 'Apple','98:01:A7': 'Apple',
  '04:52:F3': 'Apple','7C:D1:C3': 'Apple','20:AB:37': 'Apple',
  'DC:2B:2A': 'Apple','34:C0:59': 'Apple','84:38:35': 'Apple',
  // Samsung
  '70:56:81': 'Samsung','8C:77:12': 'Samsung','C4:42:02': 'Samsung',
  '00:26:37': 'Samsung','34:AA:8B': 'Samsung','F4:42:8F': 'Samsung',
  'B0:72:BF': 'Samsung','CC:07:AB': 'Samsung','E8:03:9A': 'Samsung',
  '78:59:5E': 'Samsung','50:01:BB': 'Samsung','D0:22:BE': 'Samsung',
  // Xiaomi
  'D0:53:49': 'Xiaomi','54:EE:75': 'Xiaomi','AC:C1:EE': 'Xiaomi',
  'F8:A2:D6': 'Xiaomi','00:9E:C8': 'Xiaomi','28:6C:07': 'Xiaomi',
  '64:09:80': 'Xiaomi','34:CE:00': 'Xiaomi','FC:64:BA': 'Xiaomi',
  // OnePlus
  'D4:61:9D': 'OnePlus','94:65:2D': 'OnePlus','AC:B5:7D': 'OnePlus',
  // Google
  'A4:C3:6B': 'Google','F4:F5:D8': 'Google','54:60:09': 'Google',
  '3C:28:6D': 'Google','48:D6:D5': 'Google','1C:F2:9A': 'Google',
  // Huawei
  'FC:F5:C4': 'Huawei','00:18:82': 'Huawei','28:6E:D4': 'Huawei',
  '40:CB:A8': 'Huawei','58:2A:F7': 'Huawei','70:72:3C': 'Huawei',
  // TP-Link
  '50:2B:73': 'TP-Link','54:AF:97': 'TP-Link','F4:F2:6D': 'TP-Link',
  'C0:25:E9': 'TP-Link','18:A6:F7': 'TP-Link','B0:48:7A': 'TP-Link',
  'EC:08:6B': 'TP-Link','84:16:F9': 'TP-Link',
  // Netgear
  'CC:2D:21': 'Netgear','A0:04:60': 'Netgear','20:E5:2A': 'Netgear',
  'C4:04:15': 'Netgear','9C:D3:6D': 'Netgear',
  // D-Link
  '00:1A:A9': 'D-Link','1C:7E:E5': 'D-Link','B8:A3:86': 'D-Link',
  'C8:BE:19': 'D-Link','34:08:04': 'D-Link',
  // Intel (laptops)
  '3C:2E:F9': 'Intel','8C:8D:28': 'Intel','00:1B:21': 'Intel',
  'A4:C3:F0': 'Intel','8C:EC:4B': 'Intel','10:02:B5': 'Intel',
  '00:21:6A': 'Intel','E8:6A:64': 'Intel',
  // Realtek
  '00:E0:4C': 'Realtek','48:2C:6A': 'Realtek',
  // Dell
  '00:11:22': 'Dell','F8:DB:88': 'Dell','18:03:73': 'Dell',
  'B8:CA:3A': 'Dell','F0:1F:AF': 'Dell','14:18:77': 'Dell',
  // HP
  '3C:D9:2B': 'HP','B4:99:BA': 'HP','F0:92:1C': 'HP',
  '10:60:4B': 'HP','A0:B3:CC': 'HP',
  // Lenovo
  '54:05:DB': 'Lenovo','28:D2:44': 'Lenovo','E8:6A:64': 'Lenovo',
  '00:23:14': 'Lenovo','18:2D:E2': 'Lenovo',
  // Raspberry Pi
  'B8:27:EB': 'Raspberry Pi','DC:A6:32': 'Raspberry Pi','E4:5F:01': 'Raspberry Pi',
  // Cisco
  '00:1A:A1': 'Cisco','58:97:BD': 'Cisco','EC:BD:1D': 'Cisco',
  // Sony
  '00:13:A9': 'Sony','30:17:C8': 'Sony','AC:9B:0A': 'Sony',
  'FC:0F:E6': 'Sony',
  // LG
  'C8:08:E9': 'LG','A8:16:B2': 'LG','78:5D:C8': 'LG',
  // Nintendo
  '00:09:BF': 'Nintendo','98:B6:E9': 'Nintendo','XC:77:A5': 'Nintendo',
  // Amazon (Echo, Fire)
  '44:65:0D': 'Amazon Echo','74:C2:46': 'Amazon','B4:7C:9C': 'Amazon Echo',
  'A4:08:F5': 'Amazon','0C:47:C9': 'Amazon Echo',
  // VMware / VirtualBox
  '00:0C:29': 'VMware','00:50:56': 'VMware','08:00:27': 'VirtualBox',
  // Bosch / Smart Home
  '00:0E:8F': 'Bosch','AC:89:95': 'Bosch',
  // Synology NAS
  '00:11:32': 'Synology',
  // QNAP NAS
  '24:5E:BE': 'QNAP',
  // Philips Hue
  'EC:B5:FA': 'Philips Hue','00:17:88': 'Philips Hue',
};

// ─── Device type fingerprint from ports ───────────────────────────────────
const PORT_FINGERPRINTS = [
  { port: 548,  type: 'Mac (AFP)',         emoji: '🍎', os: 'macOS'   },
  { port: 5353, type: 'mDNS Device',       emoji: '📡', os: 'Apple'   },
  { port: 62078,type: 'iPhone/iPad',       emoji: '📱', os: 'iOS'     },
  { port: 445,  type: 'Windows PC',        emoji: '🪟', os: 'Windows' },
  { port: 139,  type: 'Windows (SMB)',     emoji: '🪟', os: 'Windows' },
  { port: 3389, type: 'Windows (RDP)',     emoji: '🪟', os: 'Windows' },
  { port: 22,   type: 'Linux/SSH Server',  emoji: '🐧', os: 'Linux'   },
  { port: 631,  type: 'Printer',           emoji: '🖨️', os: null      },
  { port: 9100, type: 'Printer (RAW)',     emoji: '🖨️', os: null      },
  { port: 8200, type: 'Printer',           emoji: '🖨️', os: null      },
  { port: 8009, type: 'Chromecast',        emoji: '📺', os: 'ChromeOS'},
  { port: 8008, type: 'Chromecast',        emoji: '📺', os: 'ChromeOS'},
  { port: 1400, type: 'Sonos Speaker',     emoji: '🔊', os: null      },
  { port: 3306, type: 'MySQL Server',      emoji: '🗄️', os: 'Linux'   },
  { port: 27017,type: 'MongoDB Server',    emoji: '🗄️', os: null      },
  { port: 6379, type: 'Redis Server',      emoji: '🗄️', os: null      },
  { port: 80,   type: 'Web Server',        emoji: '🌐', os: null      },
  { port: 443,  type: 'HTTPS Server',      emoji: '🔒', os: null      },
  { port: 8080, type: 'Web/Dev Server',    emoji: '🌐', os: null      },
  { port: 53,   type: 'DNS Server',        emoji: '🔍', os: null      },
  { port: 5000, type: 'Dev Server',        emoji: '⚙️',  os: null      },
  { port: 32400,type: 'Plex Media Server', emoji: '📽️', os: null      },
  { port: 7000, type: 'AirPlay',           emoji: '🍎', os: 'macOS'   },
  { port: 554,  type: 'IP Camera (RTSP)',  emoji: '📸', os: null      },
  { port: 2323, type: 'IoT/Smart Device',  emoji: '🔌', os: null      },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function getLocalIP() {
  try {
    if (os.platform() === 'darwin')
      return execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    return execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
  } catch (e) { return null; }
}

function getGateway() {
  try {
    if (os.platform() === 'darwin') {
      const o = execSync('netstat -rn | grep default', { encoding: 'utf8' });
      return o.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
    }
    const o = execSync("ip route | grep default", { encoding: 'utf8' });
    return o.match(/via (\d+\.\d+\.\d+\.\d+)/)?.[1];
  } catch (e) { return null; }
}

function getArpTable() {
  const map = new Map();
  try {
    const out = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
    for (const line of out.split('\n')) {
      const m = line.match(/(\d+\.\d+\.\d+\.\d+).*?([a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2})/i);
      if (m) map.set(m[1], m[2].toUpperCase().replace(/-/g, ':'));
    }
  } catch (e) {}
  return map;
}

function getManufacturer(mac) {
  if (!mac) return null;
  const norm = mac.toUpperCase();
  // Try 8-char prefix first (XX:XX:XX), then 6-char (XXXXXX)
  for (const [oui, name] of Object.entries(OUI_DB)) {
    if (norm.startsWith(oui)) return name;
  }
  return null;
}

function isAlive(ip) {
  try {
    const flag = os.platform() === 'darwin' ? '-t' : '-W';
    execSync(`ping -c 1 ${flag} 1 ${ip}`, { stdio: 'ignore', timeout: 1500 });
    return true;
  } catch (e) { return false; }
}

// ─── Reverse DNS lookup ────────────────────────────────────────────────────
async function reverseDNS(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames[0] || null;
  } catch (e) { return null; }
}

// ─── mDNS hostname lookup (macOS: dns-sd, Linux: avahi) ───────────────────
function getMDNSName(ip) {
  try {
    if (os.platform() === 'darwin') {
      const out = execSync(`dns-sd -G v4 ${ip} 2>/dev/null || true`, {
        encoding: 'utf8', timeout: 2000
      });
      const m = out.match(/([a-zA-Z0-9_-]+\.local)/);
      return m ? m[1] : null;
    } else {
      const out = execSync(`avahi-resolve -a ${ip} 2>/dev/null`, {
        encoding: 'utf8', timeout: 2000
      });
      const m = out.match(/\s+(\S+\.local)/);
      return m ? m[1] : null;
    }
  } catch (e) { return null; }
}

// ─── NetBIOS name (Windows devices) ───────────────────────────────────────
function getNetBIOSName(ip) {
  try {
    // nmblookup on Linux, nbtscan or nmap on mac
    const out = execSync(`nbtscan -r ${ip} 2>/dev/null || nmblookup -A ${ip} 2>/dev/null`, {
      encoding: 'utf8', timeout: 2000
    });
    const m = out.match(/([A-Z0-9_-]{1,15})\s+<00>/i);
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}

// ─── Port scan to fingerprint device ──────────────────────────────────────
function detectDeviceType(ip, manufacturer) {
  // Manufacturer-based quick detection
  if (manufacturer) {
    const m = manufacturer.toLowerCase();
    if (m === 'apple')         return { type: 'Apple Device',   emoji: '🍎', os: 'Apple'   };
    if (m === 'samsung')       return { type: 'Samsung Device', emoji: '📱', os: 'Android' };
    if (m === 'xiaomi')        return { type: 'Xiaomi Device',  emoji: '📱', os: 'Android' };
    if (m === 'oneplus')       return { type: 'OnePlus Device', emoji: '📱', os: 'Android' };
    if (m === 'google')        return { type: 'Google Device',  emoji: '🤖', os: 'Android' };
    if (m === 'raspberry pi')  return { type: 'Raspberry Pi',   emoji: '🥧', os: 'Linux'   };
    if (m === 'amazon echo')   return { type: 'Amazon Echo',    emoji: '🔊', os: 'Amazon'  };
    if (m === 'synology')      return { type: 'Synology NAS',   emoji: '🗄️',  os: 'DSM'    };
    if (m === 'qnap')          return { type: 'QNAP NAS',       emoji: '🗄️',  os: 'QTS'    };
    if (m === 'philips hue')   return { type: 'Philips Hue Hub',emoji: '💡', os: null      };
    if (['tp-link','netgear','d-link','cisco','asus'].includes(m))
      return { type: 'Router/AP',       emoji: '📡', os: null };
  }

  // Port-based fingerprint
  for (const fp of PORT_FINGERPRINTS) {
    try {
      execSync(`nc -z -w 1 ${ip} ${fp.port} 2>/dev/null`, { timeout: 600, stdio: 'ignore' });
      return { type: fp.type, emoji: fp.emoji, os: fp.os };
    } catch (e) {}
  }

  return { type: 'Unknown Device', emoji: '❓', os: null };
}

function getPingTime(ip) {
  try {
    const flag = os.platform() === 'darwin' ? '-t' : '-W';
    const out = execSync(`ping -c 1 ${flag} 1 ${ip}`, { encoding: 'utf8', timeout: 2000 });
    const m   = out.match(/time=(\d+\.?\d*)/);
    return m ? parseFloat(m[1]) : null;
  } catch (e) { return null; }
}

function activityLabel(ms) {
  if (ms === null)  return { label: '😴 Offline', color: 'dim'    };
  if (ms < 5)       return { label: '🔥 High',    color: 'red'    };
  if (ms < 20)      return { label: '🟢 Active',  color: 'green'  };
  if (ms < 100)     return { label: '🟡 Low',     color: 'yellow' };
  return              { label: '🐢 Slow',    color: 'yellow' };
}

// ─── Build friendly device name ───────────────────────────────────────────
function buildDeviceName(opts) {
  const { manufacturer, mdns, netbios, rdns, type, isLocal, isRouter, localHostname } = opts;

  // YOU
  if (isLocal) {
    return localHostname
      ? `${localHostname} ← YOU`
      : `${manufacturer || 'Your Device'} ← YOU`;
  }

  // Router
  if (isRouter) return 'Router / Gateway';

  // mDNS is most reliable for Apple/local devices
  if (mdns) {
    const clean = mdns.replace('.local', '').replace(/-/g, ' ');
    return clean;
  }

  // NetBIOS for Windows
  if (netbios) return netbios;

  // Reverse DNS (strip long TLDs)
  if (rdns) {
    const parts = rdns.split('.');
    // If it looks like a hostname (not a reverse PTR like 1.168.192.in-addr.arpa)
    if (!rdns.includes('in-addr.arpa') && !rdns.includes('ip6.arpa')) {
      return parts.slice(0, 2).join('.');
    }
  }

  // Manufacturer + type
  if (manufacturer && type !== 'Unknown Device') return `${manufacturer} ${type}`;
  if (manufacturer) return manufacturer + ' Device';
  if (type !== 'Unknown Device') return type;

  return 'Unknown Device';
}

function getLocalHostname() {
  try { return os.hostname(); } catch (e) { return null; }
}

// ─── Main scan ─────────────────────────────────────────────────────────────
async function scanDevices(live = false) {
  const localIP   = getLocalIP();
  const gateway   = getGateway();
  const localhost  = getLocalHostname();

  if (!localIP) {
    console.log(chalk.red('❌ Could not detect your IP. Are you connected to WiFi?'));
    process.exit(1);
  }

  const subnet  = localIP.split('.').slice(0, 3).join('.');
  const devices = [];

  console.clear();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  📡 NETPULSE DEVICE SCANNER                                                       ║`));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.yellow(`🌐 Your IP   : ${localIP}  (${localhost || 'unknown hostname'})`));
  console.log(chalk.yellow(`🔀 Gateway   : ${gateway || 'Unknown'}`));
  console.log(chalk.yellow(`🔍 Scanning  : ${subnet}.0/24`));
  console.log(chalk.dim(`⏳ Scanning all 254 hosts...\n`));

  const arpTable = getArpTable();

  for (let i = 1; i <= 254; i++) {
    const target = `${subnet}.${i}`;
    process.stdout.write(chalk.dim(`\r   Scanning ${target}...`));
    if (!isAlive(target)) continue;

    const mac          = arpTable.get(target) || null;
    const manufacturer = getManufacturer(mac);
    const { type, emoji, os: devOS } = detectDeviceType(target, manufacturer);
    const pingMs       = getPingTime(target);
    const activity     = activityLabel(pingMs);
    const isLocal      = target === localIP;
    const isRouter     = target === gateway;

    // Async name resolution
    const [rdns, mdns] = await Promise.all([
      reverseDNS(target),
      isLocal ? Promise.resolve(null) : Promise.resolve(getMDNSName(target)),
    ]);
    const netbios = (!isLocal && !isRouter) ? getNetBIOSName(target) : null;

    const name = buildDeviceName({
      manufacturer, mdns, netbios, rdns, type,
      isLocal, isRouter, localHostname: localhost,
    });

    devices.push({
      ip: target, mac: mac || 'Unknown', manufacturer: manufacturer || 'Unknown',
      type: isRouter ? 'Router/Gateway' : type,
      emoji: isRouter ? '📡' : emoji,
      os: devOS, name, activity, pingMs,
      isLocal, isRouter, mdns, netbios, rdns,
    });
  }

  // ── Display ──────────────────────────────────────────────────────────────
  console.clear();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  📡 NETPULSE — DEVICE MONITOR                        Found: ${String(devices.length).padEnd(3)} devices          ║`));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.yellow(`🌐 Your IP: ${localIP}   🔀 Gateway: ${gateway || 'Unknown'}   🔍 Subnet: ${subnet}.0/24\n`));

  console.log('┌─────────────────┬──────────────────────────────┬────────────────┬──────────────────────┬─────────────┐');
  console.log('│ IP ADDRESS      │ DEVICE NAME                  │ TYPE           │ MANUFACTURER / MAC   │ PING        │');
  console.log('├─────────────────┼──────────────────────────────┼────────────────┼──────────────────────┼─────────────┤');

  for (const d of devices) {
    const ip    = d.ip.padEnd(15);
    const name  = (d.name).slice(0, 28).padEnd(28);
    const type  = `${d.emoji} ${d.type}`.slice(0, 14).padEnd(14);
    const mfr   = `${d.manufacturer} / ${d.mac.slice(0, 8)}`.slice(0, 20).padEnd(20);
    const ping  = (d.pingMs !== null ? `${d.pingMs.toFixed(1)}ms` : 'timeout').padEnd(11);

    let ipCol = ip;
    if (d.isLocal)  ipCol = chalk.green(ip);
    else if (d.isRouter) ipCol = chalk.cyan(ip);
    else if (d.type === 'Unknown Device') ipCol = chalk.red(ip);

    let nameCol = name;
    if (d.isLocal)  nameCol = chalk.green.bold(name);
    else if (d.isRouter) nameCol = chalk.cyan.bold(name);
    else if (d.name === 'Unknown Device') nameCol = chalk.red(name);

    console.log(`│ ${ipCol} │ ${nameCol} │ ${type} │ ${mfr} │ ${ping} │`);

    // Sub-row: extra info if available
    if (d.mdns || d.rdns || d.netbios || d.os) {
      const extras = [];
      if (d.mdns)    extras.push(`mDNS: ${d.mdns}`);
      if (d.netbios) extras.push(`NetBIOS: ${d.netbios}`);
      if (d.rdns && !d.rdns.includes('in-addr.arpa')) extras.push(`DNS: ${d.rdns}`);
      if (d.os)      extras.push(`OS: ${d.os}`);
      if (extras.length) {
        const sub = extras.join('  │  ').slice(0, 74).padEnd(74);
        console.log(`│                 │ ${chalk.dim(sub)} │`);
      }
    }
  }

  console.log('└─────────────────┴──────────────────────────────┴────────────────┴──────────────────────┴─────────────┘');

  // ── Alerts ───────────────────────────────────────────────────────────────
  const unknown = devices.filter(d => d.name === 'Unknown Device' && !d.isLocal && !d.isRouter);
  if (unknown.length > 0) {
    console.log(chalk.red(`\n⚠️  ALERT: ${unknown.length} fully unidentified device(s)!`));
    unknown.forEach(d => {
      console.log(chalk.red(`   → ${d.ip}   MAC: ${d.mac}   Ping: ${d.pingMs?.toFixed(1) || '?'}ms`));
    });
    console.log(chalk.yellow(`\n💡 Run: sudo netpulse spy --device <ip> to see their traffic\n`));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const named   = devices.filter(d => d.name !== 'Unknown Device').length;
  const appleD  = devices.filter(d => d.manufacturer === 'Apple').length;
  const androidD= devices.filter(d => ['Samsung','Xiaomi','OnePlus','Google'].includes(d.manufacturer)).length;
  const winD    = devices.filter(d => d.os === 'Windows').length;
  const linuxD  = devices.filter(d => d.os === 'Linux').length;

  console.log(chalk.green(`\n📊 SUMMARY`));
  console.log(`   ├─ Total Devices  : ${chalk.bold(devices.length)}`);
  console.log(`   ├─ Named/IDed     : ${chalk.green(named)}`);
  console.log(`   ├─ Unknown        : ${chalk.red(unknown.length)}`);
  console.log(`   ├─ Apple          : ${chalk.white(appleD)}`);
  console.log(`   ├─ Android        : ${chalk.white(androidD)}`);
  console.log(`   ├─ Windows        : ${chalk.white(winD)}`);
  console.log(`   ├─ Linux          : ${chalk.white(linuxD)}`);
  console.log(`   └─ Your Device    : ${chalk.cyan(localIP)} (${localhost || '?'})`);

  console.log(chalk.dim(`\n💡 Run 'sudo netpulse spy --device <ip>' to monitor any device's traffic`));
  console.log(chalk.dim(`💡 Run 'sudo netpulse dns' to monitor DNS queries on your network\n`));

  if (live) {
    console.log(chalk.yellow(`\n🔄 Live mode — rescanning in 30s... (Ctrl+C to stop)\n`));
    setTimeout(() => scanDevices(true), 30000);
  }
}

module.exports = { scanDevices };