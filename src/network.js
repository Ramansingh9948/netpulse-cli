const si = require('systeminformation');

async function getNetworkSpeed() {
  const data = await si.networkStats();

  if (!data || !data[0]) {
    return { download: 0, upload: 0 };
  }

  return {
    download: data[0].rx_sec || 0,
    upload: data[0].tx_sec || 0
  };
}

module.exports = { getNetworkSpeed };