const fs = require('fs');
const { expect } = require('chai');
const sinon = require('sinon');
const verifyCredentials = require('../verifyCredentials');

// eslint-disable-next-line func-names
describe('verifyCredentials', function () {
  if (fs.existsSync('.env')) {
    // eslint-disable-next-line global-require
    require('dotenv').config();
  }

  this.timeout(10000);

  const self = {
    emit: sinon.spy(),
  };

  const cfg = {
    projectId: process.env.projectId,
    client_email: process.env.client_email,
    private_key: process.env.private_key,
  };

  before(() => {
    if (!process.env.projectId) { throw new Error('Please set projectId env variable to proceed'); }
    if (!process.env.client_email) { throw new Error('Please set client_email env variable to proceed'); }
    if (!process.env.private_key) { throw new Error('Please set private_key env variable to proceed'); }
    if (!process.env.GOOGLE_APP_ID) { throw new Error('Please set GOOGLE_APP_ID env variable to proceed'); }
    if (!process.env.GOOGLE_APP_SECRET) { throw new Error('Please set GOOGLE_APP_SECRET env variable to proceed'); }
  });

  it('should validate valid credentials', async () => {
    const result = await verifyCredentials.call(self, cfg);
    expect(result).to.deep.equal({ verified: true });
  });

  it('should fail invalid credentials', async () => {
    cfg.client_email = 'client@email.com';
    const result = await verifyCredentials.call(self, cfg);
    expect(result).to.deep.equal({ verified: false });
  });

  it('should fail required params are missing', async () => {
    cfg.client_email = 'client@email.com';
    const result = await verifyCredentials.call(self, { client_email: 'client@email.com' });
    expect(result).to.deep.equal({ verified: false });
  });
});
