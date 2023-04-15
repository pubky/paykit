const sinon = require('sinon')

module.exports = {
  init: sinon.fake(() => {
    return {
      stop: sinon.fake(() => {}),
      start: sinon.fake(() => {}),
      onEvent: sinon.fake(() => {}),
      pay: sinon.fake(() => {})
    }
  }),
  getmanifest: sinon.fake(() => {
    return {
      name: 'p2tr',
      version: '1.0.0',
      type: 'payment',
      rpc: ['start', 'stop', 'pay'],
      events: ['watch', 'event1']
    }
  })
}
