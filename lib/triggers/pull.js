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
  const projectId = cfg.projectId;
  const topicName = cfg.topicName;
  const subscriptionName = 'eio_' + process.env.ELASTICIO_TASK_ID + '_' + process.env.ELASTICIO_EXEC_ID;

  if (!pubsubClient || !topic) {
    // Lazy initialization
    pubsubClient = PubSub({
      projectId: projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key
      }
    });
    topic = pubsubClient.topic(topicName);
  }

  function registerSubscription() {
    return Q.ninvoke(topic, 'subscribe', subscriptionName);
  }

  function pullSubscription(subscription) {
    console.log(`Subscription ${subscription.name} created.`);
    const subscription = pubsubClient.subscription(subscription.name);
    return Q.ninvoke(subscription, 'pull', {
      returnImmediately: false,
      maxMessages: 100
    });
  }

  function emitAndAcknowledge(messages) {
    console.log(`Received ${messages.length} messages.`);
    const subscription = pubsubClient.subscription(subscriptionName);
    messages.forEach((m) => {
      var newMsg = messages.newMessageWithBody(m.data);
      newMsg.headers = m.attributes;
      newMsg.id = m.message_id;
      newMsg.headers.publishTime = m.publish_time;
      self.emit('data', newMsg);
    });
    return Q.ninvoke(subscription, 'ack', messages.map((message) => message.ackId));
  }

  function emitError(e) {
    console.log('Oops! Error occurred');
    self.emit('error', e);
  }

  function emitEnd() {
    console.log('Finished execution');
    self.emit('end');
  }

  Q(msg)
    .then(registerSubscription)
    .then(pullSubscription)
    .then(emitAndAcknowledge)
    .fail(emitError)
    .done(emitEnd);
}
