import Web3 from 'web3';
import Promise from 'bluebird';
import request from 'request-promise';
import constants from './constants';
import config from './config';

const rpcHost = `${config.rpc.protocol}://${config.rpc.host.split('/')[0]}:${config.rpc.port}/${config.rpc.host.split('/').slice(1).join('/')}`;
let provider;

if (process.env.TOXIC_RPC == '1') {
  // use a proxy to simulate bad network behavior
  // toxiproxy-cli create alchemy -l localhost:9009 -u eth-mainnet.alchemyapi.io:80
  // toxiproxy-cli toxic add alchemy -t latency -a latency=5000 -a jitter=5000 -n slow --upstream
  class DebugHttpProvider {
    constructor(host) {
      this.host = host || 'http://localhost:8545';
    }
    send(payload, callback) {
      request({
        uri: this.host,
        method: 'POST',
        json: payload,
        headers: this.headers,
      })
      .then(v => callback(null, v))
      .catch(callback)
    }
  }
  process.env.HTTP_PROXY = "http://localhost:9009";
  process.env.NO_PROXY = "api.idex.market";
  provider = new DebugHttpProvider(rpcHost);
} else {
  provider = new Web3.providers.HttpProvider(rpcHost, {timeout: 5000});
}

const web3 = new Web3(provider);
const contract = new web3.eth.Contract(constants.AURA_INTERFACE, constants.AURA_ADDRESS);

async function getBalance(staker, blockNumber) {
  return contract.methods.balanceOf(staker).call(null, blockNumber);
}

async function waitForRpc(delay = 10000) {
  let success = false;
  do {
    try {
      request({
        uri: rpcHost,
        method: 'POST',
        json: {
          jsonrpc: '2.0',
          method: 'net_version',
          params: [],
          id: Date.now(),
        },
      });
      success = true;
    } catch (e) {
      console.log('waiting for rpc');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  } while (success !== true);
}

module.exports = {
  web3,
  waitForRpc,
  contract,
  getBalance,
};
