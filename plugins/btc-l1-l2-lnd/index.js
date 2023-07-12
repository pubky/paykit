const pack = require('./package.json')

module.exports = {
  getmanifest: () => {
    return {
      name: pack.name,
      type: 'payment',
      description: pack.description,
      rpc: ['pay', 'start'],
      events: ['watch']
    }
  },
  pay: require('./sendPayment.js'),
  watch: require('./watch.js'),
  start: require('./start.js')
}
