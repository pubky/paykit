const path = require('path')

const pluginConfig = {
  db: {},
  plugins: {
    p2sh: path.resolve(__dirname, 'p2sh', 'main.js'),
    p2tr: path.resolve(__dirname, 'p2tr', 'main.js'),
    nonexisting: path.resolve(__dirname, 'nonexisting', 'main.js')
  }
}

const paymentConfig = {
  sendingPriority: [
    'p2sh',
    'p2tr'
  ]
}

const config = {
  ...pluginConfig,
  ...paymentConfig
}

module.exports = {
  pluginConfig,
  paymentConfig,
  config
}
