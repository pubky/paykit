const path = require('path')

const pluginConfig = {
  plugins: [
    path.resolve(__dirname, 'p2sh', 'main.js'),
    path.resolve(__dirname, 'p2tr', 'main.js'),
    path.resolve(__dirname, 'nonexisting', 'main.js')
  ]
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
