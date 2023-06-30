const sinon = require('sinon')

const stopFake = sinon.fake(() => {})
const startFake = sinon.fake(() => {})
const onEventFake = sinon.fake(() => {})
const payFake = sinon.fake(() => {})

const instance = {
  stop: stopFake,
  start: startFake,
  onEvent: onEventFake,
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
  onEventFake.resetHistory()
  payFake.resetHistory()
}

instance.resetAll = resetAll

module.exports = {
  init: initFake,
  getmanifest: getManifestFake,
  instance,
  resetAll
}
