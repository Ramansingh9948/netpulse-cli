const { exec } = require('child_process');

function getConnections() {
  return new Promise((resolve) => {
    exec('netstat -ano', (err, stdout) => {
      if (err) return resolve([]);

      const lines = stdout.split('\n').slice(4);

      const data = lines.map(line => {
        const parts = line.trim().split(/\s+/);

        return {
          process: 'unknown',
          pid: parts[4],
          address: `${parts[1]} -> ${parts[2]}`
        };
      });

      resolve(data.slice(0, 10));
    });
  });
}

module.exports = { getConnections };