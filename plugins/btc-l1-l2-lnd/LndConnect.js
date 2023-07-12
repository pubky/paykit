const lns = require('ln-service')
const uuid = require('uuid') // may not work with bear
const Bottleneck = require('bottleneck') // may not work with bear
const path = require('path') // may not work with bear
const url = require('url') // may not work with bear
const fs = require('fs')

const config = require('./config.js')

const toB64 = (path) => fs.readFileSync(path, { encoding: 'base64' })

class LndConnect {
  constructor (config) {
    const { lnd } = lns.authenticatedLndGrpc({
      cert: toB64(config.CERT),
      macaroon: toB64(config.MACAROON),
      socket: config.SOCKET
    })

    const limiter = new Bottleneck({
      maxConcurrent: 5,
      minTime: 1000
    })

    this.lnd = lnd
    this.limiter = limiter
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
   * @param {number} tokens
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
  async payInvoice ({ request }) {
    // TODO some extra magic
    await lns.pay({ lnd: this.lnd, request })

    return { error: '', data: request, id: 'some id' }
  }

  /**
   * Sends on-chain funds to a specified address
   * @param {string} address - address to send funds to
   * @param {number} tokens - amount of tokens to send
   * @returns {Promise<{ error: boolean, data: object, id: string }>}
   */
  async sendOnChainFunds ({ address, tokens }) {
    await lns.sendToChainAddress({ address, lnd: this.lnd, tokens })
    return { error: '', data: { address, tokens }, id: 'some id' }
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
      // TODO: Ensure the proper amount has been received.
      if (data?.received > 0) {
        const receipt = {
          orderId: uuid.v4(),
          data: {
            id: data?.id,
            sats: data?.received,
            description: data?.description
          },
          error: !data,
          timestamp: new Date().toISOString()
        }
        callback(receipt)
        console.log('\nReceipt:', receipt)
        console.log('\n')

        // const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
        // Save the receipt to receipts.json
        // saveReceipt({ ...receipt, data }, __dirname)

        sub.abort()
      }
    })
  };

  async subscribeToAddress (address = '', addressType = 'bech32', callback) {
    if (addressType === 'p2wpkh') addressType = 'bech32'
    const sub = lns.subscribeToChainAddress({
      lnd: this.lnd,
      [`${addressType}_address`]: address,
      min_height: 1,
      min_confirmations: 0
    })
    sub.on('confirmation', (data) => {
      const receipt = {
        orderId: uuid.v4(),
        error: !data,
        data: data?.transaction,
        timestamp: new Date().toISOString()
      }
      callback(receipt)
      // Save the receipt to receipts.json
      // const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
      // saveReceipt({ ...receipt, data }, __dirname)
      sub.abort()
    })
  }

  methodIsSupported (method) {
    return config.SUPPORTED_METHODS.includes(method)
  }

  getSupportedMethods (methods) {
    return methods.filter((method) => this.methodIsSupported(method))
  }

  async runMethod (method, data) {
    let response = { error: true, data: 'No supported payment method is available.', id: '' }
    if (!method) return response
    switch (method) {
      case 'bolt11':
        response = await this.limiter.schedule(() => this.generateInvoice({ tokens: Number(data.amount), description: data.description }))
        break
      case 'p2wpkh':
      case 'p2sh':
      case 'p2pkh':
        response = await this.limiter.schedule(() => this.generateAddress(method))
        break
      default:
        break
    }
    return { method, ...response }
  }

  /**
   * Runs the subscribe method based on the method type.
   * @param method
   * @param id
   * @param callback
   * @returns {Promise<{data: string, error: boolean}>}
   */
  async runSubscribe (method, id, callback) {
    const data = { error: true, data: 'No supported payment method is available.' }
    if (!method) return data
    switch (method) {
      case 'bolt11':
        await this.limiter.schedule(() => this.subscribeToInvoice(id, callback))
        break
      case 'p2wpkh':
      case 'p2sh':
      case 'p2pkh':
        await this.limiter.schedule(() => this.subscribeToAddress(id, method, callback))
        break
      default:
        break
    }
  }
  // /**
  //  * Save a receipt to the receipts.json file in the specified path.
  //  * @param receipt
  //  * @param filePath
  //  * @returns {Promise<void>}
  //  */
  // async saveReceipt (receipt, filePath) {
  //   const receiptPath = path.join(filePath, 'receipts.json') // Adjust the path as necessary
  //   let receipts = []
  //   try {
  //     if (fs.existsSync(receiptPath)) {
  //       const existingReceipts = fs.readFileSync(receiptPath, { encoding: 'utf-8' })
  //       if (existingReceipts.trim() === '') {
  //         receipts = []
  //       } else {
  //         receipts = JSON.parse(existingReceipts)
  //       }
  //     }
  //   } catch (err) {
  //     console.error('Error reading existing receipts: ', err)
  //   }
  //   receipts.push(receipt)
  //   try {
  //     fs.writeFileSync(receiptPath, JSON.stringify(receipts, null, 2))
  //   } catch (err) {
  //     console.error('Error writing receipts: ', err)
  //   }
  // }
}

module.exports = { LndConnect } 
