/* eslint-disable no-empty */
/* eslint-disable camelcase */
const commons = require('@elastic.io/component-commons-library');
const logger = require('@elastic.io/component-logger')();
const { messages } = require('elasticio-node');
const { PubSub } = require('@google-cloud/pubsub');

const isRealtimeFlow = process.env.ELASTICIO_FLOW_TYPE === 'long_running';
const isDebugFlow = process.env.ELASTICIO_FLOW_TYPE === 'debug';

let client;
let currentSubscription;
let context;
let lastMessageDate;
let emitted;

const getOrCreateSubscription = async (subscriptionName, topic) => {
  const currentLogger = context?.logger || logger;
  if (currentSubscription) {
    currentLogger.info('Subscription already exist, going to use it');
    return currentSubscription;
  }
  const [topics] = await client.getTopics();
  const existingTopic = topics.find((top) => top.name === topic);

  const [subscriptions] = await existingTopic.getSubscriptions();
  const existingSubscription = subscriptions.find((subscription) => subscription.name.endsWith(`/${subscriptionName}`));
  if (existingSubscription) {
    currentLogger.info('Subscription found, going to use it');
    return existingSubscription;
  }
  currentLogger.info(`Subscription not found, going to create new: ${subscriptionName}`);
  const [newSubscription] = await existingTopic.createSubscription(subscriptionName);
  return newSubscription;
};

async function startup(cfg) {
  const currentLogger = context?.logger || logger;
  currentLogger.info('startup hook started');
  const { projectId, topic, client_email, private_key } = cfg;

  client = new PubSub({
    credentials: {
      client_email,
      private_key,
    },
    projectId,
  });
  const subscriptionName = `eio_${process.env.ELASTICIO_FLOW_ID}`;
  await getOrCreateSubscription(subscriptionName, topic);
  currentLogger.info('startup hook finished');
}

async function shutdown(cfg) {
  const currentLogger = context?.logger || logger;
  currentLogger.info('shutdown hook started');
  const { projectId, topic, client_email, private_key } = cfg;

  client = new PubSub({
    credentials: {
      client_email,
      private_key,
    },
    projectId,
  });
  const subscriptionName = `eio_${process.env.ELASTICIO_FLOW_ID}`;
  const subscription = await getOrCreateSubscription(subscriptionName, topic);
  await subscription.delete();
  currentLogger.info('shutdown hook finished');
}

const waitNewMessages = async () => {
  await commons.sleep(1000);
  const currentDate = new Date();
  if (currentDate.getTime() - lastMessageDate.getTime() < 30000) await waitNewMessages();
};

async function processTrigger(msg, cfg, snapshot) {
  context = this;
  context.logger.info('"Subscribe" trigger started');

  const { projectId, topic, client_email, private_key } = cfg;

  client ||= new PubSub({
    credentials: {
      client_email,
      private_key,
    },
    projectId,
  });

  const messageHandler = async (message) => {
    context.logger.info(`Message received with ID: ${message.id}`);
    try {
      const {
        attributes,
        data,
        id,
        publishTime,
        received,
      } = message;

      const newMsg = {
        attributes,
        data: data.toString(),
        id,
        publishTime,
        received,
      };
      try {
        newMsg.received = new Date(newMsg.received);
        newMsg.data = JSON.parse(newMsg.data);
      } catch (_e) { }
      await context.emit('data', messages.newMessageWithBody(newMsg));
      await message.ackWithResponse();
      emitted = true;
    } catch (e) {
      context.logger.error(`Ack for message ${message.id} failed with error: ${e}`);
    }
  };

  if (currentSubscription) {
    const existingListeners = currentSubscription.listeners('message');
    if (existingListeners && existingListeners.length > 0) {
      context.logger.info('Subscription already has listeners for messages');
      return;
    }
  }

  const errorHandler = (error) => {
    context.logger.error(`Got error: ${error}`);
    context.emit('error', error);
  };

  const subscriptionName = `eio_${process.env.ELASTICIO_FLOW_ID}`;

  const subscription = await getOrCreateSubscription(subscriptionName, topic);
  currentSubscription = subscription;

  subscription.on('message', messageHandler);
  subscription.on('error', errorHandler);
  lastMessageDate = new Date();

  if (!isRealtimeFlow) {
    context.logger.info(`Flow type not real-time (${process.env.ELASTICIO_FLOW_TYPE}), waiting 30sec for messages before finish`);
    await waitNewMessages();
    context.logger.info('Removing listener from subscription');
    subscription.removeListener('message', messageHandler);
    subscription.removeListener('error', errorHandler);
    if (isDebugFlow) await shutdown.call(context, cfg);
  }

  if (isDebugFlow && !emitted) {
    throw new Error(`No messages found. Execution stopped.
    This error is only applicable to the Retrieve Sample.
    In flow executions there will be no error, just an execution skip.`);
  }
  context.logger.info('"Subscribe" trigger finished successfully');
}

const getTopicsList = async function getTopicsList(cfg) {
  const { projectId, client_email, private_key } = cfg;
  const result = {};

  client = new PubSub({
    credentials: {
      client_email,
      private_key,
    },
    projectId,
  });

  const [topics] = await client.getTopics();
  for (const topic of topics) {
    result[topic.name] = topic.name;
  }

  return result;
};

module.exports.process = processTrigger;
module.exports.getTopicsList = getTopicsList;
module.exports.shutdown = shutdown;
module.exports.startup = startup;
