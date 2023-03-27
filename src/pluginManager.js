import assert from 'node:assert/strict'

class PluginManager {
  constructor(config) {
    this.plugins = {}
    this.config = config

    if (!config.plugins) {
      return
    }

    config.plugins.forEach((pluginEntryPoint) => {
      const stat = fs.statSync(pluginEntryPoint)
      assert.equal(
        (stat.mode & parseInt('777', 8)).toString(8)[0],
        '7',
        'Plugin entry point must be executable'
      )
    })
  }

  // Load a plugin with runtime by path to the entry point
  async loadPlugin(pluginEntryPoint) {
    const module = await import(pluginEntryPoint)
    const plugin = await module.init()
    const manifestRes = await plugin.getmanifest()
    const manifest = await this.parseManifestRes(manifestRes)

    if (this.plugins[manifest.name]) await this.gracefulThrow(new Error('Conflicting plugin names'))
    
    this.plugins[manifest.name] = {
      // exposed RPC methods
      // subscribed events
      ...manifest,
      plugin,
      active: true
    }

    return plugin
  }

  // Disable a plugin by calling its "stop" method
  async deactivatePlugin(name) {
    if (typeof this.plugins[name].plugin.stop === 'function') {
      await this.plugins[name].plugin.stop()
    }
    this.plugins[name].active = false
  }

  // Enable a plugin by calling its "enable" method
  async activatePlugin(name) {
    if (typeof this.plugins[name].plugin.start === 'function') {
      await this.plugins[name].plugin.start()
    }
    this.plugins[name].active = true
  }

  // Unload a plugin by removing it from the map of plugins
  async removePlugin(name) {
    if (this.plugins[name].active) await this.gracefulThrow(new Error('Can not remove active plugin'))

    delete this.plugins[name]
  }

  // Get a map of all loaded plugins
  getPlugins() {
    return this.plugins;
  }

  async parseManifestRes(manifestRes) {
    let res
    try {
      res = JSON.parse(manifestRes.body)
    } catch (e) {
      await this.gracefulThrow(new Error(`Manifest [parsing]: ${e}`))
    }

    await this.validateManifest(res)
    return res
  }

  async validateManifest(manifest) {
    let msg = 'Manifest [validation]:'
    try {
      this.validateName(manifest, msg)
      this.validateRPC(manifest, msg)
      this.validateEvents(manifest, msg)
    } catch(e) {
      await this.gracefulThrow(e)
    }
  }

  validateName(manifest, msg) {
    assert(manifest.name, `${msg} plugin name missing`)
  }

  validateRPC(manifest, msg) {
    if (!manifest.rpc) {
      return
    }

    assert(Array.isArray(manifest.rpc), `${msg} RPC is not an array`)
    manifest.rpc.forEach(rpc => assert(
      typeof rpc === 'string',
      `${msg} RPC method "${rpc}" is not a string`)
    )
  }

  validateEvents(manifest, msg) {
    if (!manifest.events) {
      return
    }

    assert(Array.isArray(manifest.events), `${msg} events is not an array`)
    manifest.events.forEach(event => {
      let m = `${msg} event "${event}" `
      assert(typeof event === 'string', `${m}" is not a string`)
      assert(this.config.events.includes(event), `${m} is not supported`)
    })
  }

  async gracefulThrow(error) {
    for (let name in this.plugins) {
      await this.deactivatePlugin(name)
    }

    throw error
  }
}
