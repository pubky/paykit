const package = require('./package.json')

module.exports = {
  getmanifest: () => {
    return {
      name: package.name,
      type: "payment",
      description: package.description,
      rpc: [ 'pay', 'start' ],
      events: [ 'watch' ],
    }
  },
  pay: require('./sendPayment.js'),
  watch: require('./watch.js'),
  start: require('./start.js'),
}
