# Basic slashpay example:

For the first counterparty run
`node index.js <path to config>`


In separate session run with different config file, ideally connected to different lnd node.

Both instances will be ready to receive payments at the url they print after startup:
```
slash:********/public/slashpay.json
```

To make a payment paste counterparty's url in a prompt and add space separated amount in statoshis.

Watch for notification in both stdouts. One for successfully processing of payment order, and another for successful incoming payment starting with 
``
--- notification
```

## Config file example

```javasript
module.exports = {
  plugin: {
    CERT: './tls.cert',
    MACAROON: './admin.macaroon',
    SOCKET: '127.0.0.1:10007',
    SUPPORTED_METHODS: ['bolt11', 'p2wpkh'],
    URL_PREFIX: 'slashpay:'
  },
  db: {
    name: 'db_name',
    path: './db_path'
  }
}
```
