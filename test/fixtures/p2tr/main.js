const sinon = require('sinon')

const stopFake = sinon.fake(() => {})
const startFake = sinon.fake(() => {})
const receivePaymentFake = sinon.fake(() => {})
const payFake = sinon.fake(() => {})
const event1Fake = sinon.fake(() => {})
const event2Fake = sinon.fake(() => {})

const instance = {
  stop: stopFake,
  start: startFake,
  receivePayment: receivePaymentFake,
  event1: event1Fake,
  event2: event2Fake, // present but not announced in manifest

  pay: payFake
}

const initFake = sinon.fake(() => instance)
const getManifestFake = sinon.fake(() => {
  return {
    name: 'p2tr',
    version: '1.0.0',
    type: 'payment',
    rpc: ['start', 'stop', 'pay'],
    events: ['receivePayment', 'event1']
  }
})

const resetAll = () => {
  initFake.resetHistory()
  getManifestFake.resetHistory()

  startFake.resetHistory()
  stopFake.resetHistory()
  receivePaymentFake.resetHistory()
  event1Fake.resetHistory()
  event2Fake.resetHistory()
  payFake.resetHistory()
}

instance.resetAll = resetAll

module.exports = {
  init: initFake,
  getmanifest: getManifestFake,
  instance,
  resetAll
}
