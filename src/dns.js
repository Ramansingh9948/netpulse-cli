#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const chalk = require('chalk');
const os    = require('os');

const TRACKERS = [
  'doubleclick.net','googleadservices.com','googlesyndication.com',
  'adservice.google.com','facebook.net','connect.facebook.net',
  'analytics.google.com','hotjar.com','mixpanel.com','segment.com',
  'amplitude.com','intercom.io','fullstory.com','mouseflow.com',
  'clarity.ms','scorecardresearch.com','taboola.com','outbrain.com',
  'pubmatic.com','rubiconproject.com','openx.net','adsrvr.org',
  'adnxs.com','advertising.com',
];
const SUSPICIOUS_TLDS = ['.ru','.cn','.tk','.ml','.ga','.cf','.gq'];
const KNOWN_SAFE = [
  'google.com','googleapis.com','apple.com','icloud.com','instagram.com',
  'whatsapp.com','facebook.com','netflix.com','spotify.com','youtube.com',
  'github.com','amazon.com','cloudflare.com','microsoft.com','discord.com',
  'slack.com','zoom.us','twitter.com','x.com','reddit.com','gstatic.com',
  'ytimg.com','amazonaws.com','googleusercontent.com','akamai.net',
];

function classify(domain) {
  if (!domain) return { label:'UNKNOWN ', color:'gray',   emoji:'❓' };
  const d = domain.toLowerCase();
  if (TRACKERS.some(t => d.includes(t)))
    return { label:'TRACKER ', color:'red',    emoji:'🎯' };
  if (SUSPICIOUS_TLDS.some(t => d.endsWith(t)))
    return { label:'SUSPIC. ', color:'red',    emoji:'⚠️ ' };
  if (d.includes('ads.') || d.includes('tracker') || d.includes('telemetry'))
    return { label:'AD/TRACK', color:'yellow', emoji:'📊' };
  if (KNOWN_SAFE.some(s => d.includes(s)))
    return { label:'SAFE    ', color:'green',  emoji:'✅' };
  return   { label:'UNKNOWN ', color:'cyan',   emoji:'🔍' };
}

function getIface() {
  try {
    if (os.platform() === 'darwin') {
      try { execSync('ipconfig getifaddr en0',{stdio:'ignore'}); return 'en0'; } catch(e){}
      try { execSync('ipconfig getifaddr en1',{stdio:'ignore'}); return 'en1'; } catch(e){}
    }
    return execSync("ip route|grep default|awk '{print $5}'",{encoding:'utf8'}).trim();
  } catch(e) { return 'en0'; }
}

function isSudo() {
  try { return process.getuid() === 0; } catch(e) { return false; }
}

class DNSMonitor {
  constructor(opts={}) {
    this.filter       = opts.filter   || null;
    this.onlyTrackers = opts.trackers || false;
    this.queries      = [];
    this.seen         = new Set();
    this.stats        = { total:0, safe:0, trackers:0, suspicious:0, unknown:0 };
    this.tcpProc      = null;
    this.pollTimer    = null;
  }

  header() {
    console.clear();
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║  🔍 NETPULSE DNS MONITOR                                                  ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.dim('  Ctrl+C to stop\n'));
    console.log('┌──────────┬──────────────────────────────────────────────┬──────────┬────────────────┐');
    console.log('│ TIME     │ DOMAIN                                       │ TYPE     │ SOURCE IP      │');
    console.log('├──────────┼──────────────────────────────────────────────┼──────────┼────────────────┤');
  }

  record(domain, source='live') {
    if (!domain || domain.length < 3) return;
    if (this.seen.has(domain)) return;
    this.seen.add(domain);
    setTimeout(() => this.seen.delete(domain), 10000);

    if (this.filter && !domain.toLowerCase().includes(this.filter.toLowerCase())) return;

    const cls = classify(domain);
    if (this.onlyTrackers && !['TRACKER ','AD/TRACK'].includes(cls.label)) return;

    this.stats.total++;
    const l = cls.label.trim();
    if (l==='TRACKER'||l==='AD/TRACK') this.stats.trackers++;
    else if (l==='SUSPIC.')            this.stats.suspicious++;
    else if (l==='SAFE')               this.stats.safe++;
    else                               this.stats.unknown++;

    this.queries.push({ time: new Date().toISOString(), domain, type:l, source });

    const t   = new Date().toLocaleTimeString().padEnd(8);
    const d   = domain.slice(0,44).padEnd(44);
    const typ = `${cls.emoji} ${cls.label}`.slice(0,8).padEnd(8);
    const src = source.slice(0,14).padEnd(14);
    let row = `│ ${t} │ ${d} │ ${typ} │ ${src} │`;

    if      (cls.color==='red')    row = chalk.red(row);
    else if (cls.color==='yellow') row = chalk.yellow(row);
    else if (cls.color==='green')  row = chalk.green(row);
    else                           row = chalk.dim(row);
    console.log(row);

    if (l==='SUSPIC.')
      console.log(chalk.bgRed.white(`  ⚠️  SUSPICIOUS: ${domain}`));

    process.stdout.write(
      chalk.dim(`\r  📊 Total:${this.stats.total} `)+
      chalk.green(`✅ ${this.stats.safe} `)+
      chalk.red(`🎯 ${this.stats.trackers} `)+
      chalk.red(`⚠️  ${this.stats.suspicious} `)+
      chalk.cyan(`❓ ${this.stats.unknown}`) + `\r`
    );
  }

  // Live tcpdump on port 53 — no cap package, no segfault
  startTCPDump(iface) {
    try { execSync('which tcpdump',{stdio:'ignore'}); } catch(e){ return false; }

    const proc = spawn('tcpdump',[
      '-i', iface, '-l', '-n', '-q', '-tt', '-s','512', 'udp port 53'
    ],{ stdio:['ignore','pipe','ignore'] });

    proc.stdout.on('data', data => {
      for (const line of data.toString().split('\n')) {
        if (!line.trim()) continue;
        // Extract queried domain: "A? example.com." or "AAAA? example.com."
        const m = line.match(/(?:A{1,4}\?|PTR\?|MX\?|TXT\?|ANY\?)\s+([a-zA-Z0-9._-]+)/);
        if (!m) continue;
        const domain = m[1].replace(/\.$/, '');
        // Source IP
        const srcM = line.match(/(\d+\.\d+\.\d+\.\d+)\.\d+\s*>/);
        this.record(domain, srcM ? srcM[1] : 'local');
      }
    });

    proc.on('error', ()=>{});
    this.tcpProc = proc;
    return true;
  }

  // Fallback: poll macOS DNS cache
  startCachePolling() {
    const poll = () => {
      try {
        const out = execSync('dscacheutil -cachedump -entries Host 2>/dev/null',
          { encoding:'utf8', timeout:2000 });
        for (const m of out.matchAll(/name:\s+(.+)/g)) {
          this.record(m[1].trim().replace(/\.$/,''), 'cache');
        }
      } catch(e) {}
    };
    poll();
    this.pollTimer = setInterval(poll, 3000);
  }

  report() {
    if (this.tcpProc)  { try { this.tcpProc.kill('SIGKILL'); } catch(e){} }
    if (this.pollTimer){ clearInterval(this.pollTimer); }

    console.log(chalk.cyan('\n\n╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║  📊 DNS MONITOR — SESSION REPORT                                          ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n'));
    console.log(`  Total:      ${chalk.bold(this.stats.total)}`);
    console.log(`  Safe:       ${chalk.green(this.stats.safe)}`);
    console.log(`  Trackers:   ${chalk.red(this.stats.trackers)}`);
    console.log(`  Suspicious: ${chalk.red(this.stats.suspicious)}`);
    console.log(`  Unknown:    ${chalk.cyan(this.stats.unknown)}`);

    const freq = {};
    for (const q of this.queries) freq[q.domain]=(freq[q.domain]||0)+1;
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (top.length) {
      console.log(chalk.yellow('\n  🔥 Top Domains:'));
      top.forEach(([d,n],i) => {
        const c = classify(d);
        console.log(`   ${i+1}. ${d.padEnd(42)} ${c.emoji} ×${n}`);
      });
    }

    const trackers = [...new Set(
      this.queries.filter(q=>q.type==='TRACKER'||q.type==='AD/TRACK').map(q=>q.domain)
    )];
    if (trackers.length) {
      console.log(chalk.red('\n  🎯 Trackers Found:'));
      trackers.forEach(d => console.log(chalk.red(`   → ${d}`)));
    }
    console.log('');
  }

  start() {
    this.header();
    const iface = getIface();

    if (isSudo()) {
      const ok = this.startTCPDump(iface);
      if (ok) {
        console.log(chalk.green('  ✅ Live DNS capture (tcpdump port 53)\n'));
        // Also poll cache as backup
        this.startCachePolling();
      } else {
        console.log(chalk.yellow('  ⚠️  tcpdump not found, using cache polling\n'));
        this.startCachePolling();
      }
    } else {
      console.log(chalk.yellow('  ⚠️  No sudo — using DNS cache polling'));
      console.log(chalk.dim('  💡 For live capture: sudo netpulse dns\n'));
      this.startCachePolling();
    }

    process.on('SIGINT', () => { this.report(); process.exit(0); });
  }
}

function startDNSMonitor(args=[]) {
  const opts = { filter:null, trackers:false };
  for (let i=0; i<args.length; i++) {
    if (args[i]==='--filter'   && args[i+1]) opts.filter   = args[++i];
    if (args[i]==='--trackers')              opts.trackers  = true;
  }
  new DNSMonitor(opts).start();
}

module.exports = { startDNSMonitor, DNSMonitor };