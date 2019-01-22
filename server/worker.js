import Promise from 'bluebird';
import EventEmitter from 'events';
import request from 'request-promise';
import fsWithCallbacks from 'fs';
import writeFileAtomic from 'write-file-atomic';
import { getTokenMap, initTokens, tradeToJson, filterByReceipts } from './utils/trade_utils';
import Db from './db';
import Lock from './lock';
import { web3 } from './helpers';
import { getTokenDetailsFromContract } from './contracts';
import { IDEX1_ADDRESS, IDEX_FIRST_BLOCK, SNAPSHOT_SIZE } from './constants';
import * as Sentry from '@sentry/node';

const fs = fsWithCallbacks.promises;
const writeFileAtomicPromise = Promise.promisify(writeFileAtomic);

const db = new Db();

function printit(it) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(it);
  } else {
    console.log(it);
  }
}

class Worker extends EventEmitter {
  constructor(tokenMap, firstBlock, chunkSize) {
    super();
    Object.assign(this, {
      firstBlock, chunkSize, currentBlock: firstBlock, processed: 0,
    });
    initTokens(tokenMap);
  }

  static async build(firstBlock = IDEX_FIRST_BLOCK, chunkSize = 50) {
    const tokenMap = await getTokenMap();
    return new Worker(tokenMap, firstBlock, chunkSize);
  }

  async close() {
    Worker._closed = true;

    return new Promise(async (resolve) => {
      const timeout = new Promise(() => setTimeout(() => {
        Worker._done = true;
      }, 30000));

      while (Worker._done !== true) {
        await new Promise(resolve => setTimeout(resolve, 500)); // eslint-disable-line no-shadow
      }
      clearTimeout(timeout);
      resolve();
    });
  }

  async lastBlockProcessed() {
    const lastTrade = await db.sequelize.models.Trade.findOne({ order: [['blockNumber', 'DESC']] });
    const lastBlock = (lastTrade ? lastTrade.blockNumber : IDEX_FIRST_BLOCK - 1);
    return (lastBlock);
  }

  async downloadAll(urls) {
    let result;
    let snapshotsDownloaded = 0;
    const pathsDownloaded = [];
    
    const updater = setInterval(async () => {
      await this.writeStatus({ downloadsCurrent: snapshotsDownloaded });
    }, 500);
    try {
      await Promise.mapSeries(urls, async (path) => {
        if (Worker._closed === true) return Promise.resolve();
        snapshotsDownloaded += 1;
        printit(`Downloading snapshot ${snapshotsDownloaded} of ${urls.length}(${(100 * snapshotsDownloaded / urls.length).toFixed(2)}%)`);
        const snapshot = await this.getSnapshot(path, false);
        if (snapshot !== null) {
          pathsDownloaded.push(path);
        } else {
          console.log(`WARNING: snapshot ${path} not found.`);
        }
        printit(`${path} done`);
      });
    } catch (e) {
      console.log(e);
    } finally {
      await this.writeStatus({ downloadsCurrent: snapshotsDownloaded });
      clearInterval(updater);
    }

    snapshotsDownloaded = urls.length;
    await this.writeStatus({ downloadsCurrent: snapshotsDownloaded }); 
    return (pathsDownloaded);
  }

  async warpSync(maxBlock, skipTo) {
    const lastBlock = await this.lastBlockProcessed();
    if (process.env.WARP_DISABLED === '1' || lastBlock >= skipTo) return [lastBlock + 1, false];

    const paths = [];
    let startBlock; let endBlock;
    const minBlock = lastBlock - (lastBlock % SNAPSHOT_SIZE);
    const lastSnapBlock = maxBlock - SNAPSHOT_SIZE;

    for (startBlock = minBlock; startBlock <= lastSnapBlock; startBlock += SNAPSHOT_SIZE) {
      endBlock = startBlock + SNAPSHOT_SIZE - 1;
      paths.push(`/${startBlock}_${endBlock}`);
    }

    if (paths.length === 0) {
      await this.writeStatus({
        warping: false,
        polling: false,
        downloadsStart: 0,
        downloadsEnd: 0,
        downloadsCurrent: 0,
      });
      return [lastBlock + 1, false];
    }

    await this.writeStatus({
      warping: true,
      polling: false,
      downloadsStart: 1,
      downloadsEnd: paths.length,
      downloadsCurrent: 1,
    });

    const downloadedPaths = await this.downloadAll(paths);
    
    let snapshotsProcessed = 0; let
      prevSnapshotsProcessed = 0;

    await this.writeStatus({
      snapshotsStart: 1,
      snapshotsEnd: downloadedPaths.length,
      snapshotsCurrent: 1,
    });

    const updater = setInterval(async () => {
      if (prevSnapshotsProcessed !== snapshotsProcessed) {
        await this.writeStatus({ snapshotsCurrent: snapshotsProcessed });
      }
      prevSnapshotsProcessed = snapshotsProcessed;
    }, 500);
    
    endBlock = minBlock;   
    try {
      await Promise.mapSeries(paths, async (path) => {
        if (Worker._closed === true) return Promise.resolve();
        const transactions = await this.getSnapshot(path);
        if (transactions === null) return Promise.reject();
        await this.processTransactions(this.filterTrades(transactions), lastBlock, true);
        snapshotsProcessed += 1;     
        endBlock = Math.max(endBlock, parseInt(path.split('_')[1]));
        printit(`Loaded snapshot ${snapshotsProcessed} of ${paths.length}(${(100 * snapshotsProcessed / paths.length).toFixed(2)}%) -- ${endBlock}`);
      });
    } finally {
      await this.writeStatus({ snapshotsCurrent: snapshotsProcessed });
      clearInterval(updater);
      await this.writeStatus({ warping: false });
    }
    return [endBlock + 1, true];
  }

  filterTrades(txs) {
    return txs.filter(tx => {
      if (tx.txreceipt_status && tx.txreceipt_status === '0') return (false);
      return (tx.to && tx.input && tx.to.toLowerCase() === IDEX1_ADDRESS.toLowerCase() && tx.input.substr(0, 10) === '0xef343588');
    });
  }

  async getBlocksBatch(start, end) {
    return new Promise((resolve, reject) => {
      try {
        const blocks = [];
        let count = 0;
        let total = 0;
        const batch1 = new web3.BatchRequest();
        const batch2 = new web3.BatchRequest();
        const cb = (err, block) => {
          if (err) reject(err);
          blocks.push(block);
          count += 1;
          if (count === total) resolve(blocks);
        };
        for (let n = start; n <= end; n += 1) {
          if (n % 2 === 0) batch1.add(web3.eth.getBlock.request(n, true, cb));
          if (n % 2 === 1) batch2.add(web3.eth.getBlock.request(n, true, cb));
          total += 1;
        }
        batch1.execute();
        batch2.execute();
      } catch (e) {
        reject(e);
      }
    });
  }

  async getSnapshot(path, load = true) {
    let result;
    const file = `./downloads${path}`;
    try {
      if (load === true) {
        result = await fs.readFile(file);
        result = JSON.parse(result);
      } else {
        result = await fs.access(file, fsWithCallbacks.constants.R_OK);
      }
    } catch (e) {
      result = null;
      let uri;
      try {
        uri = `${process.env.SNAPSHOT_HOST}${path}`;
        const download = await request({
          uri,
          gzip: true,
          timeout: 30000
        });
        result = JSON.parse(download);
        await writeFileAtomicPromise(file, JSON.stringify(result));
        return (result);
      } catch (e2) {
        console.log('Snapshot not found');
      }
    }
    return (result);
  }

  async rpcSync() {
    let status;
    do {
      status = await web3.eth.isSyncing();
      if (status.currentBlock < status.highestBlock) {
        console.log(`Waiting for RPC node to be in sync (${status.currentBlock} / ${status.highestBlock})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while (status.currentBlock < status.highestBlock);
  }

  async resetStatus() {
    const f = 'ipc/status.json';
    await writeFileAtomicPromise(f, JSON.stringify({}));
  }

  async writeStatus(newValues) {
    const f = 'ipc/status.json';
    let lastStatus;
    try {
      const result = await fs.readFile(f);
      lastStatus = JSON.parse(result);
      const updatedStatus = Object.assign(lastStatus, newValues);
      await writeFileAtomicPromise(f, JSON.stringify(updatedStatus));
    } catch (e) {
      lastStatus = {};
    }
  }

  async getTransactions() {
    this._running = true;

    await this.resetStatus();
    await this.rpcSync();

    const { chunkSize } = this;
    let maxBlock = await web3.eth.getBlockNumber();

    let startBlock = 0; let didWarp = false;
    const skipTo = maxBlock - (maxBlock % SNAPSHOT_SIZE);
    [startBlock, didWarp] = await this.warpSync(maxBlock, skipTo);
    startBlock -= startBlock % chunkSize;
    this.currentBlock = startBlock;

    // we're done warping and it's ok to do things like send a keep alive
    // this function will continue looping down below looking for new blocks
    this.emit('ready');

    // downsize a little when we're not snapshotting
    const pollingChunkSize = parseInt(process.env.CHUNK_SIZE || '10', 10);

    startBlock = Math.min(maxBlock, startBlock);
    let toBlock = Math.min(maxBlock, startBlock + pollingChunkSize - 1);

    if (didWarp === true) printit(`Warped to block ${startBlock}\n`);
    else printit(`Resumed sync at block ${startBlock}\n`);

    await this.writeStatus({ polling: true });
        
    while (true) {
      if (Worker._closed === true) {
        Worker._done = true;
        return;
      }

      printit(`Processing blocks ${startBlock} to ${toBlock}`);

      // load transactions using batch calls
      let transactions = [];
      try {
        const blocks = await this.getBlocksBatch(startBlock, toBlock);
        blocks.forEach(block => {
          if (block.transactions) {
            for (let i = 0; i < block.transactions.length; i += 1) {
              block.transactions[i].timestamp = block.timestamp;
            }
            transactions = transactions.concat(block.transactions);
          }
        });
      } catch (e) {
        printit('Error fetching blocks, retry in 5 seconds');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      // filter down to trades and process them
      try {
        transactions = this.filterTrades(transactions);
        await this.processTransactions(transactions);
        this.currentBlock = toBlock;
      } catch (e) {
        console.log(e);
        console.log('Error processing transactions, retry in 5 seconds');
        Sentry.captureException(e);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      // loop until we have at least 1 new block to process
      startBlock = toBlock + 1;
      let first = true;
      do {
        if (Worker._closed === true) {
          Worker._done = true;
          return;
        }

        try {
          maxBlock = await web3.eth.getBlockNumber();
          toBlock = Math.min(maxBlock, startBlock + pollingChunkSize - 1);
          if (startBlock >= toBlock) {
            if (first === true) printit(`Waiting for new blocks @fter ${toBlock}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          first = false;
        } catch (e) {
          console.log(`Unexpected error waiting for new blocks, cooldown for 30 seconds ${e.message}`);
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }
      } while (startBlock >= toBlock);
    }
  }

  async processTransactions(transactions, skipToBlock = 0, isSnapshot = false) {
    transactions = transactions.filter(tx => tx.blockNumber > skipToBlock);

    if (isSnapshot === false) {
      let temp = [];
      while (transactions.length > 0) {
        const toFilter = transactions.splice(0, 250);
        const withReceipts = await filterByReceipts(toFilter);
        temp = temp.concat(withReceipts);
      }
      transactions = temp;
    }

    if (process.env.MAKE_SNAPSHOTS === '1') {
      const stream = fsWithCallbacks.createWriteStream('snapshots.out', { flags: 'a' });
      for (const tx of transactions) {
        await new Promise((resolve, reject) => {
          stream.write(
            `${JSON.stringify(tx)}\n`,
            error => {
              if (error) {
                return reject(error);
              }
              resolve();
            });
        });
      }
      stream.end();
    }

    const json = await Promise.all(transactions.map(async tx => tradeToJson(tx)));
    while (json.length > 0) {
      const records = json.splice(0, 100);
      try {
        await db.sequelize.models.Trade.bulkCreate(records, {
          updateOnDuplicate: ['nonce', 'timestamp'],
          validate: false,
        });
      } catch (e) {
        if (Worker._closed !== true) {
          console.log('Aggregate Error!');
          throw (e);
        }
      }
    }
    this.processed += transactions.length;
  }
}

export default Worker;
