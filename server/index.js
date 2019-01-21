import '@babel/polyfill';

import express from 'express';
import http from 'http';
import https from 'https';
import compression from 'compression';
import request from 'request-promise';
import config from './config';
import Db from './db';
import Routes from './routes';
import Worker from './worker';
import { keepAliveHeaders } from './shared';
import migrate from './migrate';
import { web3, waitForRpc } from './helpers';
import { IDEX_FIRST_BLOCK } from './constants';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://2c0043771883437e874c7a2e28fcbd1b@sentry.io/1352235',
  environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
});

const fs = require('fs').promises;

const AURAD_VERSION = require('../package.json').version;

const db = new Db();
const app = express();

let server;
let coldWallet;
let account;
let worker;

const buildServer = async () => {
  if (process.env.SSL === '1') {
    const privateKeyPath = process.env.SSL_PRIVATE_KEY_PATH;
    const privateKey = await fs.readFile(privateKeyPath, 'utf8');

    const certificatePath = process.env.SSL_CERT_PATH;
    const certificate = await fs.readFile(certificatePath, 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
    };
    server = https.createServer(credentials, app);
  } else {
    server = http.createServer(app);
  }
};

const routes = new Routes(app, db);
app.use(compression());

const keepalive = async () => {
  try {
    if (coldWallet) {
      const timestamp = Date.now();

      const json = {
        version: AURAD_VERSION,
        blockNumber: worker.currentBlock,
        timestamp,
      };

      const challenge = process.env.AURAD_CHALLENGE;
      const headers = keepAliveHeaders(web3, coldWallet, account, timestamp, json, challenge);

      const response = await request({
        url: `${config.staking.host}/keepalive`,
        method: 'POST',
        headers,
        json,
        simple: false,
        resolveWithFullResponse: true,
      });

      const message = (response.body ? response.body.message : '');
      
      if (response.statusCode === 200) {
        console.log(`STAKING ONLINE: ${message}`);
      } else {
        console.log(`STAKING OFFLINE: ${message}`);
      }
      worker.writeStatus({
        keepAlive: {
          status: response.statusCode,
          timestamp: Date.now(),
          message
        }
      });
    } else {
      console.log(`STAKING OFFLINE: no wallet configured`);
    }
  } catch (e) {
    console.log(`STAKING OFFLINE`);
    Sentry.captureException(e);
    console.log(e);
  }
};

const loadWallet = async () => {
  try {
    const settings = JSON.parse(await fs.readFile('ipc/settings.json'));
    coldWallet = settings.coldWallet; // eslint-disable-line
    const hotWalletEncrypted = settings.hotWallet;
    account = await web3.eth.accounts.decrypt(hotWalletEncrypted, settings.token);
    process.env.PASSPHRASE = '';
  } catch (e) {
    console.log('error loading settings.json, wrong passphrase?');
  }
};


const runner = async () => {
  let firstBlock = IDEX_FIRST_BLOCK;
  if (process.env.FORCE_SYNC !== '1') {
    const lastTrade = await db.sequelize.models.Trade.findOne({ order: [['blockNumber', 'DESC']] });
    firstBlock = lastTrade ? lastTrade.get('blockNumber') - 1 : IDEX_FIRST_BLOCK;
  }
  worker = await Worker.build(firstBlock);
  worker.getTransactions();

  return worker;
};

const api = async () => new Promise((resolve) => {
  server.listen(config.server.port, () => {
    console.log(`API listening on port ${config.server.port}`);
    resolve();
  });
});

const statusApi = () => new Promise(resolve => {
  const port = config.server.statusApiPort;
  if (!port) {
    resolve();
    return;
  }
  const _api = express();
  _api.get('/status', (req, response) => {
    response.json({ lastScannedBlock: worker ? worker.currentBlock : 0 });
  });
  http.createServer(_api).listen(port, () => {
    console.log(`Status API listening on port ${port}`);
    resolve();
  });
});

const startKeepAlive = () => {
  keepalive() && setInterval(keepalive, 30000);
};

(async () => {
  if (process.env.AUTO_MIGRATE === '1') {
    await migrate();
  }
  await loadWallet();
  await db.waitFor();
  await waitForRpc();
  await buildServer();
  await api();
  await statusApi();

  const runningWorker = await runner();
  runningWorker.on('ready', startKeepAlive);
})();

process.on('SIGINT', () => {
  process.on('uncaughtException', () => {
    console.log('uncaughtException while shutting down');
  });

  console.log('SIGINT signal received.');
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await db.sequelize.close;
    } catch (e) {
      console.log('warning: sequelize shutdown failed');
    }
    try {
      await worker.close();
    } catch (e) {
      console.log('warning: worker shutdown failed');
    }
    try {
      await fs.unlink('ipc/status.json');
    } catch (e) {
      console.log('warning: status.json deletion failed');
    }
    console.log('Process exiting.');
    process.exit(0);
  });
});

module.exports = {
  server,
  app,
  web3,
  db,
  routes,
};
