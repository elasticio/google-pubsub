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
  self.logger.trace('Current config: %j', cfg);

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
      if (err.message.includes('NOT_FOUND')) {
        await subClient.createSubscription({ topic: topicName, name: formattedSubscription });
      } else {
        throw err;
      }
    });

    // The subscriber pulls a specified number of messages.
    const [response] = await subClient.pull({ subscription: formattedSubscription, maxMessages: 100, returnImmediately: true });

    // Process the messages.
    const ackIds = [];
    const msgs = [];
    let newMsg;
    // eslint-disable-next-line no-restricted-syntax
    for (const message of response.receivedMessages) {
      self.logger.info(`Received message: ${message.message.data}, ackId: ${message.ackId}`);
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
  await synchronousPull();
}

module.exports.process = processAction;
