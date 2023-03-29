const path = require('path')

const pluginConfig = {
  plugins: [
    path.resolve(__dirname, 'pluginA', 'main.js'),
    path.resolve(__dirname, 'pluginB', 'main.js')
  ]
}

module.exports = {
  pluginConfig
}
