const sinon = require('sinon')

module.exports = {
  init: sinon.fake(() => {
    return {
      stop: sinon.fake(() => {}),
      start: sinon.fake(() => {}),
      onEvent: sinon.fake(() => {})
    }
  }),
  getmanifest: sinon.fake(() => {
    return {
      name: 'testB',
      version: '1.0.0',
      rpc: ['start', 'stop'],
      events: ['watch', 'event1']
    }
  })
}
