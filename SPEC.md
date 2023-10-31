# Index file

## Public payments:
Default path: `/public/slashpay.json`
Custom paths are supported as well

### Content schema:
```json
{
    "paymentEndpoints": {
        "<payment method name>": "/public/slashpay/<payment method name>/slashpay.json"
    }
}
```
### Content example:
```json
{
    "paymentEndpoints": {
        "bolt11":"/public/slashpay/bolt11/slashpay.json",
        "onchain":"/public/slashpay/onchain/slashpay.json"
    }
}
```

## Private payments (default behaviour if amount is specified):

### Content schema:
```json
{
    "paymentEndpoints": {
        "<payment method name>": "/<random id>/slashpay/<payment method name>/slashpay.json"
    }
}
```
### Content example:
```json
{
    "paymentEndpoints": {
        "bolt11":"/FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF/slashpay/bolt11/slashpay.json",
        "onchain":"/FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF/slashpay/onchain/slashpay.json"
    }
}
```
NOTE: payment receiving mechanism must be aware of the amount in order to verify that received amount matches the expected amount

# Plugin specific payment file:

The content of the file is arbitrary with only requirement to be written and read by plugin.

## Example for `bolt11` plugin:
```json
{
    "bolt11":"lnbcrt1pj5pn7tpp5c9sv2wjdc8lc3eaj48mjfamy60d6mkpw09nhl0g92dm8gk7kqmsqdqqcqzzsxqr23ssp5ml7jh23fqz94a889uxjludht0pvf9dtxjslsahtwtpd8lzksp2zq9qyyssqm79hxquhzeltvhjm367lzlnx7fck4guemel6httr5hzdncf4uu4hum0v8gtu46kunknqtxzrqjchw5gyn96j43uwwvdtvd5ypwc5cacp9e33v0"
}
```
## Example for `p2wpkh` plugin:
```json
{
    "p2wpkh":"bcrt1q8dmjhwj0ptrfhc6hhnzlmwp0mtlx7x62pxllru"
}
```
