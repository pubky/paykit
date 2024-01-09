const lns = require('ln-service')
const fs = require('fs')
const bitcoinJs = require('bitcoinjs-lib')

const toB64 = (path) => fs.readFileSync(path, { encoding: 'base64' })

class LndConnect {
  constructor (config) {
    const { lnd } = lns.authenticatedLndGrpc({
      cert: toB64(config.CERT),
      macaroon: toB64(config.MACAROON),
      socket: config.SOCKET
    })

    this.lnd = lnd
    this.config = config
  }

  /**
   * Returns wallet info from the lightning node.
   * @returns {Promise<{ data: any, id: string, error: boolean }>}
   */
  async getWalletInfo () {
    try {
      const res = await lns.getWalletInfo({ lnd: this.lnd })
      if (res) return { error: false, data: res, id: '' }
      return { error: true, data: 'Error retrieving wallet info.', id: '' }
    } catch (e) {
      return { error: true, data: e, id: '' }
    }
  };

  /**
   * Generates a bolt11 invoice from the lightning node.
   * @param {number} [tokens]
   * @param {string} description
   * @returns {Promise<{ error: boolean, data: string, id: string }>}
   */
  async generateInvoice ({ tokens, description }) {
    const getChannelsResponse = await lns.getChannels({ lnd: this.lnd })
    const channels = getChannelsResponse.channels

    const routingHints = []
    const channelInfoPromises = channels.map(channel =>
      lns.getChannel({ lnd: this.lnd, id: channel.id }).then(channelInfo => {
        const policy = channelInfo.policies.find(policy => policy.public_key === channel.partner_public_key)
        routingHints.push({
          channel: channelInfo.id,
          node: channel.partner_public_key,
          base_fee_mtokens: policy.base_fee_mtokens,
          fee_rate: policy.fee_rate,
          cltv_delta: channel.local_csv,
          min_htlc_mtokens: channel.local_min_htlc_mtokens
        })
      })
    )
    await Promise.all(channelInfoPromises)

    const invoice = await lns.createInvoice({ lnd: this.lnd, tokens, description, routes: [routingHints] })

    const error = !invoice?.request
    const data = invoice?.request ?? 'Unable to retrieve an invoice at this time.'
    const id = error ? '' : invoice?.id
    return { error, data, id }
  }

  /**
   * Pays a bolt11 invoice from the lightning node.
   * @param {string} invoice
   * @returns {Promise<{ error: boolean, data: string, id: string }>}
   */
  async payInvoice ({ request, tokens }) {
    try {
      const decoded = await lns.decodePaymentRequest({ lnd: this.lnd, request })
      let res
      if (decoded.tokens) {
        res = await lns.pay({ lnd: this.lnd, request })
      } else {
        res = await lns.pay({ lnd: this.lnd, request, tokens })
      }

      return { error: '', data: res, id: res.id }
    } catch (error) {
      return { error, data: '', id: '' }
    }
  }

  /**
   * Sends on-chain funds to a specified address
   * @param {string} address - address to send funds to
   * @param {number} tokens - amount of tokens to send
   * @returns {Promise<{ error: boolean, data: object, id: string }>}
   */
  async sendOnChainFunds ({ address, tokens }) {
    try {
      const res = await lns.sendToChainAddress({ address, lnd: this.lnd, tokens })
      return { error: '', data: res, id: res.id }
    } catch (error) {
      return { error, data: '', id: '' }
    }
  }

  /**
   * Returns a new address from the lightning node.
   * @param {'p2wpkh' | 'p2sh' | 'p2pkh'} format
   * @returns {Promise<{ error: boolean, data: string, id: string }>}
   */
  async generateAddress (format = 'p2wpkh') {
    const { address } = await lns.createChainAddress({ format, lnd: this.lnd })
    const error = !address
    const data = !address ? 'Unable to retrieve an address at this time.' : address
    return { error, data, id: data }
  }

  async subscribeToInvoice (invoiceIdHexString, callback) {
    const sub = lns.subscribeToInvoice({ id: invoiceIdHexString, lnd: this.lnd })
    sub.on('invoice_updated', (data) => {
      if (data?.received > 0) {
        const receipt = {
          data,
          error: !data,
          timestamp: new Date().toISOString()
        }
        callback(receipt)

        sub.destroy()
      }
    })
  };

  subscribeToAddress (address = '', addressType = 'bech32', callback) {
    if (addressType === 'p2wpkh') addressType = 'bech32'

    const sub = lns.subscribeToChainAddress({
      lnd: this.lnd,
      [`${addressType}_address`]: address,
      min_height: 1,
      min_confirmations: 0
    })
    sub.once('confirmation', (data) => { // 1conf
      const receipt = {
        error: !data,
        data,
        timestamp: new Date().toISOString()
      }
      const tx = bitcoinJs.Transaction.fromHex(data.transaction)
      tx.outs.forEach((out) => {
        try {
          if (bitcoinJs.address.fromOutputScript(out.script, bitcoinJs.networks.regtest) !== address) return
          if (!receipt.data.amount) receipt.data.amount = 0

          receipt.data.amount += out.value
        } catch (e) {}
      })
      callback(receipt)
      // sub.destroy() - not a function :(
    })
  }

  methodIsSupported (method) {
    return this.config.SUPPORTED_METHODS.includes(method)
  }

  getSupportedMethods (methods) {
    return methods.filter((method) => this.methodIsSupported(method))
  }
}

module.exports = { LndConnect }
