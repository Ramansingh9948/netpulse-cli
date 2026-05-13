#!/usr/bin/env node

/**
 * NetPulse Boss Mode
 * Full network visibility: who is connected + what they're doing
 *
 * Usage:
 *   netpulse boss                    — scan all devices with names
 *   netpulse boss --watch            — live refresh every 30s
 *   netpulse boss --spy <ip>         — traffic monitor for one device
 *   netpulse boss --spy all          — traffic monitor ALL devices (sudo)
 */

const { execSync, exec, spawn } = require('child_process');
const dns   = require('dns').promises;
const chalk = require('chalk');
const os    = require('os');
const fs    = require('fs');

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// boss.js mein getArpTable() replace karo:
function getArpTable() {
  const map = new Map();
  
  // Primary: standard arp -a
  try {
    const out = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
    for (const line of out.split('\n')) {
      const m = line.match(/\((\d+\.\d+\.\d+\.\d+)\).*?([a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2}[:\-][a-f0-9]{2})/i);
      if (m) map.set(m[1], m[2].toUpperCase().replace(/-/g, ':'));
    }
  } catch (e) {}

  
  return map;
}

function isAlive(ip) {
  try {
    const flag = os.platform() === 'darwin' ? '-t' : '-W';
    execSync(`ping -c 1 ${flag} 1 ${ip}`, { stdio: 'ignore', timeout: 1500 });
    return true;
  } catch (e) { return false; }
}

function isSudo() {
  try { return process.getuid() === 0; } catch (e) { return false; }
}

// ─── OUI lookup ─────────────────────────────────────────────────────────────

const OUI_DB = {
  'AC:84:C6':'Apple','B8:09:8A':'Apple','F4:5C:89':'Apple','C8:3A:35':'Apple',
  '9C:F3:87':'Apple','8C:85:90':'Apple','A8:BE:27':'Apple','00:17:F2':'Apple',
  'F0:18:98':'Apple','3C:06:30':'Apple','D0:03:4B':'Apple','BC:92:6B':'Apple',
  '60:F8:1D':'Apple','A4:83:E7':'Apple','18:65:90':'Apple','70:73:CB':'Apple',
  '7C:D1:C3':'Apple','20:AB:37':'Apple','DC:2B:2A':'Apple','34:C0:59':'Apple',
  '70:56:81':'Samsung','8C:77:12':'Samsung','C4:42:02':'Samsung','34:AA:8B':'Samsung',
  'F4:42:8F':'Samsung','B0:72:BF':'Samsung','E8:03:9A':'Samsung','78:59:5E':'Samsung',
  'D0:53:49':'Xiaomi','54:EE:75':'Xiaomi','AC:C1:EE':'Xiaomi','F8:A2:D6':'Xiaomi',
  '64:09:80':'Xiaomi','34:CE:00':'Xiaomi','FC:64:BA':'Xiaomi',
  'D4:61:9D':'OnePlus','94:65:2D':'OnePlus','AC:B5:7D':'OnePlus',
  'A4:C3:6B':'Google','F4:F5:D8':'Google','54:60:09':'Google','48:D6:D5':'Google',
  'FC:F5:C4':'Huawei','00:18:82':'Huawei','28:6E:D4':'Huawei','58:2A:F7':'Huawei',
  '50:2B:73':'TP-Link','54:AF:97':'TP-Link','F4:F2:6D':'TP-Link','EC:08:6B':'TP-Link',
  'CC:2D:21':'Netgear','A0:04:60':'Netgear','9C:D3:6D':'Netgear',
  '00:1A:A9':'D-Link','1C:7E:E5':'D-Link','B8:A3:86':'D-Link',
  '3C:2E:F9':'Intel','8C:8D:28':'Intel','A4:C3:F0':'Intel','8C:EC:4B':'Intel',
  '00:E0:4C':'Realtek','48:2C:6A':'Realtek',
  '00:11:22':'Dell','F8:DB:88':'Dell','18:03:73':'Dell','B8:CA:3A':'Dell',
  '3C:D9:2B':'HP','B4:99:BA':'HP','A0:B3:CC':'HP',
  '54:05:DB':'Lenovo','28:D2:44':'Lenovo','18:2D:E2':'Lenovo',
  'B8:27:EB':'Raspberry Pi','DC:A6:32':'Raspberry Pi','E4:5F:01':'Raspberry Pi',
  '44:65:0D':'Amazon Echo','74:C2:46':'Amazon','B4:7C:9C':'Amazon Echo',
  '00:0C:29':'VMware','00:50:56':'VMware','08:00:27':'VirtualBox',
  'EC:B5:FA':'Philips Hue','00:17:88':'Philips Hue',
  '00:11:32':'Synology','24:5E:BE':'QNAP',
};

function getVendor(mac) {
  if (!mac) return null;
  const norm = mac.toUpperCase();
  for (const [oui, name] of Object.entries(OUI_DB)) {
    if (norm.startsWith(oui)) return name;
  }
  return null;
}

// ─── Device name resolution (the key feature) ───────────────────────────────

/**
 * Parse router's DHCP leases file — this gives you real hostnames like
 * "Raman-MacBook-Pro" or "Pamans-iPhone-17" that devices send during DHCP.
 *
 * Locations differ by router/OS — we try all common ones.
 */
function parseDHCPLeases() {
  const leasePaths = [
    '/var/lib/dhcp/dhcpd.leases',          // Linux ISC DHCP
    '/var/lib/dhcpd/dhcpd.leases',         // some distros
    '/tmp/dhcp.leases',                     // OpenWRT/DD-WRT
    '/tmp/dnsmasq.leases',                  // dnsmasq (very common)
    '/var/lib/misc/dnsmasq.leases',         // some systems
    '/run/dnsmasq/dnsmasq.leases',
    '/etc/dhcpd.leases',
    '/var/db/dhcpd.leases',                 // BSD
  ];

  const map = new Map(); // ip → hostname

  for (const p of leasePaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const content = fs.readFileSync(p, 'utf8');

      // dnsmasq format: "timestamp mac ip hostname clientid"
      // e.g: 1714000000 ac:84:c6:xx:xx:xx 192.168.1.100 Raman-MacBook-Pro *
      if (!content.includes('{')) {
        for (const line of content.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4 && parts[2].match(/^\d+\.\d+\.\d+\.\d+$/)) {
            const ip   = parts[2];
            const name = parts[3];
            if (name && name !== '*' && name !== '(none)') {
              map.set(ip, name.replace(/-/g, "'").replace(/s'/g, "s'"));
            }
          }
        }
        continue;
      }

      // ISC DHCP format (block style)
      const leaseBlocks = content.split(/lease\s+/);
      for (const block of leaseBlocks.slice(1)) {
        const ipMatch   = block.match(/^(\d+\.\d+\.\d+\.\d+)/);
        const nameMatch = block.match(/client-hostname\s+"([^"]+)"/);
        if (ipMatch && nameMatch) {
          map.set(ipMatch[1], nameMatch[1]);
        }
      }
    } catch (e) {}
  }

  return map;
}

/**
 * mDNS hostname — Apple/Linux devices broadcast these.
 * Returns "Ramans-MacBook-Pro.local" style names.
 * Fast (2s timeout), works without sudo.
 */
function getMDNSHostname(ip) {
  try {
    if (os.platform() === 'darwin') {
      // dns-sd -G is the most reliable way on macOS
      const out = execSync(
  `(dns-sd -G v4 ${ip} & sleep 2; kill %1; wait) 2>/dev/null`,
  { encoding: 'utf8', timeout: 3500, shell: true }
);
      const m = out.match(/([a-zA-Z0-9_-]+\.local)/);
      if (m) return m[1];

      // fallback: try avahi-resolve style approach
      const out2 = execSync(`dns-sd -q ${ip}.in-addr.arpa 2>/dev/null || true`, { encoding: 'utf8', timeout: 2000 });
      const m2 = out2.match(/(\S+\.local)/);
      return m2 ? m2[1] : null;
    } else {
      // Linux: avahi-resolve
      const out = execSync(`avahi-resolve -a ${ip} 2>/dev/null`, { encoding: 'utf8', timeout: 2000 });
      const m = out.match(/\s+(\S+\.local)/);
      return m ? m[1] : null;
    }
  } catch (e) { return null; }
}

/**
 * NetBIOS name — Windows machines broadcast these.
 * Returns "DESKTOP-ABC123" or "RAMAN-PC" style names.
 */
function getNetBIOSName(ip) {
  try {
    // nmblookup (Samba tools) — most reliable
    const out = execSync(`nmblookup -A ${ip} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 });
    // Look for the <00> entry (workstation service) — that's the computer name
    const m = out.match(/^\s+([A-Z0-9_-]{1,15})\s+<00>/im);
    if (m) return m[1].trim();
  } catch (e) {}
  try {
    // nbtscan fallback
    const out = execSync(`nbtscan -r ${ip}/32 2>/dev/null`, { encoding: 'utf8', timeout: 3000 });
    const m = out.match(ip.replace(/\./g, '\\.') + '\\s+(\\S+)');
    if (m) return m[1];
  } catch (e) {}
  return null;
}

// boss.js mein yeh section replace karo (getReverseDNS strict filtering hatao)
async function getReverseDNS(ip) {
  try {
    const hosts = await dns.reverse(ip);
    const h = hosts[0];
    if (!h) return null;
    // College networks return proper hostnames like "raman-pc.college.edu"
    // Only filter actual reverse-PTR garbage
    if (h.includes('in-addr.arpa') || h.includes('ip6.arpa')) return null;
    return h; // Return full hostname, don't filter "ISP-generated" ones
  } catch (e) { return null; }
}

// buildBestName mein rDNS priority badhao:
function buildBestName({ dhcpName, mdns, netbios, rdns, vendor, ip, isLocal, isRouter, localHostname }) {
  if (isLocal) return localHostname ? `${localHostname} ← YOU` : 'Your device';
  if (isRouter) return 'Router / Gateway';

  if (dhcpName) return prettifyHostname(dhcpName);
  if (mdns)     return prettifyHostname(mdns.replace('.local', ''));
  if (netbios)  return prettifyHostname(netbios);
  
  // Enterprise network mein rDNS sabse important — pehle check karo
  if (rdns) return rdns; // full domain return karo, slice mat karo
  
  if (vendor)   return `${vendor} device`;
  return `Unknown (${ip})`;
}

/**
 * Build the best possible device name from all available sources.
 * Priority: DHCP hostname > mDNS > NetBIOS > reverse DNS > vendor + type
 */
function buildBestName({ dhcpName, mdns, netbios, rdns, vendor, ip, isLocal, isRouter, localHostname }) {
  if (isLocal) {
    return localHostname ? `${localHostname} ← YOU` : 'Your device';
  }
  if (isRouter) return 'Router / Gateway';

  // DHCP: most reliable — device sent this name itself during DHCP handshake
  if (dhcpName) return prettifyHostname(dhcpName);

  // mDNS: Apple devices + modern Linux
  if (mdns) return prettifyHostname(mdns.replace('.local', ''));

  // NetBIOS: Windows machines
  if (netbios) return prettifyHostname(netbios);

  // rDNS: if it looks like a real hostname (not ISP garbage)
  if (rdns) return rdns.split('.').slice(0, 2).join('.');

  // Vendor only
  if (vendor) return `${vendor} device`;

  return `Unknown (${ip})`;
}

/** out = 
 * Convert hostnames like "Ramans-MacBook-Pro" → "Raman's MacBook Pro"
 * or "DESKTOP-ABC123" → "DESKTOP-ABC123" (leave Windows names as-is)
 */
function prettifyHostname(name) {
  if (!name) return name;
  // Replace hyphens with spaces and fix possessives: "Ramans" → "Raman's"
  // But only for lowercase-starting names (Apple style), not "DESKTOP-ABC123"
  if (name[0] === name[0].toLowerCase() || /^[A-Z][a-z]/.test(name)) {
    return name
      .replace(/-/g, ' ')
      .replace(/([a-z])s ([A-Z])/g, "$1's $2") // Ramans MacBook → Raman's MacBook
      .replace(/\b\w/g, c => c.toUpperCase()); // title case
  }
  return name;
}

// ─── Device type from vendor + ports ────────────────────────────────────────

function detectType(vendor) {
  if (!vendor) return { type: 'Unknown', emoji: '❓' };
  const v = vendor.toLowerCase();
  if (v === 'apple')        return { type: 'Apple device',    emoji: '🍎' };
  if (v === 'samsung')      return { type: 'Android phone',   emoji: '📱' };
  if (v === 'xiaomi')       return { type: 'Xiaomi device',   emoji: '📱' };
  if (v === 'oneplus')      return { type: 'OnePlus phone',   emoji: '📱' };
  if (v === 'google')       return { type: 'Google device',   emoji: '🤖' };
  if (v === 'raspberry pi') return { type: 'Raspberry Pi',    emoji: '🥧' };
  if (v === 'amazon echo')  return { type: 'Amazon Echo',     emoji: '🔊' };
  if (v === 'synology')     return { type: 'Synology NAS',    emoji: '🗄️'  };
  if (v === 'philips hue')  return { type: 'Philips Hue',     emoji: '💡' };
  if (['tp-link','netgear','d-link','cisco'].includes(v))
    return { type: 'Router / AP', emoji: '📡' };
  if (['dell','hp','lenovo','intel'].includes(v))
    return { type: 'Laptop / PC', emoji: '💻' };
  if (['vmware','virtualbox'].includes(v))
    return { type: 'VM / Container', emoji: '🖥️' };
  return { type: vendor + ' device', emoji: '🔌' };
}

// ─── Simple traffic summary per device (no ARP spoof needed) ────────────────
// Uses ss/netstat to check LOCAL connections, and tcpdump for remote traffic.

function getLocalConnections(ip) {
  try {
    // ss -tnp (Linux) or netstat -an (macOS)
    let out = '';
    if (os.platform() === 'darwin') {
      out = execSync('netstat -an 2>/dev/null', { encoding: 'utf8', timeout: 3000 });
    } else {
      out = execSync('ss -tn 2>/dev/null', { encoding: 'utf8', timeout: 3000 });
    }
    const lines = out.split('\n').filter(l => l.includes(ip));
    return lines.length;
  } catch (e) { return 0; }
}

// ─── Boss scan ───────────────────────────────────────────────────────────────

async function bossModeScan(opts = {}) {
  const { watch = false, quiet = false } = opts;
  const localIP      = getLocalIP();
  const gateway      = getGateway();
  const localhost    = os.hostname();
  const subnet       = localIP.split('.').slice(0, 3).join('.');
  const dhcpLeases   = parseDHCPLeases();

  if (!quiet) {
    console.clear();
    console.log(chalk.red('╔══════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.red('║  👁  NETPULSE BOSS MODE — FULL NETWORK VISIBILITY                   ║'));
    console.log(chalk.red('╚══════════════════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.yellow(`🌐 Your IP : ${localIP} (${localhost})`));
    console.log(chalk.yellow(`🔀 Gateway : ${gateway || 'unknown'}`));
    console.log(chalk.yellow(`🔍 Subnet  : ${subnet}.0/24`));
    console.log(chalk.yellow(`📋 DHCP    : ${dhcpLeases.size} hostnames found from leases\n`));
    console.log(chalk.dim('⏳ Scanning all 254 hosts — names resolved in parallel...\n'));
  }

  const arpTable = getArpTable();
  const alive    = [];

  // Phase 1: find alive hosts
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    process.stdout.write(chalk.dim(`\r   Scanning ${ip}...`));
    if (isAlive(ip)) alive.push(ip);
  }

  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  console.log(chalk.green(`✅ Found ${alive.length} live hosts. Resolving identities...\n`));

  // Phase 2: resolve names in parallel
  const devices = await Promise.all(alive.map(async (ip) => {
    const mac      = arpTable.get(ip) || null;
    const vendor   = getVendor(mac);
    const isLocal  = ip === localIP;
    const isRouter = ip === gateway;

    // Skip heavy lookups for your own IP and router
    let dhcpName = dhcpLeases.get(ip) || null;
    let mdns     = null;
    let netbios  = null;
    let rdns     = null;

    if (!isLocal && !isRouter) {
      // Run all resolutions in parallel
      [rdns, mdns, netbios] = await Promise.all([
        getReverseDNS(ip),
        Promise.resolve(getMDNSHostname(ip)),    // sync wrapped in promise
        Promise.resolve(getNetBIOSName(ip)),      // sync wrapped in promise
      ]);
    }

    const name     = buildBestName({ dhcpName, mdns, netbios, rdns, vendor, ip, isLocal, isRouter, localHostname: localhost });
    const { type, emoji } = detectType(vendor);
    const connCount = getLocalConnections(ip);

    return {
      ip, mac: mac || 'unknown',
      vendor: vendor || 'unknown',
      name, type, emoji,
      isLocal, isRouter,
      dhcpName, mdns, netbios, rdns,
      connCount,
      nameSource: dhcpName ? 'DHCP' : mdns ? 'mDNS' : netbios ? 'NetBIOS' : rdns ? 'rDNS' : vendor ? 'OUI' : '?',
    };
  }));

  // ─── Display ──────────────────────────────────────────────────────────────
  console.clear();
  console.log(chalk.red('╔══════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.red(`║  👁  NETPULSE BOSS MODE                          Connected: ${String(devices.length).padEnd(3)} devices          ║`));
  console.log(chalk.red('╚══════════════════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.yellow(`🌐 ${localIP} (${localhost})   🔀 ${gateway || '?'}   🔍 ${subnet}.0/24\n`));

  console.log('┌─────────────────┬──────────────────────────────────┬──────────────────┬──────────────┬────────┐');
  console.log('│ IP ADDRESS      │ DEVICE NAME                      │ TYPE             │ VENDOR / MAC │ SOURCE │');
  console.log('├─────────────────┼──────────────────────────────────┼──────────────────┼──────────────┼────────┤');

  for (const d of devices) {
    const ip     = d.ip.padEnd(15);
    const name   = d.name.slice(0, 32).padEnd(32);
    const type   = `${d.emoji} ${d.type}`.slice(0, 16).padEnd(16);
    const vendor = `${d.vendor} / ${d.mac.slice(0, 8)}`.slice(0, 12).padEnd(12);
    const source = d.nameSource.padEnd(6);

    let ipCol   = ip;
    let nameCol = name;

    if (d.isLocal)  { ipCol = chalk.green(ip);  nameCol = chalk.green.bold(name); }
    else if (d.isRouter) { ipCol = chalk.cyan(ip); nameCol = chalk.cyan.bold(name); }
    else if (d.name.startsWith('Unknown')) { ipCol = chalk.red(ip); nameCol = chalk.red(name); }

    const sourceCol = d.nameSource === 'DHCP'  ? chalk.green(source)  :
                      d.nameSource === 'mDNS'  ? chalk.blue(source)   :
                      d.nameSource === 'NetBIOS'? chalk.yellow(source) :
                      chalk.dim(source);

    console.log(`│ ${ipCol} │ ${nameCol} │ ${type} │ ${vendor} │ ${sourceCol} │`);

    // Sub-row: show raw names if we have multiple sources
    const extras = [];
    if (d.dhcpName) extras.push(`DHCP: "${d.dhcpName}"`);
    if (d.mdns)     extras.push(`mDNS: ${d.mdns}`);
    if (d.netbios)  extras.push(`NetBIOS: ${d.netbios}`);
    if (extras.length > 1) {
      const sub = extras.join('  ').slice(0, 74).padEnd(74);
      console.log(`│                 │ ${chalk.dim(sub)} │`);
    }
  }

  console.log('└─────────────────┴──────────────────────────────────┴──────────────────┴──────────────┴────────┘');

  // ─── Boss summary ─────────────────────────────────────────────────────────
  const named   = devices.filter(d => d.nameSource !== '?').length;
  const unknown = devices.filter(d => d.name.startsWith('Unknown')).length;
  const apple   = devices.filter(d => d.vendor === 'Apple').length;
  const android = devices.filter(d => ['Samsung','Xiaomi','OnePlus','Google'].includes(d.vendor)).length;
  const dhcp    = devices.filter(d => d.dhcpName).length;

  console.log(chalk.red(`\n👁  BOSS SUMMARY`));
  console.log(`   ├─ Total devices  : ${chalk.bold(devices.length)}`);
  console.log(`   ├─ Named (any)    : ${chalk.green(named)}`);
  console.log(`   ├─ via DHCP lease : ${chalk.green(dhcp)} (most reliable)`);
  console.log(`   ├─ Unknown        : ${chalk.red(unknown)}`);
  console.log(`   ├─ Apple devices  : ${apple}`);
  console.log(`   ├─ Android devices: ${android}`);
  console.log(`   └─ You            : ${chalk.cyan(localIP)} (${localhost})`);

  console.log(chalk.dim(`\n💡 netpulse boss --spy <ip>   → see exactly what that device is doing`));
  console.log(chalk.dim(`💡 netpulse boss --spy all    → monitor all devices (requires sudo)`));
  console.log(chalk.dim(`💡 netpulse boss --watch      → auto-refresh every 30s\n`));

  if (watch) {
    console.log(chalk.yellow('\n🔄 Live mode — rescanning in 30s... (Ctrl+C to stop)\n'));
    setTimeout(() => bossModeScan({ watch: true }), 30000);
  }

  return devices;
}

// ─── Activity spy for a single device ───────────────────────────────────────
// Uses tcpdump without ARP spoof — captures only traffic visible from your machine.
// For FULL traffic capture (all their internet activity), sudo + ARP spoof needed (see spy.js).

const SERVICE_MAP = {
  80:'HTTP',443:'HTTPS',22:'SSH',53:'DNS',3306:'MySQL',27017:'MongoDB',
  6379:'Redis',8080:'HTTP-alt',3000:'Dev server',5432:'PostgreSQL',
  5353:'mDNS',8443:'HTTPS-alt',1935:'Streaming',554:'RTSP',
  3478:'WebRTC/STUN',5060:'SIP',5228:'Google Push',5222:'XMPP',
  1194:'OpenVPN',51820:'WireGuard',
};

const KNOWN_SERVICES = [
  { prefix:'172.217.', name:'Google', emoji:'🔵' },
  { prefix:'142.250.', name:'Google', emoji:'🔵' },
  { prefix:'74.125.',  name:'Google', emoji:'🔵' },
  { prefix:'157.240.', name:'Facebook/Meta', emoji:'👤' },
  { prefix:'31.13.',   name:'Instagram', emoji:'📷' },
  { prefix:'17.',      name:'Apple/iCloud', emoji:'🍎' },
  { prefix:'104.',     name:'Cloudflare', emoji:'🌤️' },
  { prefix:'140.82.',  name:'GitHub', emoji:'🐱' },
  { prefix:'13.107.',  name:'Microsoft', emoji:'🪟' },
  { prefix:'91.108.',  name:'Telegram', emoji:'✈️' },
  { prefix:'149.154.', name:'Telegram', emoji:'✈️' },
  { prefix:'34.',      name:'AWS', emoji:'☁️' },
  { prefix:'52.',      name:'AWS', emoji:'☁️' },
  { prefix:'54.',      name:'AWS', emoji:'☁️' },
];

function identifySvc(ip, port) {
  for (const s of KNOWN_SERVICES) {
    if (ip && ip.startsWith(s.prefix)) return `${s.emoji} ${s.name}`;
  }
  const svc = SERVICE_MAP[port];
  if (svc) return `⚙️  ${svc}`;
  return `❓ :${port}`;
}

function spyDevice(ip, deviceName) {
  if (!isSudo()) {
    console.log(chalk.red(`\n⚠️  Traffic spy needs sudo:\n`));
    console.log(chalk.yellow(`   sudo netpulse boss --spy ${ip}\n`));
    return;
  }

  const iface = (() => {
    try {
      if (os.platform() === 'darwin') return 'en0';
      return execSync("ip route | grep default | awk '{print $5}'", { encoding:'utf8' }).trim();
    } catch(e) { return 'en0'; }
  })();

  console.clear();
  console.log(chalk.red('╔══════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.red(`║  🕵️  BOSS SPY: ${(deviceName || ip).padEnd(65)}║`));
  console.log(chalk.red('╚══════════════════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.yellow(`\n   Watching: ${chalk.bold(ip)} (${deviceName || 'unknown'})`));
  console.log(chalk.dim('   Ctrl+C to stop\n'));

  console.log(chalk.dim('   TIME      DIR    SERVICE / DESTINATION            REMOTE IP            PORT  '));
  console.log(chalk.dim('   ' + '─'.repeat(72)));

  const stats = { pkts:0, outPkts:0, inPkts:0, svcs:{} };

  const proc = spawn('tcpdump', [
    '-i', iface, '-l', '-n', '-q', '-tt', '-s', '96', `host ${ip}`
  ], { stdio:['ignore','pipe','ignore'] });

  proc.stdout.on('data', d => {
    for (const line of d.toString().split('\n')) {
      const m = line.match(/(\d+\.\d+\.\d+\.\d+)\.(\d+)\s*[><]\s*(\d+\.\d+\.\d+\.\d+)\.(\d+)/);
      if (!m) continue;
      const [, srcIP, srcPort, dstIP, dstPort] = m;
      const isOut = srcIP === ip;
      const remote = isOut ? dstIP   : srcIP;
      const port   = isOut ? +dstPort : +srcPort;

      if (remote === getLocalIP()) continue;

      const svc = identifySvc(remote, port);
      stats.pkts++;
      isOut ? stats.outPkts++ : stats.inPkts++;
      stats.svcs[svc] = (stats.svcs[svc] || 0) + 1;

      const t    = new Date().toLocaleTimeString();
      const dir  = isOut ? chalk.red('OUT→') : chalk.green('←IN ');
      const svcS = svc.slice(0, 32).padEnd(32);
      const remS = remote.padEnd(20);
      const pS   = String(port).padEnd(5);

      console.log(`   ${t}  ${dir}  ${svcS}  ${remS}  ${pS}`);

      process.stdout.write(
        chalk.dim(`\r   📦 Pkts: ${stats.pkts}  `) +
        chalk.red(`↑${stats.outPkts} `) +
        chalk.green(`↓${stats.inPkts}`) +
        `\r`
      );
    }
  });

  process.on('SIGINT', () => {
    try { proc.kill('SIGKILL'); } catch(e) {}
    console.log(chalk.yellow('\n\n📊 Activity summary for ' + (deviceName || ip)));
    const top = Object.entries(stats.svcs).sort((a,b) => b[1]-a[1]).slice(0, 10);
    top.forEach(([s, n], i) => {
      console.log(`   ${i+1}. ${s.padEnd(36)} ×${n}`);
    });
    console.log('');
    process.exit(0);
  });
}

// ─── CLI router ─────────────────────────────────────────────────────────────

async function bossCLI(args = []) {
  const watch = args.includes('--watch');
  const spyIdx = args.indexOf('--spy');
  const spyTarget = spyIdx !== -1 ? args[spyIdx + 1] : null;

  if (spyTarget) {
    if (spyTarget === 'all') {
      console.log(chalk.yellow('\n⚡ Scanning first to get device list...'));
      const devices = await bossModeScan({ quiet: true });
      // TODO: spawn multiple tcpdump instances per device + merge output
      console.log(chalk.yellow('\n💡 Multi-device spy coming soon. Use --spy <ip> for now.\n'));
      devices.forEach(d => {
        if (!d.isLocal && !d.isRouter) {
          console.log(`   ${d.ip.padEnd(16)}  ${d.name}`);
        }
      });
    } else {
      // First scan to get device name, then spy
      console.log(chalk.dim(`\nLooking up device name for ${spyTarget}...`));
      const arp    = getArpTable();
      const mac    = arp.get(spyTarget);
      const vendor = getVendor(mac);
      const leases = parseDHCPLeases();
      const dhcpName = leases.get(spyTarget);
      const mdns   = getMDNSHostname(spyTarget);
      const name   = dhcpName || (mdns ? prettifyHostname(mdns.replace('.local','')) : null) || vendor || spyTarget;
      spyDevice(spyTarget, name);
    }
    return;
  }

  await bossModeScan({ watch });
}

module.exports = { bossCLI, bossModeScan, parseDHCPLeases, getMDNSHostname, buildBestName, prettifyHostname };

if (require.main === module) {
  bossCLI(process.argv.slice(2)).catch(console.error);
}