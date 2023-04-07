# Slashpay

## Description 
Slashpay is a method for abstracting and automating any payment process behind a single, static pubkey ("slashtag") which refers to a data store containing all supported payment endpoints.

## Technical Summary
Design approach is similar to core lightning.

### Architecure 
 Slashpay consists of core and plugins. Core is an event emitter service with JSON-RPC2.0 compatible interface. Plugins specify which events they subscribe to. There two possible modes for core to run plugins:
 - js library - required into core module, mainly used for mobile (current implementation)
 - child process - with communication over UNIX sockets (future implementation mainly to be used for server)

#### Core's responsibilities:

- [ ] CRUD operations on hypercore/hyperdrive
- [ ] Business logic for payment media selection process
- [x] Loading and initialization of plugins
- [ ] Handling pass-through via RPC interface for specified plugins methods
- [ ] Subscribing plugins for specified internal events
- [ ] Have a specific “trigger” endpoint for triggering events (may be used for inter-plugin communication)

##### Differences with Core-Lightning:

- Events subscription is similar to core-lightning event notification. There are no hooks functionality now unless it will prove to be necessary.
- There are no cli pass-through for plugins as cli is intended to be using rpc interface

#### Plugin responsibilities:

Plugins can be used also for auxiliary logic implementation like system monitoring 
General plugin responsibilities
- Be executable or "requireable"
- Correctly implement `init`, `getmanifest`, `onEvent` methods
- ...

#### Plugin requirements
- must have `init` method
- must have `getmanifest` method
- must implement all methods mentioned in `rpc`
- must have `onEvent` method in case subscribed to events
- must subscribe to `"serve"` event
- may have `start` method
- may have `stop` method

#### Manifest requirements
Plugin manifest needs to be a JSON object with following fields:
- `name` - a string name of the plugin. It must be unique for all registered plugins. Plugin manager will throw an error and gracefully shutdown all other plugins
- optional `rpc` - an array of strings defining list of RPC endpoints exposed by core for a plugin. Each endpoint will be reachable under `<slashpay server>/plugins/<plugin name>/<rpc method name>`
- optional `events` - an array of string with list of internal core's events to which plugin will be subscribed. If event is not supported Plugin manager will throw an error and gracefully shutdown all other plugins


#### Events and payload
|------|--------|
|Event | Payload|
|------|--------|
|serve | ?      |
|------|--------|
