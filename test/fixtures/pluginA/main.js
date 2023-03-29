const sinon = require('sinon')

module.exports = {
  init: sinon.fake(() => {
    return {
      stop: sinon.fake(() => {})
    }
  }),
  getmanifest: sinon.fake(() => {
    return {
      name: 'testA',
      version: '1.0.0',
      rpc: ['foo'],
      events: ['event1', 'event2']
    }
  })
}
