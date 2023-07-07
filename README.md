# Slashpay

Slashpay is a method for abstracting and automating any payment process behind a single, static pubkey ("slashtag") which refers to a data store containing all supported payment endpoints. Internally system consists of [core](#core) and [plugins](#plugins), see [diagram](#collaboration-diagram) for more details on internal system interaction.

## API
TODO: describe initialization etc after adding server and lib modes

```javascript
const notificationCallback = console.log
const slashpay = new Slashpay(notificationCallback)
const paymentOrder = await slashpay.createPaymentOrder({
  clientOrderId: '<unique id>'
  amount: '<sting amount, defaults to sats>'
  counterparyURL: '<slashtags url to the drive o to the slashpay json>'
})

await slashpay.sendPayment(paymentOrder.id)

const url = await slashpay.receivePayments()
// TODO: add more
```


## Core
The core consists of:
### Business logic classes:
- `PaymentManager` - facade class which exposes business logic to user and plugins;
- `PaymentReceiver` - class responsible for enabling receiving of payments via registered plugins;
- `PaymentSender` - class responsible for creation and sending of orders;
- `PaymentOrder` - class responsible for maintaining single payment or collection of payments in the case of subscriptions;
- `Payment` - class responsible for persitent data handling in local storage as well as on slashtags;
- `PaymentAmount` - class responsible for abstracting currency and denomination specific logic;
- `PaymentState` - class responsible for state management of a payment;
- `PluginManager` - class responsible loading and communication with plugins.

### Auxilary classes:
- `DatabaseConnector` - pseudo ORM for connection with Sqlite storage for managing internal state;
- `SlashtagsConnector` - class for abstracting away CRUD operations over slashtags.

## Plugins
Plugins can be used also for auxiliary logic implementation like system monitoring. General plugin responsibilities:
- must be loadable with `require`;
- must implement `async init()` method responsible for plugin initialization;
- must implement `async getmanifest()` method, see [manifest](#plugin-manifest).

### Plugin manifest
JSON object returned via `async getmanifest()` method. Returning data must be a valid JSON object with following keys:
- string `name` - required unique name of the plugin in scope of slashpay instance;
- string `type` - value (so far supported type is `"payment"`);
- optional array of strings `rpc` - mapping name of the command to function, see [rpc](#rpc-methods);
- optional array of strings `events` - mapping name of command to function, see [events](#events).

#### RPC methods
Plugin methods to be called by core in a unicast manner:
- may implement `stop()` method which would be invoked for graceful shutdown of the plugin;
- type `payment` requires implementation of methods:
  - `pay(<payment object>, <callback>)` - method responsible for invocation of logic for submitting payment, see [payment](#payment) and [callback](#feedback-communication).

#### Events
Plugin methods to be called by core in a multicast manner:
`events` - optional array of strings. Different types of plugins require implementation of different RPC methods.
Type `payment` requires implementation of "watch" event listener:
 - `receivePayments({ notificationCallback, amount })` - method responsible for invocation of logic for initialization of receiving payments, see [amount](#amount) and [notification callback](#feedback-communication).

#### Data objects

##### Payment
Payment - is a JSON object of following structure:
- `id` - unique string identified of payment;
- `orderId` - uniqye string identifier of corresponding payment order;
- `counterpartyURL` - string slashtags key (if path is not specified plugin should default to `/public/slashpay/<plugin name>/slashpay.json`);
- `memo` - strig memo - payment reference specified by payee;
- `amount` - string amount. Value is specified in given denomination;
- `denomination` - string denomination of the specified amount. Allowed values are either "BASE" or "MAIN";
- `currency` - string curency code in ISO3166-1 Alpha3 format.

##### Amount
- `amount` - string amount. Value is specified in given denomination;
- `denomination` - string denomination of the specified amount. Allowed values are either "BASE" or "MAIN";
- `currency` - string curency code in ISO3166-1 Alpha3 format.

#### Feedback communication
Callback - function which accepts single parameter and responsible for feedback communication. The payload may contain property `type` with string following values:
- `payment_new` - will:
  - update internal core's state if payload is a valid payment object;
  - send notification to user;
- `payment_update` - will:
  - update internal state for payment which is currently in process by plugin. Supported states are:
    - `failed` - will mark current plugins attempt to make a payment as failed and ask next plugin in pipeline to process this payment;
    - `success` - will mark current payment as successfully completed by a plugin;
    - default - treats update as a intermediary state update which requires action from user. User's action will be forwarded to user and their update will be forwarded to plugin via invocation of plugins' PRC method `updatePayment` with data;
  - send notification to user;
- `payment_order_completed`;
  - mark payment as completed;
  - send notification to user;
- default - forward to user.


## Collaboration diagram

### Creating Payment
Diagram which describes inner workings of the payment creation process
<p align="center">
  <img alt="diagram_create" src="./docs/create.png"></img>
</p>

### Sending Payment
Diagram which describes inner workings of the payment sending process
<p align="center">
  <img alt="diagram_send" src="./docs/send.png"></img>
</p>

### Receiving Payment
Diagram which describes inner workings of the payment receiving process
<p align="center">
  <img alt="diagram_receive" src="./docs/receive.png"></img>
</p>

# Other resources

For more details information refer to:
- [source code](./src/)
- [core unit tests](./test/payments/)
- [end-to-end tests](./test/e2e/)
- [examples](./examples/)
- [type definitions](./types/)
- [test fixtures](./test/fixtures)
