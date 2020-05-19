const fs = require('fs');
const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();
const publish = require('../lib/actions/pub');
const pull = require('../lib/triggers/pull');

// eslint-disable-next-line func-names
describe('pull trigger', function () {
  if (fs.existsSync('.env')) {
    // eslint-disable-next-line global-require
    require('dotenv').config();
  }

  this.timeout(30000);

  const self = {
    emit: sinon.spy(),
    logger,
  };

  const cfg = {
    projectId: process.env.projectId,
    client_email: process.env.client_email,
    private_key: process.env.private_key,
    topicName: process.env.topicName,
  };

  const msg = {
    body: 'sample text',
  };

  before(async () => {
    if (!process.env.projectId) { throw new Error('Please set projectId env variable to proceed'); }
    if (!process.env.client_email) { throw new Error('Please set client_email env variable to proceed'); }
    if (!process.env.private_key) { throw new Error('Please set private_key env variable to proceed'); }
    if (!process.env.GOOGLE_APP_ID) { throw new Error('Please set GOOGLE_APP_ID env variable to proceed'); }
    if (!process.env.GOOGLE_APP_SECRET) { throw new Error('Please set GOOGLE_APP_SECRET env variable to proceed'); }
    await publish.process.call(self, msg, cfg);
  });

  it('should pull data', async () => {
    await pull.process.call(self, msg, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.property('messageID');
  });
});
