const request = require('request-promise');
const rxjs = require('rxjs');
const Web3 = require('web3');
const util = require('./util');
const chalk = require('chalk');
const Promise = require('bluebird');

const AURA_INTERFACE = [{
  constant: true,
  inputs: [{ name: '_owner', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: 'balance', type: 'uint256' }],
  type: 'function',
}];
  
const AURA_ADDRESS = '0xcdcfc0f66c522fd086a1b725ea3c0eeb9f9e8814';

module.exports = class Parity {
  constructor(rpcHost) {
    this.rpcHost = rpcHost || 'http://localhost:8545';
    this.web3 = new Web3(new Web3.providers.HttpProvider(rpcHost));
    this.contract = new this.web3.eth.Contract(AURA_INTERFACE, AURA_ADDRESS);
  }

  async tryPeersMessage() {
    try {
      const peers = await request({
        uri: this.rpcHost,
        method: 'POST',
        json: {
          "method": "parity_netPeers",
          "params":[],
          "id": Date.now(),
          "jsonrpc": "2.0"
        }
      });
      if (peers && peers.result) {
        return `RPC Connected (${peers.result.connected}/${peers.result.max} peers)`;
      }
    } catch(e) {
      return 'Waiting for RPC';
    }
  }

  // if parity gives status, return that
  // if parity is not synching, check if the latest block is recent enough
  async isSynced(gracePeriod = 300) {
    let syncing = await this.web3.eth.isSyncing();
  
    if (syncing === false) {
      // not synching, but is it current?
    
      let block = await this.web3.eth.getBlock('latest', false);
      let lastTimestamp = Number((block && block.timestamp) || 0);
    
      if (lastTimestamp < (Date.now()/1000 - gracePeriod)) {
        return { startingBlock: 0, currentBlock: 0, highestBlock: 1 }
      } else {
        return(false);
      }
    } else {
      return(syncing);
    }
  }
  
  syncObservable() {
    return new rxjs.Observable(async observer => {
      let progress = 0;
      let message = '';
      let timer = setInterval(async () => {
        try {
          let syncing = await this.isSynced();
          if (syncing === false) {
            progress = 1;
          } else {
            let currentBlock = Number(syncing.currentBlock);
            let startingBlock = Number(syncing.startingBlock);
            let highestBlock = Number(syncing.highestBlock);

            if (startingBlock === 0 && highestBlock === 1) {
              message = await this.tryPeersMessage();
            } else {
              progress = (currentBlock - startingBlock) / (highestBlock - startingBlock);
              message = `${currentBlock}/${highestBlock}`;
            }
          }
        } catch(e) {
          message = await this.tryPeersMessage();
        }
        if (progress < 1) {
          observer.next(util.createBar(progress, process.stdout.columns - 12 - message.length, message));
        } else {
          clearInterval(timer);
          observer.complete();
        }
      }, 500);
    });
  }
  
  async getFirstBlockWithAge(endBlock, age) {
    const target = Date.now() / 1000 - age;
    let lo = endBlock - 100000;
    let hi = endBlock - 10000;
    
    while (lo <= hi) {
      let mid = Math.trunc((hi + lo) / 2);
      let block = await this.web3.eth.getBlock(mid, false);
    
      if (target < block.timestamp) {
        hi = mid - 1;
      } else if (target > block.timestamp) {
        lo = mid + 1;
      } else {
        return(mid);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return(lo);
  }
  
  async waitForRpc() {
    let response;
    let timeout = setTimeout(() => {
      throw(new Error('RPC connect timeout'));
    }, 60000);
    
    do {
      try {
        response = await request({
          uri: this.rpcHost,
          method: 'POST',
          json: {
            jsonrpc: '2.0',
            method: 'net_version',
            params: [],
            id: Date.now()
          }
        });
      } catch(e) {
 
      } finally {
        if (!response) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while(response == null);
     
    clearTimeout(timeout);
  }
  
  balanceFormat(b) {
    b = b.toString().padStart(19, '0');
    return b.substr(0, b.length - 18) + '.' + b.substr(b.length - 18);
  }
  
  async getCurrentBalance(staker, blockNumber) { 
    let b = await this.contract.methods.balanceOf(staker).call(null, blockNumber);
    return this.balanceFormat(b);
  }
  
  async checkBalancesObservable(staker, ctx, age = 60*60*24*7) {
    return new rxjs.Observable(async observer => {
      let progress = 0;
      let message = '';
      
      let timer = setInterval(async () => {        
        if (progress < 1) {
          observer.next(util.createBar(progress, process.stdout.columns - 12 - message.length, message));
        } else {
          clearInterval(timer);
          observer.complete();
        }
      }, 500);
      
      try {
        message = 'Finding transactions...'
        
        const latestBalance = BigInt(await this.contract.methods.balanceOf(staker).call(null, 'latest'));
        let currentBalance = latestBalance;
        let minBalance = currentBalance;
        
        const endBlock = await this.web3.eth.getBlockNumber();
        const startBlock = await this.getFirstBlockWithAge(endBlock, age);
        let toBlock = endBlock-1;
        
        message = `AURA since ${endBlock}: ${this.balanceFormat(currentBalance)}`;
                
        progress = 0.1;
    
        const topic = `0x${staker.substr(2).padStart(64, '0')}`;
        let fromBlock = Math.max(startBlock, toBlock - 999);
        
        while (fromBlock > startBlock) {          
          let logs = await this.web3.eth.getPastLogs({
            fromBlock,
            toBlock,
            address: AURA_ADDRESS,
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              null,
              topic
            ]
          });
          
          logs = logs.concat(await this.web3.eth.getPastLogs({
            fromBlock,
            toBlock,
            address: AURA_ADDRESS,
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              topic,
              null
            ]
          }));
          
          logs.sort((a,b) => (b.blockNumber - a.blockNumber));
          logs.forEach(log => {
            const from = log.topics[1];
            const to = log.topics[2];
            const amount = BigInt(log.data);
            
            if (from == topic) {
              currentBalance = currentBalance + amount;
            }
            if (to == topic) {
              currentBalance = currentBalance - amount;
            }
            if (currentBalance < minBalance) minBalance = currentBalance;
          });

          message = `AURA since ${fromBlock}: ${this.balanceFormat(currentBalance)}`;
          
          if (currentBalance < 10000000000000000000000) {
            clearTimeout(timer);
            ctx.failed = true;
            ctx.balance = currentBalance;
            observer.complete();
          }
          
          toBlock = Math.max(startBlock,fromBlock - 1);
          fromBlock = Math.max(startBlock, fromBlock - 999);
          
          progress = 0.1 + 0.8 * (endBlock - fromBlock) / (endBlock - startBlock);
        }     
        progress = 1;
      } catch(e) {
        message = e.toString();
      }
    });
  }
}