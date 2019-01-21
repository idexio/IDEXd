import Promise from 'bluebird';
import EventEmitter from 'events';
import request from 'request-promise';
import fsWithCallbacks from 'fs';
import writeFileAtomic from 'write-file-atomic';
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
      tokenMap, firstBlock, chunkSize, currentBlock: firstBlock, processed: 0,
    });
    this.initTokens(tokenMap);
    this._lock = new Lock();
  }

  static async build(firstBlock = IDEX_FIRST_BLOCK, chunkSize = 50) {
    const tokenMap = await Worker.getTokenMap();
    return new Worker(tokenMap, firstBlock, chunkSize);
  }

  static async getTokenMap() {
    return request({
      method: 'POST',
      uri: 'https://api.idex.market/returnCurrenciesWithPairs',
      json: true,
    });
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

  initTokens(tokenMap) {
    this.pairs = {};
    this.tokensBySymbol = {};
    this.tokensByAddress = {};

    tokenMap.tokens.forEach(obj => {
      this.tokensBySymbol[obj.symbol] = obj;
      this.tokensByAddress[obj.address] = obj;
    });

    for (const fromToken in tokenMap.pairs) {
      if (fromToken && typeof fromToken === 'string') {
        this.tokensBySymbol[fromToken].isBase = true;
        this.pairs[fromToken] = {};
        tokenMap.pairs[fromToken].forEach(toToken => { this.pairs[fromToken][toToken] = true; });
      }
    }
  }

  isBaseTokenAddress(address) {
    const token = this.tokensByAddress[address];
    return (token && this.tokensBySymbol[token.symbol].isBase === true);
  }

  async lastBlockProcessed() {
    const lastTrade = await db.sequelize.models.Trade.findOne({ order: [['blockNumber', 'DESC']] });
    const lastBlock = (lastTrade ? lastTrade.blockNumber : IDEX_FIRST_BLOCK - 1);
    return (lastBlock);
  }

  async downloadAll(urls, concurrency = 2) {
    let result;
    let snapshotsDownloaded = 0;
    const updater = setInterval(async () => {
      await this.writeStatus({ downloadsCurrent: snapshotsDownloaded });
    }, 500);
    try {
      await Promise.mapSeries(urls, async (path) => {
        if (Worker._closed === true) return Promise.resolve();
        snapshotsDownloaded += 1;
        printit(`Downloading snapshot ${snapshotsDownloaded} of ${urls.length}(${(100 * snapshotsDownloaded / urls.length).toFixed(2)}%)`);
        const snapshot = await this.getSnapshot(path, false);
        if (snapshot === null && parseInt(path.split('_')[0]) < 7000000) {
          throw new Error('Missing snapshot for ' + path);
        }
        printit(`${path} done`);
      }, { concurrency });
      result = Promise.resolve();
    } catch (e) {
      console.log('Error downloading snapshot');
      result = Promise.reject(e);
    } finally {
      await this.writeStatus({ downloadsCurrent: snapshotsDownloaded });
      clearInterval(updater);
    }
    
    snapshotsDownloaded = urls.length;
    await this.writeStatus({ downloadsCurrent: snapshotsDownloaded });
    
    return (result);
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

    await this.downloadAll(paths);

    let snapshotsProcessed = 0; let
      prevSnapshotsProcessed = 0;

    await this.writeStatus({
      snapshotsStart: 1,
      snapshotsEnd: paths.length,
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
        if (transactions && Array.isArray(transactions)) {
          await this.processTransactions(this.filterTrades(transactions), lastBlock, true);
          snapshotsProcessed += 1;         
          endBlock = Math.max(endBlock, parseInt(path.split('_')[1]));
          printit(`Loaded snapshot ${snapshotsProcessed} of ${paths.length}(${(100 * snapshotsProcessed / paths.length).toFixed(2)}%) -- ${endBlock}`);
          return Promise.resolve(snapshotsProcessed);
        } else {
          if (parseInt(path.split('_')[0]) < 7000000) {
            return Promise.reject(new Error('Bad transaction data for ' + path));
          } else {
            snapshotsProcessed += 1;
            return Promise.resolve(snapshotsProcessed);
          }
        }
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

  async filterByReceipts(txs) {
    const validTxs = [];

    // if receipts are already populated, just read the status
    txs = txs.filter(tx => {
      if (tx.txreceipt_status === '0') return (false);
      if (tx.txreceipt_status === '1') {
        validTxs.push(tx);
      }
      return (true);
    });

    if (txs.length === 0) return Promise.resolve(validTxs);
    const txsByHash = {};
    txs.forEach(tx => { (txsByHash[tx.hash] = tx); });

    const count = txs.length;
    let processed = 0;

    return new Promise((resolve, reject) => {
      const cb = (err, result) => {
        if (err) reject(err);
        else {
          if (!result) reject(new Error('receipt is null'));
          processed += 1;
          const tx = txsByHash[result.transactionHash];
          if (result.status === true) {
            Object.assign(tx, result);
            validTxs.push(txsByHash[result.transactionHash]);
          } else if (typeof result.status === 'undefined') {
            if (result.gasUsed !== tx.gas) {
              Object.assign(tx, result);
              validTxs.push(txsByHash[result.transactionHash]);
            }
          }
          if (processed === count) resolve(validTxs);
        }
      };

      const batch = new web3.BatchRequest();
      txs.map(tx => batch.add(web3.eth.getTransactionReceipt.request(tx.hash, cb)));
      batch.execute();
    });
  }

  async tradeToJson(tx) {

    // parsing the input with slice() and BigInt is drastically faster than web3 decodeParameters
    // replace the 'old' style here:
    // const args = web3.eth.abi.decodeParameters(['uint256[8]', 'address[4]', 'uint8[2]', 'bytes32[4]'], `0x${tx.input.substr(10)}`);
    // const [amountBuy, amountSell, expires, orderNonce, amount, tradeNonce, feeMake, feeTake] = args[0]; // eslint-disable-line
    // const [tokenBuy, tokenSell, maker, taker] = args[1].map(arg => arg.toLowerCase());

    tx.input = tx.input.substr(10);
    const param = (input, index, offset = 0) => input.substr(index*64 + offset, 64 - offset);
    const [
      amountBuy,
      amountSell,
      expires,
      orderNonce,
      amount,
      tradeNonce,
      feeMake,
      feeTake,
      tokenBuy,
      tokenSell,
      maker,
      taker
    ] = [
      BigInt('0x'+param(tx.input, 0)).toString(),
      BigInt('0x'+param(tx.input, 1)).toString(),
      BigInt('0x'+param(tx.input, 2)).toString(),
      BigInt('0x'+param(tx.input, 3)).toString(),
      BigInt('0x'+param(tx.input, 4)).toString(),
      BigInt('0x'+param(tx.input, 5)).toString(),
      BigInt('0x'+param(tx.input, 6)).toString(),
      BigInt('0x'+param(tx.input, 7)).toString(),
      '0x'+param(tx.input, 8, 24),
      '0x'+param(tx.input, 9, 24),
      '0x'+param(tx.input, 10, 24),
      '0x'+param(tx.input, 11, 24),
    ];

    // some old trades are no longer in our token map
    // they may have had their contract move, or be de-listed
    if (!this.tokensByAddress[tokenSell] && tokenSell !== '0x0000000000000000000000000000000000000000') {
      if (process.env.FULL_NODE === '1') {
        try {
          await this._lock.acquire();
          if (!this.tokensByAddress[tokenSell]) {
            const obj = await getTokenDetailsFromContract(tokenSell, tx.blockNumber);
            this.tokensBySymbol[obj.symbol] = obj;
            this.tokensByAddress[tokenSell] = obj;
          }
        } finally {
          this._lock.release();
        }
      } else {
        const obj = { name: tokenSell, symbol: tokenSell, decimals: 18 };
        this.tokensBySymbol[obj.symbol] = obj;
        this.tokensByAddress[tokenSell] = obj;
      }
    }

    if (!this.tokensByAddress[tokenBuy] && tokenBuy !== '0x0000000000000000000000000000000000000000') {
      if (process.env.FULL_NODE === '1') {
        try {
          await this._lock.acquire();
          if (!this.tokensByAddress[tokenBuy]) {
            const obj = await getTokenDetailsFromContract(tokenBuy, tx.blockNumber);
            this.tokensBySymbol[obj.symbol] = obj;
            this.tokensByAddress[tokenBuy] = obj;
          }
        } finally {
          this._lock.release();
        }
      } else {
        const obj = { name: tokenBuy, symbol: tokenBuy, decimals: 18 };
        this.tokensBySymbol[obj.symbol] = obj;
        this.tokensByAddress[tokenBuy] = obj;
      }
    }

    let symbolBuy = this.tokensByAddress[tokenBuy].symbol;
    let symbolSell = this.tokensByAddress[tokenSell].symbol;

    if ((symbolBuy === '') && (tokenBuy.toLowerCase() === '0xc66ea802717bfb9833400264dd12c2bceaa34a6d')) symbolBuy = 'MKR';
    if ((symbolSell === '') && (tokenSell.toLowerCase() === '0xc66ea802717bfb9833400264dd12c2bceaa34a6d')) symbolSell = 'MKR';

    const blockNumber = parseInt(tx.blockNumber);
    const timestamp = parseInt(tx.timeStamp || tx.timestamp);

    const type = this.isBaseTokenAddress(tokenBuy) ? 'buy' : 'sell';
    const buyerFee = (type === 'sell') ? feeTake : feeMake;
    const sellerFee = (type === 'sell') ? feeMake : feeTake;
    const gasFee = (BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice)).toString();

    const transactionHash = tx.hash;

    const tokenBuyDecimals = this.tokensByAddress[tokenBuy].decimals;
    const tokenSellDecimals = this.tokensByAddress[tokenSell].decimals;

    let numerator = BigInt(0);
    let denominator = BigInt(0);
    let numeratorDecimals = 0;
    let denominatorDecimals = 0;
    let amountDecimals = 0;

    if (type === 'buy') {
      [numerator, denominator, numeratorDecimals, denominatorDecimals, amountDecimals] = [
        BigInt(amountBuy),
        BigInt(amountSell),
        Number(tokenBuyDecimals),
        Number(tokenSellDecimals),
        Number(tokenBuyDecimals),
      ];
      amountDecimals = tokenBuyDecimals;
    } else {
      [numerator, denominator, numeratorDecimals, denominatorDecimals, amountDecimals] = [
        BigInt(amountSell),
        BigInt(amountBuy),
        Number(tokenSellDecimals),
        Number(tokenBuyDecimals),
        Number(tokenSellDecimals),
      ];
    }

    // force an extra 36 digits so we can safely divide with ints
    numerator *= BigInt(10) ** BigInt(36);
    let rawPrice = (numerator / denominator).toString();
    const decimalOffset = denominatorDecimals - numeratorDecimals - 36;

    rawPrice = rawPrice.padStart(Math.abs(decimalOffset) + 1, '0');
    let priceString = `${rawPrice.substr(0, rawPrice.length + decimalOffset)}.${rawPrice.substr(Math.max(0, rawPrice.length + decimalOffset), rawPrice.length)}`;
    if (priceString.slice(-1) === '.') priceString += '0';

    let amountString = amount.padStart(amountDecimals + 1, '0');
    amountString = `${amountString.substr(0, amountString.length - amountDecimals)}.${amountString.substr(Math.max(0, amountString.length - amountDecimals), amountString.length)}`;
    if (amountString.slice(-1) === '.') amountString += '0';

    let gasString = gasFee.padStart(19, '0');
    gasString = `${gasString.substr(0, gasString.length - 18)}.${gasString.substr(Math.max(0, gasString.length - 18), gasFee.length)}`;
    if (gasString.slice(-1) === '.') gasString += '0';

    let { nonce } = tx;
    
    nonce = String(nonce).padStart(20, '0');
    
    return Promise.resolve({
      blockNumber,
      timestamp,
      type,
      maker,
      taker,
      tokenBuy,
      tokenSell,
      symbolBuy,
      symbolSell,
      amount: amountString,
      amountBuy,
      amountSell,
      buyerFee,
      sellerFee,
      gasFee: gasString,
      transactionHash,
      price: priceString,
      nonce,
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
    let result; const
      file = `./downloads${path}`;
    try {
      if (load === true) {
        result = await fs.readFile(file);
        result = JSON.parse(result);
      } else {
        result = await fs.access(file, fsWithCallbacks.constants.R_OK);
      }
    } catch (e) {
      result = null;
      let retries = 3;
      let uri;

      while (!result && retries > 0) {
        try {
          retries -= 1;
          uri = `${process.env.SNAPSHOT_HOST}${path}`;
          const download = await request({
            uri,
            gzip: true,
            timeout: 300000,
          });
          result = JSON.parse(download);
          await writeFileAtomicPromise(file, JSON.stringify(result));
          return (result);
        } catch (e2) {
          console.log('Snapshot not found, retry');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
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
        const withReceipts = await this.filterByReceipts(toFilter);
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

    const json = await Promise.all(transactions.map(async tx => this.tradeToJson(tx)));    
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
          e.forEach(err => console.log(err));
          throw (e);
        }
      }
    }
    this.processed += transactions.length;
  }
}

export default Worker;
