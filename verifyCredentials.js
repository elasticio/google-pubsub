/* eslint-disable camelcase */
const { PubSub } = require('@google-cloud/pubsub');

module.exports = async function verifyCredentials(cfg) {
  this.logger.info('Start verifying credentials');
  this.logger.debug('Current credentials: %j', cfg);
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
    this.logger.debug('Topics:');
    topics.forEach(topic => this.logger.debug(topic.name));
    return topics;
  }

  await listAllTopics().catch((err) => {
    this.logger.error(err);
    result = { verified: false };
  });

  return result;
};
