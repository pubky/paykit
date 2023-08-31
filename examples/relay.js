const { Relay } = require('@synonymdev/web-relay')
const relay = new Relay()
relay.listen(3000)
console.log('relay listening on port 3000')
