/* eslint new-cap: [2, {"capIsNewExceptions": ["Q"]}] */
var Q = require('q');
var elasticio = require('elasticio-node');
var messages = elasticio.messages;

// Imports the Google Cloud client library
const PubSub = require('google-cloud').pubsub;

var pubsubClient, topic, subscription;

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
  const subscriptionName = 'eio_' + process.env.ELASTICIO_TASK_ID;

  if (!pubsubClient || !topic || !subscription) {
    // Lazy initialization
    pubsubClient = PubSub({
      projectId: projectId,
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key
      }
    });
    topic = pubsubClient.topic(topicName);
    subscription = pubsubClient.subscription(subscriptionName);
  }

  // Registering shutdown handler
  function shutdownHandler() {
    console.log('Received SIGINT. Fuck off, admiral, I will not quit!');
    var n = 0;
    setInterval(() => console.log('I am still alive %s', n++), 100);
  }
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);

  function checkSubscriptionExists() {
    console.log('Checking if subscription with name %s exists', subscriptionName);
    return Q.ninvoke(subscription, 'exists');
  }

  function registerSubscription(alreadyExists) {
    if (alreadyExists) {
      console.log('Apparently subscription with name=%s already exists, skipping creation', subscriptionName);
      return subscription;
    }
    console.log('Creating new subscription %s', subscriptionName);
    return Q.ninvoke(topic, 'subscribe', subscriptionName);
  }

  function pullSubscription(subscription) {
    console.log(`Polling from subscription ${subscription.name}`);
    return Q.ninvoke(subscription, 'pull', {
      returnImmediately: false,
      maxMessages: 100
    });
  }

  function emitAndAcknowledge(messages) {
    console.log(`Received ${messages.length} messages.`);
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
    console.log('Oops! Error occurred', e);
    self.emit('error', e);
  }

  function emitEnd() {
    console.log('Finished execution');
    self.emit('end');
  }

  Q(msg)
    .then(checkSubscriptionExists)
    .then(registerSubscription)
    .then(pullSubscription)
    .then(emitAndAcknowledge)
    .fail(emitError)
    .done(emitEnd);
}
