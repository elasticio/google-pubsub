/* eslint new-cap: [2, {"capIsNewExceptions": ["Q"]}] */
var Q = require('q');
var elasticio = require('elasticio-node');
var messages = elasticio.messages;

// Imports the Google Cloud client library
const PubSub = require('google-cloud').pubsub;

var pubsubClient, topic;

module.exports.process = processAction;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processAction(msg, cfg) {
  var self = this;
  var projectId = cfg.projectId;
  var topicName = cfg.topicName;

  if (!pubsubClient || !topic) {
    // Lazy initialization
    pubsubClient = PubSub({
      projectId: projectId,
      credentials: {
        client_email: conf.client_email,
        private_key: conf.private_key
      }
    });
    topic = pubsubClient.topic(topicName);
  }

  function sendMessage(msg) {
    var message = {
      data: msg.body,
      attributes: msg.headers
    };
    return Q.ninvoke(topic, 'publish', message);
  }

  function emitReply(messageIDs) {
    console.log('Message sent with ID: ', messageIDs[0]);
    var body = {
      messageID: messageIDs[0]
    };
    var data = messages.newMessageWithBody(body);
    self.emit('data', data);
  }

  function emitError(e) {
    console.log('Oops! Error occurred');
    self.emit('error', e);
  }

  function emitEnd() {
    console.log('Finished execution');
    self.emit('end');
  }

  Q(msg.body).then(sendMessage).then(emitReply).fail(emitError).done(emitEnd);
}
