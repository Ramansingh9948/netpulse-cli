const os = require('os');

let impl;

switch (os.platform()) {
  case 'darwin':
    impl = require('./mac');
    break;
  case 'linux':
    impl = require('./linux');
    break;
  case 'win32':
    impl = require('./windows');
    break;
  default:
    throw new Error('Unsupported OS');
}

module.exports = impl;