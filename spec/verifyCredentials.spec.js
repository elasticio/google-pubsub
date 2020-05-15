const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();
const verifyCredentials = require('../verifyCredentials');

describe('verifyCredentials unit', () => {
  const self = {
    emit: sinon.spy(),
    logger,
  };

  before(() => {
    if (!process.env.GOOGLE_APP_ID) {
      process.env.GOOGLE_APP_ID = 'some';
    }

    if (!process.env.GOOGLE_APP_SECRET) {
      process.env.GOOGLE_APP_SECRET = 'some';
    }
  });

  const cfg = {
    projectId: 'projectId',
    client_email: 'client@email.com',
    private_key: 'private_key',
  };

  it('should fail to validate an invalid credentials', async () => {
    const result = await verifyCredentials.call(self, cfg);
    expect(result).to.deep.equal({ verified: false });
  });
});
