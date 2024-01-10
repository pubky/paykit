# Specification of slashpay

Slashpay abstracts and automates any payment method behind a single, static public key. The public key belongs to a [slashtag instance](https://github.com/synonymdev/slashtags/tree/master/packages/slashtag) and points to a data store containing all supported payment endpoints. Slashpay enables applications where users pay directly to profiles, so offers a very intuitive experience, particularly when multiple payment methods are possible within the system.  

## User story 

Alice wants to receive payment

### Steps for Alice:
1. For each supported payment method Alice creates corresponding payment file and stores under publicly availbable location identified by URL. The content of the file is spcific to the payment method;
2. Generate json index file with keys being names of the previously created payment methods and values refrences to corresponding payment files;
3. Share url to index file with counteparties.

### Steps for Bob:
1. Read index file by URL received from Alice;
2. Select desirable payment method iterating over keys;
3. Read content of the payment file accessing it by refecence (value from the corresponding entry in the index file);
4. Execute payment using details from the contenct ofo correspondig payment file (ln invoice, onchain address etc);
5. In case of a failure try next supported payment method according to personal priorities.

**Note:** __addressing__ and __transport__ schemes are arbitrary with the only requirements that they both must be suppored by each of the payment counterparties.

# Index file

## Public payments:
Default path: `/public/slashpay.json`
Custom paths are supported as well

### Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "paymentEndpoints": {
       "type": "object"
     }
  },
  "required": ["paymentEndpoints"]
}
```

### Template:
```json
{
  "paymentEndpoints": {
      "<payment method name>": "<URL>/public/slashpay/<payment method name>/slashpay.json"
  }
}
```
### Example:
Example from the [PayKit](https://github.com/slashtags/slashpay-solo) reference implementation which uses [SlashURL](https://github.com/slashtags/url) and [Slashtags](https://github.com/slashtags/web-relay) for addressing and transport correspondingly

```json
{
  "paymentEndpoints": {
    "bolt11":"slash:5din1q9wuzzrqfiphtyd4648j6nqgyrnzmuboko1fokbdxh5rj7y/public/slashpay/bolt11/slashpay.json?relay=http://localhost:3000#",
    "onchain":"slash:5din1q9wuzzrqfiphtyd4648j6nqgyrnzmuboko1fokbdxh5rj7y/public/slashpay/onchain/slashpay.json?relay=http://localhost:3000#",
  }
}
```

## Private payments:

### Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "paymentEndpoints": {
       "type": "object"
     }
  },
  "required": ["paymentEndpoints"]
}
```

### Template
```json
{
  "paymentEndpoints": {
    "<payment method name>": "<URL>/slashpay/<random id>/slashpay/<payment method name>/slashpay.json"
  }
}
```
### Example:
Example from the [PayKit](https://github.com/slashtags/slashpay-solo) reference implementation which uses [SlashURL](https://github.com/slashtags/url) and [Slashtags](https://github.com/slashtags/web-relay) for addressing and transport correspondingly
```json
{
  "paymentEndpoints": {
    "bolt11":"slash:5din1q9wuzzrqfiphtyd4648j6nqgyrnzmuboko1fokbdxh5rj7y/slashpay/FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF/slashpay/bolt11/slashpay.json?relay=http://localhost:3000#encryptionKey=ozpcsq7qfcpumobamisgdqunqn4osopbmmiip8y4d6nuuawhiyiy",
    "onchain":"slash:5din1q9wuzzrqfiphtyd4648j6nqgyrnzmuboko1fokbdxh5rj7y/slashpay/FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF/slashpay/onchain/slashpay.json?relay=http://localhost:300#encryptionKey=ozpcsq7qfcpumobamisgdqunqn4osopbmmiip8y4d6nuuawhiyiy"
  }
}
```

# Plugin specific payment file:

The content of the file is arbitrary with only requirement to be written and read by plugin.

## Example for `bolt11` plugin:
```json
{
  "bolt11":"lnbcrt1pj5pn7tpp5c9sv2wjdc8lc3eaj48mjfamy60d6mkpw09nhl0g92dm8gk7kqmsqdqqcqzzsxqr23ssp5ml7jh23fqz94a889uxjludht0pvf9dtxjslsahtwtpd8lzksp2zq9qyyssqm79hxquhzeltvhjm367lzlnx7fck4guemel6httr5hzdncf4uu4hum0v8gtu46kunknqtxzrqjchw5gyn96j43uwwvdtvd5ypwc5cacp9e33v0"
}
```
## Example for `onchain` plugin:
```json
{
  "p2wpkh":"bcrt1q8dmjhwj0ptrfhc6hhnzlmwp0mtlx7x62pxllru"
}
```
