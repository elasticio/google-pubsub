/* eslint-disable no-shadow */
const Q = require('q');
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
  const self = this;
  const { projectId, topicName } = cfg;

  if (!pubsubClient || !topic) {
    // Lazy initialization
    pubsubClient = await new PubSub({
      projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key,
      },
    });
    topic = await pubsubClient.topic(topicName);
  }

  async function sendMessage(msg) {
    const message = {
      data: msg.body,
      attributes: {},
    };
    this.logger.info('Publishing message %j', message);
    return Q.ninvoke(topic, 'publish', message);
  }

  async function emitReply(messageIDs) {
    this.logger.info('Message sent with ID: ', messageIDs[0]);
    const body = {
      messageID: messageIDs[0],
    };
    const data = messages.newMessageWithBody(body);
    await self.emit('data', data);
  }

  async function emitError(e) {
    this.logger.info('Oops! Error occurred');
    await self.emit('error', e);
  }

  async function emitEnd() {
    this.logger.info('Finished execution');
    await self.emit('end');
  }

  Q(msg).then(sendMessage).then(emitReply).fail(emitError)
    .done(emitEnd);
}

module.exports.process = processAction;
