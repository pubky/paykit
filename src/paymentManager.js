class PaymentManager {
  constructor(config) {
    this.pluginManager = new PluginManager();
    this.config = config;
    this.db = new Database(config.db);
  }

  async sendPayment(paymentObject) {
    const paymentFactory = new PaymentFactory(this.db);
    const payment = await paymentFactory.getOrCreate(paymentObject);

    const paymentSender = new PaymentSender(this.pluginManager, payment, this.db, this.entryPointForPlugin);

    await paymentSender.submit();
  }

  async receivePayments() {
    const paymentReceiver = new PaymentReceiver(this.pluginManager, this.db, this.entryPointForPlugin);

    await paymentReceiver.init();
  }

  async entryPointForPlugin(payload) {
    console.log(payload);
    if (payload.state === 'waitingForClient') {
      this.askClient(payload);
      return
    }

    if (payload.state === 'newPayment') {
      this.db.createIncomingPayment(payload);
    }
  }

  async entryPointForUser(data) {
    const paymentFactory = new PaymentFactory(this.db);
    const payment = await paymentFactory.getOrCreate(paymentObject);

    const paymentSender = new PaymentSender(this.pluginManager, payment, this.db, this.entryPointForPlugin);
    await paymentSender.forward(data);
  }

  async askClient(payment) {
    console.log('askClient', payment)
  }
}
