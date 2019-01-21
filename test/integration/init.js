import assert from 'assert';
import Promise from 'bluebird';
import express from 'express';
import http from 'http';
import Sequelize from 'sequelize';
import request from 'request-promise';

import config from '../../server/config';
import Routes from '../../server/routes';
import Db from '../../server/db';

const db = new Db();
const app = express();
const server = http.createServer(app, db);
const routes = new Routes(app, db); // eslint-disable-line no-new

server.listen(config.server.port, () => {
  console.log(`Listening on port ${config.server.port}`);
});

before(() => db.sequelize.sync({ force: true }));

after(() => {
  server.close();
  return db.sequelize.close();
});

describe('NODE_ENV', () => {
  it('is set', () => {
    assert.equal(process.env.NODE_ENV, 'test');
  });
});

describe('http', () => {
  it('is healthy', async () => {
    const response = await request.get({
      uri: `http://127.0.0.1:8888/health`,
      resolveWithFullResponse: true
    });
    assert.equal(response.statusCode, 200);
  });
});

module.exports = { server, db };