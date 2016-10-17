/* eslint new-cap: [2, {"capIsNewExceptions": ["Q"]}] */
var Q = require('q');
var elasticio = require('elasticio-node');
var msgutils = elasticio.messages;

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

  function checkSubscriptionExists() {
    console.log('Checking if subscription with name %s exists', subscriptionName);
    return Q.ninvoke(subscription, 'exists');
  }

  function registerSubscription(alreadyExists) {
    if (alreadyExists) {
      console.log('Apparently subscription with name=%s already exists, skipping creation', subscriptionName);
      return;
    }
    console.log('Creating new subscription %s', subscriptionName);
    return Q.ninvoke(topic, 'subscribe', subscriptionName);
  }

  function pullSubscription() {
    console.log(`Polling from subscription ${subscription.name}`);
    return Q.ninvoke(subscription, 'pull', {
      returnImmediately: true,
      maxMessages: 1000
    });
  }

  function emitAndAcknowledge(result) {
    var messages = result[0];
    console.log(`Received ${messages.length} messages.`);
    if (messages.length > 0) {
      messages.forEach((m) => {
        var newMsg = msgutils.newMessageWithBody(m.data);
        newMsg.headers = m.attributes || {};
        newMsg.id = m.id;
        if (m.publishTime) {
          newMsg.headers.publishTime = m.publishTime;
        }
        self.emit('data', newMsg);
      });
      var messageIDs = messages.map((message) => message.ackId);
      console.log('Acknowledging messages with IDs: %s', messageIDs);
      return Q.ninvoke(subscription, 'ack', messageIDs);
    } else {
      return Q();
    }
  }

  /**
   * This function returns a promise that will resolve on nextTick and will loop
   * the promises chain
   */
  function loop() {
    return Q().then(pullSubscription)
      .then(emitAndAcknowledge)
      .then(loop)
  }

  function emitError(e) {
    console.log('Oops! Error occurred', e, e.stack);
    if (self.emit) {
      self.emit('error', e);
    }
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
    .then(loop)
    .fail(emitError)
    .done(emitEnd);
}
