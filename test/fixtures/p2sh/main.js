const sinon = require('sinon')

const instance = {
  stop: sinon.fake(() => {}),
  onEvent: sinon.fake(() => {}),
  pay: sinon.fake(() => {}),
  updatePayment: sinon.fake(() => {})
}

function resetAll() {
  instance.stop.resetHistory()
  instance.onEvent.resetHistory()
  instance.pay.resetHistory()
  instance.updatePayment.resetHistory()
}

module.exports = {
  init: sinon.fake(() => instance),
  getmanifest: sinon.fake(() => {
    return {
      name: 'p2sh',
      version: '1.0.0',
      type: 'payment',
      rpc: ['stop', 'pay', 'updatePayment'],
      events: ['watch', 'event1', 'event2']
    }
  }),
  instance,
  resetAll
}
