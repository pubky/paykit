# Slashpay

## Description 
Slashpay is a method for abstracting and automating any payment process behind a single, static pubkey ("slashtag") which refers to a data store containing all supported payment endpoints.

### Architecure 
 Slashpay consists of core and plugins.

#### Core's responsibilities:

The core consists of:

##### Business logic:
- `PaymentManager` - facade class which exposes business logic to user and plugins
- `PaymentReceiver` - class responsible for enabling receiving of payments via registered plugins
- `PaymentSender` - class responsible for creation and sending of orders
- `PaymentOrder` - class responsible for maintaining single payment or collection of payments in the case of subscriptions
- `Payment` - class responsible for persitent data handling in local storage as well as on slashtags
- `PaymentAmount` - class responsible for abstracting currency and denomination specific logic
- `PaymentState` - class responsible for state management of a payment
- `PluginManager` - class responsible loading and communication with plugins

##### Auxilary classes:
- `DatabaseConnector` - pseudo ORM for connection with Sqlite storage for managing internal state
- `SlashtagsConnector` - class for abstracting away CRUD operations over slashtags

#### Notes on Plugins
Plugins can be used also for auxiliary logic implementation like system monitoring 
General plugin responsibilities:
- must be loadable with `require`;
- must implement `async init()` method responsible for plugin initialization;
- must implement `getmanifest()` method;
  - returning data must be a valid JSON object with following keys:
    - `name` - required unique name of the plugin in scope of slashpay instance
    - `type` - value `"payment"`
    - `rpc` - optional object mapping name of the command to function. This function will be invoked by core in a unicast manner. Different types of plugins require implementation of different RPC methods:
      - may implement `start()` method which would be invoked after `init` and before everyting else
      - may implement `stop()` method which would be invoked for graceful shutdown of the plugin
      - type `payment` requires implementation of methods:
        - `pay(<payment>, <callback>)` - method responsible for invocation of logic for submitting payment
          - Payment - is a JSON object of following structure:
            - `id` - unique string identified of payment
            - `orderId` - uniqye string identifier of corresponding payment order
            - `counterpartyURL` - string slashtags key (if path is not specified plugin should default to `/public/slashpay/<plugin name>/slashpay.json`)
            - `memo` - strig memo - payment reference specified by payee
            - `amount` - string amount. Value is specified in given denomination
            - `denomination` - string denomination of the specified amount. Allowed values are either "BASE" or "MAIN"
            - `currency` - string curency code in ISO3166-1 Alpha3 format
          - Callback - function which accepts single parameter and responsible for feedback communication. The format of the input object:
            - `type` 
              - 'payment_new' - will:
                - update internal core's state if payload is a valid payment object
                - send notification to user
              - 'payment_update' - will
                - update internal state for payment which is currently in process by plugin. Supported states are:
                  - `failed` - will mark current plugins attempt to make a payment as ailed and ask next plugin in pipeline to process this payment
                  - `success` - will mark current payment as successfully completed by a plugin
                  - default - treats upate as a intermediary state update which requires action from user. User's action will be forwarded to user and their update will be forwarded to plugin via invocation of plugins' PRC method `updatePayment` with data
                - send notification to user
              - 'payment_order_completed'
              - default - forward to user
    - `events` - optional array of strings. Each string should correspond to function that will be invoked by core in a multicast manner. Different types of plugins require implementation of different RPC methods:
      - type `payment` requires implementation of "watch":
        - `receivePayments` - method responsible for invocation of logic for initialization of receiving payments. The payload forwarded to plugin with this event has following format:
        - `notificationCallback` - entry point of core for plugins to send data to. The data must be JSON object with following properties
            - `type` 
              - 'payment_new' - will:
                - update internal core's state if payload is a valid payment object
                - send notification to user
              - 'payment_update' - will
                - update internal state for payment which is currently in process by plugin. Supported states are:
                  - `failed` - will mark current plugins attempt to make a payment as ailed and ask next plugin in pipeline to process this payment
                  - `success` - will mark current payment as successfully completed by a plugin
                  - default - treats upate as a intermediary state update which requires action from user. User's action will be forwarded to user and their update will be forwarded to plugin via invocation of plugins' PRC method `updatePayment` with data
                - send notification to user
              - 'payment_order_completed'
              - default - forward to user
        - `amount` - optional JSON object with following properties:
          - `amount` - string amount. Value is specified in given denomination
          - `denomination` - string denomination of the specified amount. Allowed values are either "BASE" or "MAIN"
          - `currency` - string curency code in ISO3166-1 Alpha3 format
