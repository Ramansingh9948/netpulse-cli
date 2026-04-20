const { execSync } = require('child_process');

function getMacConnections() {
  try {
    const output = execSync(
      'netstat -anv -p tcp | grep ESTABLISHED',
      { encoding: 'utf8', timeout: 3000 }
    );
    
    const connections = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const local = parts[3];
        const foreign = parts[4];
        const portParts = local.split('.');
        const localPort = portParts[portParts.length - 1];
        
        if (local.includes('127.0.0.1') || foreign.includes('127.0.0.1')) continue;
        
        // Get process using lsof
        let process = 'unknown';
        try {
          const lsofOutput = execSync(
            `lsof -i :${localPort} 2>/dev/null | grep -v COMMAND | head -1 | awk '{print $1}'`,
            { encoding: 'utf8', timeout: 1000 }
          );
          process = lsofOutput.trim() || 'unknown';
          
          // Clean up process names for better readability
          const processMap = {
            'Google Chrome': 'Chrome',
            'Google': 'Chrome',
            'Slack': 'Slack',
            'Discord': 'Discord',
            'Spotify': 'Spotify',
            'Visual Studio Code': 'VSCode',
            'Code': 'VSCode',
            'node': 'Node.js',
            'python': 'Python',
            'python3': 'Python',
            'Instagram': 'Instagram',
            'WhatsApp': 'WhatsApp',
            'Telegram': 'Telegram',
            'Zoom': 'Zoom',
            'Microsoft Teams': 'Teams',
            'Teams': 'Teams',
            'Firefox': 'Firefox',
            'Safari': 'Safari',
            'terminal': 'Terminal',
            'iTerm2': 'Terminal'
          };
          
          for (const [key, value] of Object.entries(processMap)) {
            if (process.includes(key)) {
              process = value;
              break;
            }
          }
        } catch (e) {}
        
        connections.push({
          local: local,
          remote: foreign,
          state: parts[5],
          process: process.slice(0, 8),
          port: localPort
        });
      }
    }
    
    return connections;
  } catch (error) {
    return [];
  }
}

function getAppBreakdown(connections) {
  const appStats = {};
  
  for (const conn of connections) {
    const app = conn.process || 'unknown';
    if (!appStats[app]) {
      appStats[app] = { 
        connections: 0, 
        ips: new Set(),
        ports: new Set()
      };
    }
    appStats[app].connections++;
    if (conn.remote) {
      const ip = conn.remote.split(':')[0];
      appStats[app].ips.add(ip);
    }
    if (conn.port) appStats[app].ports.add(conn.port);
  }
  
  // Convert Sets to counts for display
  const result = {};
  for (const [app, data] of Object.entries(appStats)) {
    result[app] = {
      connections: data.connections,
      uniqueIPs: data.ips.size,
      uniquePorts: data.ports.size
    };
  }
  
  return result;
}

module.exports = { getMacConnections, getAppBreakdown };