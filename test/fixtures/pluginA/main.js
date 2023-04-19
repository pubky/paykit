const sinon = require('sinon')

module.exports = {
  init: sinon.fake(() => {
    return {
      stop: sinon.fake(() => {}),
      onEvent: sinon.fake(() => {}),
      pay: sinon.fake(() => {})
    }
  }),
  getmanifest: sinon.fake(() => {
    return {
      name: 'testA',
      version: '1.0.0',
      type: 'payment',
      rpc: ['stop', 'pay'],
      events: ['watch', 'event1', 'event2']
    }
  })
}
