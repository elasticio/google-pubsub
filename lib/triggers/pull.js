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
  const self = this;
  self.logger.info('Start pull trigger');
  self.logger.debug('Current config: %j', cfg);

  const { projectId, topicName } = cfg;
  const subscriptionName = `eio_${process.env.ELASTICIO_TASK_ID}`;

  const subClient = new v1.SubscriberClient({
    credentials: {
      client_email: cfg.client_email,
      private_key: cfg.private_key,
    },
  });

  async function synchronousPull() {
    const formattedSubscription = await subClient.subscriptionPath(
      projectId,
      subscriptionName,
    );

    await subClient.getSubscription({ subscription: formattedSubscription }).catch(async (err) => {
      self.logger.debug('About to get subscription');
      if (err.message.includes('NOT_FOUND')) {
        self.logger.debug('Subscription was not found. About to create subscription');
        await subClient.createSubscription({ topic: topicName, name: formattedSubscription });
      } else {
        throw err;
      }
    });

    // The subscriber pulls a specified number of messages.
    const [response] = await subClient.pull({ subscription: formattedSubscription, maxMessages: 100, returnImmediately: true });

    // Process the messages.
    const ackIds = [];
    let newMsg;
    // eslint-disable-next-line no-restricted-syntax
    for (const message of response.receivedMessages) {
      self.logger.debug(`Received message: ${message.message.data}, ackId: ${message.ackId}`);
      ackIds.push(message.ackId);
      newMsg = messages.newMessageWithBody(message.message.data);
      newMsg.headers = message.attributes || {};
      newMsg.id = message.id;
      if (message.publishTime) {
        newMsg.headers.publishTime = message.publishTime;
      }
      // eslint-disable-next-line no-await-in-loop
      await self.emit('data', messages.newMessageWithBody(newMsg));
    }
    // Acknowledge all of the messages. You could also acknowledge
    // these individually, but this is more efficient.
    if (ackIds.length) {
      const ackRequest = {
        subscription: formattedSubscription,
        ackIds,
      };
      self.logger.debug('About to acknowledge retrieved messages:', ackRequest);
      await subClient.acknowledge(ackRequest);
    }

    self.logger.info('Finished execution');
  }
  await synchronousPull();
}

module.exports.process = processAction;
