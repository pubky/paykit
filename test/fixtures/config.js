const path = require('path')

const pluginConfig = {
  plugins: {
    p2sh: path.resolve(__dirname, 'p2sh', 'main.js'),
    p2tr: path.resolve(__dirname, 'p2tr', 'main.js'),
    nonexisting: path.resolve(__dirname, 'nonexisting', 'main.js')
  }
}

const paymentConfig = {
  sendingPriority: [
    'lightning',
    'p2sh',
    'p2tr'
  ]
}

module.exports = {
  pluginConfig,
  paymentConfig
}
