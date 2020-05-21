const fs = require('fs');
const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();
const publish = require('../lib/actions/pub');

// eslint-disable-next-line func-names
describe('publish action', function () {
  if (fs.existsSync('.env')) {
    // eslint-disable-next-line global-require
    require('dotenv').config();
  }

  this.timeout(5000);

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

  const msgString = {
    body: 'This is a string example.',
  };
  const msgObject = {
    body: {
      message: 'This is an object example.',
    },
  };
  const msgBuffer = {
    // eslint-disable-next-line no-use-before-define
    body: bufferFromBufferString('<Buffer 54 68 69 73 20 69 73 20 61 20 62 75 66 66 65 72 20 65 78 61 6d 70 6c 65 2e>'),
  };
  const msgArray = {
    body: ['This is an array example.'],
  };
  const msgInteger = {
    body: 123,
  };
  const msgFloat = {
    body: 123.45,
  };

  before(() => {
    if (!process.env.projectId) { throw new Error('Please set projectId env variable to proceed'); }
    if (!process.env.client_email) { throw new Error('Please set client_email env variable to proceed'); }
    if (!process.env.private_key) { throw new Error('Please set private_key env variable to proceed'); }
    if (!process.env.GOOGLE_APP_ID) { throw new Error('Please set GOOGLE_APP_ID env variable to proceed'); }
    if (!process.env.GOOGLE_APP_SECRET) { throw new Error('Please set GOOGLE_APP_SECRET env variable to proceed'); }
  });

  it('should publish data string', async () => {
    await publish.process.call(self, msgString, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });

  it('should publish data object', async () => {
    await publish.process.call(self, msgObject, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });

  it('should publish data buffer', async () => {
    await publish.process.call(self, msgBuffer, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });

  it('should publish data array', async () => {
    await publish.process.call(self, msgArray, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });

  it('should publish data integer', async () => {
    await publish.process.call(self, msgInteger, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });

  it('should publish data float', async () => {
    await publish.process.call(self, msgFloat, cfg);
    const result = self.emit.getCall(0).args[1];
    expect(result.body).to.have.a.key('messageID');
  });
});

function bufferFromBufferString(bufferStr) {
  return Buffer.from(
    bufferStr
      .replace(/[<>]/g, '') // remove < > symbols from str
      .split(' ') // create an array splitting it by space
      .slice(1) // remove Buffer word from an array
      .reduce((acc, val) => acc.concat(parseInt(val, 16)), []), // convert all strings of numbers to hex numbers
  );
}
