const MMKVModule = require("./mmkv");
const path = require("path");

class DB {
  constructor (config = {}) {
    if (!config) throw new Error(ERROR.CONFIG_MISSING)
    if (!config.name) throw new Error(ERROR.DB_NAME_MISSING)
    if (!config.path) throw new Error(ERROR.DB_PATH_MISSING)

    this.db = new MMKVModule({
      id: config.name,
      rootDir: config.path,
    });
  }


  async saveOutgoingPayment(payment, execute = true) {
    const key = `outgoing_payment_${payment.id}`;
    const value = JSON.stringify(payment);
    if (execute) {
      await this.db.setString(key, value);
    }
    return { key, value };
  }

  async getOutgoingPayment (id, opts = { removed: false }) {
    const key = `outgoing_payment_${id}`;
    let value = await this.db.getString(key);
    if (!value) return null;
    value = JSON.parse(value);

    const returnRemoved = (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1')
    const returnNotRemoved = (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0')
    const returnAll = opts.removed === '*'

    let res
    if (returnRemoved) {
      if (!value.removed) return null;
      res = value;
    } else if (returnNotRemoved) {
      if (value.removed) return null;
      res = value;
    } else if (returnAll) {
      res = value;
    } else {
      throw new Error(`Invalid option: ${opts.removed}`);
    }

    delete value.removed
    return value;
  }

  async getOutgoingPayments (opts = {}) {
    const keys = await this.db.getKeys();
    const payments = [];

    const getRemoved = (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') 
    const getAll = opts.removed === '*'

    for (const key of keys) {
      if (key.startsWith("outgoing_payment_")) {
        let value = await this.db.getString(key);
        if (!value) continue;
        value = JSON.parse(value);
        if (getRemoved && !value.removed) continue;
        if (!getAll && value.removed) continue;
        payments.push(value);
      }
    }
    return payments;
  }

  async updateOutgoingPayment (id, update, execute = true) {
    const payment = await this.getOutgoingPayment(id);
    const updatedPayment = { ...payment, ...update };
    if (execute) {
      await this.saveOutgoingPayment(updatedPayment);
    }
    return updatedPayment;
  }

  async saveIncomingPayment (payment, execute = true) {
    const key = `incoming_payment_${payment.id}`;
    const value = JSON.stringify(payment);
    if (execute) {
      await this.db.setString(key, value);
    }
    return { key, value };
  }

  async getIncomingPayment (id, opts = { removed: false }) {
    const key = `incoming_payment_${id}`;
    let value = await this.db.getString(key);
    if (!value) return null;
    value = JSON.parse(value);

    if (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') {
      if (!value.removed) return null;
      return value;
    } else if (opts.removed === false || opts.removed === 'false' || opts.removed === 0 || opts.removed === '0') {
      if (value.removed) return null;
      return value;
    } else if (opts.removed === '*') {
      return value;
    } else {
      throw new Error(`Invalid option: ${opts.removed}`);
    }
    return JSON.parse(value);
  }

  async updateIncomingPayment (id, update, execute = true) {
    const payment = await this.getIncomingPayment(id);
    const updatedPayment = { ...payment, ...update };
    if (execute) {
      await this.saveIncomingPayment(updatedPayment);
    }
    return updatedPayment;
  }

  async getIncomingPayments (opts = {}) {
    const keys = await this.db.getKeys();
    const payments = [];

    const getRemoved = (opts.removed === true || opts.removed === 'true' || opts.removed === 1 || opts.removed === '1') 
    const getAll = opts.removed === '*'

    for (const key of keys) {
      if (key.startsWith("incoming_payment_")) {
        let value = await this.db.getString(key);
        if (!value) continue;
        value = JSON.parse(value);
        if (getRemoved && !value.removed) continue;
        if (!getAll && value.removed) continue;
        payments.push(value);
      }
    }
    return payments;
  }

  async saveOrder (order, execute = true) {
    const key = `order_${order.id}`;
    const value = JSON.stringify(order);
    if (execute) {
      await this.db.setString(key, value);
    }
    return { key, value };
  }

  async getOrder (id, opts = { removed: false }) {
    const key = `order_${id}`;
    const value = await this.db.getString(key);
    return JSON.parse(value);
  }

  async updateOrder (id, update, execute = true) {
    const order = await this.getOrder(id);
    const updatedOrder = { ...order, ...update };
    if (execute) {
      await this.saveOrder(updatedOrder);
    }
    return updatedOrder;
  }
}

module.exports = { DB }
