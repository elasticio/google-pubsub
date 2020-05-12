/* eslint-disable no-shadow */
const { messages } = require('elasticio-node');

// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

let pubsubClient;
let topic;
let publisher;
let body;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processAction(msg, cfg) {
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
    publisher = topic.publisher();
  }

  const message = {
    data: msg.body,
    attributes: {},
  };
  this.logger.info('Publishing message %j', message);
  const bufferData = Buffer.from(msg.body);

  publisher.publish(bufferData).then((messageId) => {
    this.logger.info('Message sent with ID: ', messageId);
    body = {
      messageID: messageId,
    };
    const data = messages.newMessageWithBody(body);
    self.emit('data', data);
  }).catch((e) => {
    this.logger.info('Oops! Error occurred');
    self.emit('error', e);
  });
  self.logger.info('Finished execution');
  self.emit('end');
}

module.exports.process = processAction;
