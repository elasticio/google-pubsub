/* eslint-disable no-else-return,allow-parens */
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
function processAction(msg, cfg) {
  const self = this;
  const { projectId, topicName } = cfg;
  const subscriptionName = `eio_${process.env.ELASTICIO_TASK_ID}`;

  if (!pubsubClient || !topic || !subscription) {
    // Lazy initialization
    pubsubClient = PubSub({
      projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key,
      },
    });
    topic = pubsubClient.topic(topicName);
    subscription = pubsubClient.subscription(subscriptionName);
  }

  function checkSubscriptionExists() {
    this.logger.info('Checking if subscription with name %s exists', subscriptionName);
    return Q.ninvoke(subscription, 'exists');
  }

  function registerSubscription(alreadyExists) {
    if (alreadyExists) {
      this.logger.info('Apparently subscription with name=%s already exists, skipping creation', subscriptionName);
      return;
    }
    this.logger.info('Creating new subscription %s', subscriptionName);
    return Q.ninvoke(topic, 'subscribe', subscriptionName);
  }

  function pullSubscription() {
    this.logger.info(`Polling from subscription ${subscription.name}`);
    return Q.ninvoke(subscription, 'pull', {
      returnImmediately: true,
      maxMessages: 1000,
    });
  }

  function emitAndAcknowledge(result) {
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
  function loop() {
    return Q().then(pullSubscription)
      .then(emitAndAcknowledge)
      .then(loop);
  }

  function emitError(e) {
    this.logger.info('Oops! Error occurred', e, e.stack);
    if (self.emit) {
      self.emit('error', e);
    }
  }

  function emitEnd() {
    this.logger.info('Finished execution');
    self.emit('end');
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
