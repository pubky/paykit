const sinon = require('sinon')

const stopFake = sinon.fake(() => {})
const receivePayment = sinon.fake(() => {})
const payFake = sinon.fake(() => {})
const updatePaymentFake = sinon.fake(() => {})
const event1Fake = sinon.fake(() => {})
const event2Fake = sinon.fake(() => {})

const instance = {
  stop: stopFake,
  receivePayment,
  pay: payFake,
  updatePayment: updatePaymentFake,
  event1: event1Fake,
  event2: event2Fake
}

const initFake = sinon.fake(() => instance)
const getManifestFake = sinon.fake(() => {
  return {
    name: 'p2sh',
    version: '1.0.0',
    type: 'payment',
    rpc: ['stop', 'pay', 'updatePayment'],
    events: ['receivePayment', 'event1', 'event2']
  }
})

const resetAll = () => {
  initFake.resetHistory()
  getManifestFake.resetHistory()

  stopFake.resetHistory()
  receivePayment.resetHistory()
  payFake.resetHistory()
  updatePaymentFake.resetHistory()
  event1Fake.resetHistory()
  event2Fake.resetHistory()
}

instance.resetAll = resetAll

module.exports = {
  init: initFake,
  getmanifest: getManifestFake,
  instance,
  resetAll
}
