const { Relay } = require('@synonymdev/web-relay')
const PORT = process.env.PORT || 3000

const relay = new Relay()
relay.listen(PORT)
console.log(`relay listening on port ${PORT}`)
