const https = require('https');

async function getGeoInfo(ip) {
  return new Promise((resolve) => {
    if (!ip || ip.includes('127.') || ip.includes('192.168.')) {
      return resolve(null);
    }
    
    const url = `http://ip-api.com/json/${ip}?fields=status,country,city,isp`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'success') {
            resolve({ country: json.country, city: json.city, isp: json.isp });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = { getGeoInfo };