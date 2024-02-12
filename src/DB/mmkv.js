const MMKVModule = require("nodejs-mmkv");
const path = require("path");

const mmkv = new MMKVModule({
  // TODO: config
  id: "com.node.mmkv",
  rootDir: path.join(__dirname, "./mmkv"),
  encryptionKey: "nodejs-mmkv",
});

async savePayment(payment, execute = true) {
  const key = `outgoing_payment_${payment.id}`;
  const value = JSON.stringify(payment);
  if (execute) {
    await mmkv.set(key, value);
  }
  return { key, value };
}

async getPayment (id, opts = { removed: false }) {
  const key = `outgoing_payment_${id}`;
  const value = await mmkv.get(key);
  return JSON.parse(value);
}

async getOutgoingPayments (opts = {}) {
  const keys = await mmkv.keys();
  const payments = [];
  for (const key of keys) {
    if (key.startsWith("outgoing_payment_")) {
      const value = await mmkv.get(key);
      payments.push(JSON.parse(value));
    }
  }
  return payments;
}

async updatePayment (id, update, execute = true) {
  const payment = await this.getPayment(id);
  const updatedPayment = { ...payment, ...update };
  if (execute) {
    await this.savePayment(updatedPayment);
  }
  return updatedPayment;
}

async saveIncomingPayment (payment, execute = true) {
  const key = `incoming_payment_${payment.id}`;
  const value = JSON.stringify(payment);
  if (execute) {
    await mmkv.set(key, value);
  }
  return { key, value };
}

async getIncomingPayment (id, opts = { removed: false }) {
  const key = `incoming_payment_${id}`;
  const value = await mmkv.get(key);
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
  const keys = await mmkv.keys();
  const payments = [];
  for (const key of keys) {
    if (key.startsWith("incoming_payment_")) {
      const value = await mmkv.get(key);
      payments.push(JSON.parse(value));
    }
  }
  return payments;
}

async saveOrder (order, execute = true) {
  const key = `order_${order.id}`;
  const value = JSON.stringify(order);
  if (execute) {
    await mmkv.set(key, value);
  }
  return { key, value };
}

async getOrder (id, opts = { removed: false }) {
  const key = `order_${id}`;
  const value = await mmkv.get(key);
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
