const sinon = require('sinon')

const stopFake = sinon.fake(() => {})
const onEventFake = sinon.fake(() => {})
const payFake = sinon.fake(() => {})
const updatePaymentFake = sinon.fake(() => {})

const instance = {
  stop: stopFake,
  onEvent: onEventFake,
  pay: payFake,
  updatePayment: updatePaymentFake
}

const initFake = sinon.fake(() => instance)
const getManifestFake = sinon.fake(() => {
  return {
    name: 'p2sh',
    version: '1.0.0',
    type: 'payment',
    rpc: ['stop', 'pay', 'updatePayment'],
    events: ['watch', 'event1', 'event2']
  }
})

const resetAll = () => {
  initFake.resetHistory()
  getManifestFake.resetHistory()

  stopFake.resetHistory()
  onEventFake.resetHistory()
  payFake.resetHistory()
  updatePaymentFake.resetHistory()
}

instance.resetAll = resetAll

module.exports = {
  init: initFake,
  getmanifest: getManifestFake,
  instance,
  resetAll
}
