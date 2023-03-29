const sinon = require('sinon')

module.exports = {
  init: sinon.fake(() => {
    return {
      stop: sinon.fake(() => {})
    }
  }),
  getmanifest: sinon.fake(() => {
    return {
      name: 'testB',
      version: '1.0.0',
      rpc: ['foo', 'bar'],
      events: ['event1']
    }
  })
}
