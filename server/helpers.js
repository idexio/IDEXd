import Web3 from 'web3';
import Promise from 'bluebird';
import request from 'request-promise';
import constants from './constants';
import config from './config';

const rpcHost = `${config.rpc.protocol}://${config.rpc.host.split('/')[0]}:${config.rpc.port}/${config.rpc.host.split('/').slice(1).join('/')}`;
const web3 = new Web3(new Web3.providers.HttpProvider(rpcHost));
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
