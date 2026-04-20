const { exec } = require('child_process');

function getConnections() {
  return new Promise((resolve) => {
    exec('ss -tunp', (err, stdout) => {
      if (err) return resolve([]);

      const lines = stdout.split('\n').slice(1);

      const data = lines.map(line => {
        const parts = line.trim().split(/\s+/);

        return {
          process: parts[6] || '',
          pid: (parts[6] || '').split(',')[0] || '',
          address: `${parts[4]} -> ${parts[5]}`
        };
      });

      resolve(data.slice(0, 10));
    });
  });
}

module.exports = { getConnections };