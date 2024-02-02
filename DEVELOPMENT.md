# Development

## Installation

1. Clone the repository

```shell
git clone git@github.com:slashtags/paykit.git && cd paykit
```

2. Switch Node version

Switch to the Node.js version defined in `.node-version`. You can visit [.node-version File Usage](https://github.com/shadowspawn/node-version-usage) and use one of these methods to change the node version you need.

3. Install dependencies

```shell
npm install
```

## Testing

### 1. Unit tests

```shell
npm run test
```

### 2. Manual End-to-end

1. Create a config file, following the structure of `examples/config.example.js`.
2. For local development start a relay
```shell
node examples/relay.js
```
or use external

3. Start a paykit service and follow the instructions:
```shell
node examples/index.js ./config.js
```
