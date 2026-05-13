#!/usr/bin/env node

/**
 * NetPulse DHCP Lease Fetcher
 *
 * Fetches device hostnames from your router's DHCP lease table.
 * This is the BEST source for "Raman's MacBook Pro" style names —
 * the device itself sends this hostname during DHCP negotiation.
 *
 * Supports:
 *   - Local dnsmasq/ISC DHCP leases file (if running on the router)
 *   - Router SSH access (OpenWRT / DD-WRT / Asus Merlin / pfSense)
 *   - Router HTTP API (some routers expose this)
 *
 * Usage:
 *   node dhcp-fetch.js                        — auto-detect local files
 *   node dhcp-fetch.js --ssh root@192.168.1.1 — fetch via SSH from router
 *   node dhcp-fetch.js --gateway              — try gateway IP via SSH
 */

const { execSync } = require('child_process');
const fs    = require('fs');
const os    = require('os');
const chalk = require('chalk');

// ─── Common DHCP lease file locations ───────────────────────────────────────

const LEASE_PATHS = [
  // Linux / Raspberry Pi running dnsmasq
  '/var/lib/misc/dnsmasq.leases',
  '/var/lib/dhcp/dnsmasq.leases',
  '/tmp/dnsmasq.leases',              // OpenWRT
  '/tmp/dhcp.leases',                 // DD-WRT
  '/var/run/dnsmasq.leases',
  '/run/dnsmasq/dnsmasq.leases',
  // ISC DHCP
  '/var/lib/dhcp/dhcpd.leases',
  '/var/lib/dhcpd/dhcpd.leases',
  '/etc/dhcpd.leases',
  '/var/db/dhcpd.leases',             // FreeBSD / pfSense
  // macOS (if you're running the router on macOS — unlikely but covers it)
  '/private/var/db/dhcpd.leases',
];

// ─── Parse dnsmasq format ────────────────────────────────────────────────────
// Format: "1714000000 aa:bb:cc:dd:ee:ff 192.168.1.100 Raman-MacBook-Pro *"

function parseDnsmasq(content) {
  const devices = [];
  for (const line of content.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [expires, mac, ip, hostname] = parts;
    if (!ip.match(/^\d+\.\d+\.\d+\.\d+$/)) continue;
    if (!hostname || hostname === '*' || hostname === '(none)') continue;
    devices.push({
      ip,
      mac: mac.toUpperCase(),
      hostname: hostname,
      displayName: prettify(hostname),
      expires: parseInt(expires) ? new Date(parseInt(expires) * 1000).toLocaleString() : 'static',
      source: 'dnsmasq'
    });
  }
  return devices;
}

// ─── Parse ISC DHCP format ───────────────────────────────────────────────────

function parseISCDHCP(content) {
  const devices = [];
  const blocks = content.split(/lease\s+/);
  for (const block of blocks.slice(1)) {
    const ipMatch      = block.match(/^(\d+\.\d+\.\d+\.\d+)\s*\{/);
    const nameMatch    = block.match(/client-hostname\s+"([^"]+)"/);
    const macMatch     = block.match(/hardware ethernet\s+([0-9a-f:]+)/i);
    const expiresMatch = block.match(/ends \d+ (.+?);/);
    if (!ipMatch) continue;
    devices.push({
      ip: ipMatch[1],
      mac: macMatch ? macMatch[1].toUpperCase() : 'unknown',
      hostname: nameMatch ? nameMatch[1] : null,
      displayName: nameMatch ? prettify(nameMatch[1]) : `Unknown (${ipMatch[1]})`,
      expires: expiresMatch ? expiresMatch[1] : 'unknown',
      source: 'ISC DHCP'
    });
  }
  return devices;
}

// ─── Prettify hostname ───────────────────────────────────────────────────────

function prettify(name) {
  if (!name) return name;
  // Apple sends: "Ramans-MacBook-Pro" → "Raman's MacBook Pro"
  // Windows sends: "DESKTOP-ABC123" (keep as-is)
  // Android sends: "android-abc123def456" (keep lowercase)
  if (/^android-/i.test(name)) return name;     // Android — leave it
  if (/^[A-Z0-9_-]+$/.test(name)) return name;  // ALL CAPS Windows — leave it
  return name
    .replace(/-/g, ' ')
    .replace(/([a-z])s ([A-Z])/g, "$1's $2")    // Ramans MacBook → Raman's MacBook
    .replace(/\b\w/g, c => c.toUpperCase());     // title case
}

// ─── Fetch from local files ──────────────────────────────────────────────────

function fetchLocal() {
  for (const p of LEASE_PATHS) {
    if (!fs.existsSync(p)) continue;
    try {
      const content = fs.readFileSync(p, 'utf8');
      const devices = content.includes('{')
        ? parseISCDHCP(content)
        : parseDnsmasq(content);
      if (devices.length > 0) {
        return { devices, source: p };
      }
    } catch (e) {}
  }
  return { devices: [], source: null };
}

// ─── Fetch from router via SSH ───────────────────────────────────────────────

function fetchViaSSH(routerAddr) {
  console.log(chalk.dim(`\n   Connecting to ${routerAddr} via SSH...\n`));

  // Common lease file locations on routers
  const locations = [
    '/tmp/dnsmasq.leases',         // OpenWRT, DD-WRT
    '/tmp/dhcp.leases',            // DD-WRT alternative
    '/var/lib/misc/dnsmasq.leases',
    '/var/lib/dhcp/dhcpd.leases',
    '/var/db/dhcpd.leases',        // pfSense
  ];

  for (const loc of locations) {
    try {
      const content = execSync(
        `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${routerAddr} "cat ${loc} 2>/dev/null"`,
        { encoding: 'utf8', timeout: 10000 }
      );
      if (!content.trim()) continue;
      const devices = content.includes('{')
        ? parseISCDHCP(content)
        : parseDnsmasq(content);
      if (devices.length > 0) {
        return { devices, source: `${routerAddr}:${loc}` };
      }
    } catch (e) {}
  }

  // OpenWRT: try ubus RPC for DHCP leases
  try {
    const out = execSync(
      `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${routerAddr} "ubus call dhcp ipv4leases 2>/dev/null || uci show dhcp 2>/dev/null | head -50"`,
      { encoding: 'utf8', timeout: 8000 }
    );
    if (out.includes('.hostname')) {
      // Parse uci output: dhcp.@host[0].hostname='Raman-MacBook'
      const devices = [];
      const ips      = [...out.matchAll(/\.ip='([^']+)'/g)].map(m => m[1]);
      const macs     = [...out.matchAll(/\.mac='([^']+)'/g)].map(m => m[1]);
      const names    = [...out.matchAll(/\.hostname='([^']+)'/g)].map(m => m[1]);
      for (let i = 0; i < ips.length; i++) {
        devices.push({
          ip: ips[i], mac: macs[i] || 'unknown',
          hostname: names[i] || null,
          displayName: names[i] ? prettify(names[i]) : `Unknown (${ips[i]})`,
          source: 'OpenWRT UCI'
        });
      }
      if (devices.length) return { devices, source: `${routerAddr} (uci)` };
    }
  } catch(e) {}

  return { devices: [], source: null };
}

// ─── Display ─────────────────────────────────────────────────────────────────

function displayLeases(devices, source) {
  console.clear();
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  📋 DHCP LEASE TABLE — ${String(devices.length).padEnd(3)} devices                               ║`));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.dim(`   Source: ${source || 'none found'}\n`));

  if (devices.length === 0) {
    console.log(chalk.red('   No leases found!\n'));
    console.log(chalk.yellow('   Try: node dhcp-fetch.js --ssh root@<router-ip>'));
    console.log(chalk.yellow('   Or check if dnsmasq is running: systemctl status dnsmasq\n'));
    return;
  }

  console.log('┌─────────────────┬──────────────────────────────────┬───────────────────┬──────────┐');
  console.log('│ IP ADDRESS      │ DISPLAY NAME                     │ RAW HOSTNAME      │ SOURCE   │');
  console.log('├─────────────────┼──────────────────────────────────┼───────────────────┼──────────┤');

  for (const d of devices) {
    const ip   = d.ip.padEnd(15);
    const name = (d.displayName || '—').slice(0, 32).padEnd(32);
    const raw  = (d.hostname || '—').slice(0, 17).padEnd(17);
    const src  = (d.source || '?').slice(0, 8).padEnd(8);
    console.log(`│ ${ip} │ ${name} │ ${raw} │ ${src} │`);
  }

  console.log('└─────────────────┴──────────────────────────────────┴───────────────────┴──────────┘');
  console.log(chalk.dim(`\n   ${devices.filter(d => d.hostname).length} named / ${devices.length} total\n`));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main(args = process.argv.slice(2)) {
  const sshIdx = args.indexOf('--ssh');
  const useGW  = args.includes('--gateway');

  let result;

  if (sshIdx !== -1 && args[sshIdx + 1]) {
    result = fetchViaSSH(args[sshIdx + 1]);
  } else if (useGW) {
    try {
      const gw = os.platform() === 'darwin'
        ? execSync('netstat -rn | grep default', { encoding: 'utf8' }).match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]
        : execSync("ip route | grep default", { encoding: 'utf8' }).match(/via (\d+\.\d+\.\d+\.\d+)/)?.[1];
      if (gw) {
        result = fetchViaSSH(`admin@${gw}`);
      }
    } catch(e) {}
  } else {
    result = fetchLocal();
  }

  if (!result || result.devices.length === 0) {
    result = fetchLocal();
  }

  displayLeases(result.devices, result.source);

  // Return as a Map for use in boss.js
  return new Map(result.devices.map(d => [d.ip, d.displayName || d.hostname]));
}

module.exports = { main, fetchLocal, fetchViaSSH, parseDnsmasq, parseISCDHCP, prettify };

if (require.main === module) {
  main();
}