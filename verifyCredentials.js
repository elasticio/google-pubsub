/* eslint-disable camelcase */
const { PubSub } = require('@google-cloud/pubsub');

module.exports = async function verifyCredentials(cfg) {
  const self = this;
  self.logger.info('Start verifying credentials');
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
    self.logger.debug('Topics received');
    return topics;
  }

  await listAllTopics().catch(() => {
    self.logger.error('Error during retrieving topics occurred');
    result = { verified: false };
  });

  return result;
};
