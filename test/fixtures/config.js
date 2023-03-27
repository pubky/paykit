const pluginConfig = {
  plugins: [
    './test/fixtures/executablePlugin/main',
    './test/fixtures/notExecutablePlugin/main',
    './test/fixtures/notExisingFolder/main'
  ]
}
module.exports = {
  pluginConfig
}
