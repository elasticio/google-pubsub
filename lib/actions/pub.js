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
  }

  function sendMessage(msg) {
    const message = {
      data: msg.body,
      attributes: {},
    };
    this.logger.info('Publishing message %j', message);
    return Q.ninvoke(topic, 'publish', message);
  }

  function emitReply(messageIDs) {
    this.logger.info('Message sent with ID: ', messageIDs[0]);
    const body = {
      messageID: messageIDs[0],
    };
    const data = messages.newMessageWithBody(body);
    self.emit('data', data);
  }

  function emitError(e) {
    this.logger.info('Oops! Error occurred');
    self.emit('error', e);
  }

  function emitEnd() {
    this.logger.info('Finished execution');
    self.emit('end');
  }

  Q(msg).then(sendMessage).then(emitReply).fail(emitError)
    .done(emitEnd);
}

module.exports.process = processAction;
