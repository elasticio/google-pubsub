/* eslint-disable no-shadow */
const { messages } = require('elasticio-node');

// Imports the Google Cloud client library
const { v1 } = require('@google-cloud/pubsub');

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
async function processAction(msg, cfg) {
  this.logger.info('Start pull trigger');
  this.logger.trace('Current config: %j', cfg);
  const self = this;
  const { projectId, topicName } = cfg;
  const subscriptionName = `eio_${process.env.ELASTICIO_TASK_ID}`;

  const subClient = new v1.SubscriberClient({
    credentials: {
      client_email: cfg.client_email,
      private_key: cfg.private_key,
    },
  });

  async function synchronousPull() {
    const formattedSubscription = subClient.subscriptionPath(
      projectId,
      subscriptionName,
    );

    // The maximum number of messages returned for this request.
    // Pub/Sub may return fewer than the number specified.
    const request = {
      subscription: formattedSubscription,
      returnImmediately: true,
      maxMessages: 100,
    };

    const isExists = await subClient.getSubscription();
    if (!isExists[0].name) {
      // create a subscription
      request.subscription.topicName = topicName;
      request.subscription.topic = topicName;
      request.subscription.name = subscriptionName;
      await subClient.createSubscription(request.subscription);
    }

    // The subscriber pulls a specified number of messages.
    const [response] = await subClient.pull(request);

    // Process the messages.
    const ackIds = [];
    const msgs = [];
    let newMsg;
    // eslint-disable-next-line no-restricted-syntax
    for (const message of response.receivedMessages) {
      self.logger.trace(`Received message: ${message.message.data}`);
      msgs.push(message);
      ackIds.push(message.ackId);
    }

    // Acknowledge all of the messages. You could also acknowledge
    // these individually, but this is more efficient.
    const ackRequest = {
      subscription: formattedSubscription,
      ackIds,
    };
    await subClient.acknowledge(ackRequest);

    // eslint-disable-next-line no-restricted-syntax
    for (const msg of msgs) {
      newMsg = messages.newMessageWithBody(msg.data);
      newMsg.headers = msg.attributes || {};
      newMsg.id = msg.id;
      if (msg.publishTime) {
        newMsg.headers.publishTime = msg.publishTime;
      }
      // eslint-disable-next-line no-await-in-loop
      await self.emit('data', messages.newMessageWithBody(newMsg));
    }

    self.logger.info('Finished execution');
  }
  await synchronousPull().catch(self.logger.error);
}

module.exports.process = processAction;
