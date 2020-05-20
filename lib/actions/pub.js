/* eslint-disable no-shadow */
const { messages } = require('elasticio-node');

// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

let pubsubClient;
let topic;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
async function processAction(msg, cfg) {
  this.logger.info('Start publish action');
  this.logger.trace('Current config: %j', cfg);
  const self = this;
  const { projectId, topicName } = cfg;

  if (!pubsubClient || !topic) {
    // Lazy initialization
    pubsubClient = new PubSub({
      projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key,
      },
    });
    topic = pubsubClient.topic(topicName);
  }

  this.logger.trace('Publishing message %j', msg.body);
  const bufferData = Buffer.from(msg.body);

  try {
    const messageId = await topic.publish(bufferData);
    const body = {
      messageID: [messageId],
    };
    this.logger.info('Message sent with ID:', messageId);
    const data = messages.newMessageWithBody(body);
    self.emit('data', data);
  } catch (err) {
    this.logger.info('Oops! Error occurred', err);
    self.emit('error', err);
  }

  self.logger.info('Finished execution');
  self.emit('end');
}

module.exports.process = processAction;
