/* eslint-disable no-else-return,allow-parens,consistent-return */
const Q = require('q');
const { messages } = require('elasticio-node');

// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

let pubsubClient;
let topic;
let subscription;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
async function processAction(msg, cfg) {
  const self = this;
  const { projectId, topicName } = cfg;
  const subscriptionName = `eio_${process.env.ELASTICIO_TASK_ID}`;

  if (!pubsubClient || !topic || !subscription) {
    // Lazy initialization
    pubsubClient = await new PubSub({
      projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key,
      },
    });
    topic = await pubsubClient.topic(topicName);
    subscription = await pubsubClient.subscription(subscriptionName);
  }

  async function checkSubscriptionExists() {
    this.logger.info('Checking if subscription with name %s exists', subscriptionName);
    return Q.ninvoke(subscription, 'exists');
  }

  async function registerSubscription(alreadyExists) {
    if (alreadyExists) {
      this.logger.info('Apparently subscription with name=%s already exists, skipping creation', subscriptionName);
      return;
    }
    this.logger.info('Creating new subscription %s', subscriptionName);
    return Q.ninvoke(topic, 'subscribe', subscriptionName);
  }

  async function pullSubscription() {
    this.logger.info(`Polling from subscription ${subscription.name}`);
    return Q.ninvoke(subscription, 'pull', {
      returnImmediately: true,
      maxMessages: 1000,
    });
  }

  async function emitAndAcknowledge(result) {
    const msgs = result[0];
    this.logger.info(`Received ${msgs.length} messages.`);
    if (msgs.length > 0) {
      msgs.forEach((m) => {
        const newMsg = messages.newMessageWithBody(m.data);
        newMsg.headers = m.attributes || {};
        newMsg.id = m.id;
        if (m.publishTime) {
          newMsg.headers.publishTime = m.publishTime;
        }
        self.emit('data', newMsg);
      });
      const messageIDs = msgs.map((message) => message.ackId);
      this.logger.info('Acknowledging messages with IDs: %s', messageIDs);
      return Q.ninvoke(subscription, 'ack', messageIDs);
    } else {
      return Q();
    }
  }

  /**
   * This function returns a promise that will resolve on nextTick and will loop
   * the promises chain
   */
  async function loop() {
    return Q().then(pullSubscription)
      .then(emitAndAcknowledge)
      .then(loop);
  }

  async function emitError(e) {
    this.logger.info('Oops! Error occurred', e, e.stack);
    if (self.emit) {
      await self.emit('error', e);
    }
  }

  async function emitEnd() {
    this.logger.info('Finished execution');
    await self.emit('end');
  }


  Q(msg)
    .then(checkSubscriptionExists)
    .then(registerSubscription)
    .then(pullSubscription)
    .then(emitAndAcknowledge)
    .then(loop)
    .fail(emitError)
    .done(emitEnd);
}

module.exports.process = processAction;
