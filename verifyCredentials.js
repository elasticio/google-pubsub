/* eslint-disable camelcase */
const { PubSub } = require('@google-cloud/pubsub');
const logger = require('@elastic.io/component-logger')();

module.exports = async function verifyCredentials(cfg) {
  logger.info('Start verifying credentials');
  logger.trace('Current credentials: %j', cfg);
  const { projectId, client_email, private_key } = cfg;
  let topics;
  let result = { verified: true };

  // Creates a client; cache this for further use
  const pubSubClient = new PubSub({
    projectId,
    credentials: {
      client_email,
      private_key,
    },
  });

  async function listAllTopics() {
    // Lists all topics in the current project
    [topics] = await pubSubClient.getTopics();
    logger.trace('Topics:');
    topics.forEach(topic => logger.trace(topic.name));
    return topics;
  }

  await listAllTopics().catch((err) => {
    logger.error(err);
    result = { verified: false };
  });

  return result;
};
