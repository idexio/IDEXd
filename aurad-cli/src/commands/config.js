const {Command, flags} = require('@oclif/command')
const Listr = require('listr');
const chalk = require('chalk');
const rxjs = require('rxjs');
const moment = require('moment');
const fs = require('fs');
const {cli} = require('cli-ux');
const crypto = require('crypto');
const request = require('request-promise');
const request_errors = require('request-promise/errors');
const Docker = require('../shared/docker');
const Parity = require('../shared/parity');
const messages = require('../shared/messages');
const BigNumber = require('bignumber.js');
const homedir = require('os').homedir();

const STAKING_HOST = 'https://sc.idex.market';
const parity = new Parity('http://offline');

const docker = new Docker();
docker.ensureDirs();

async function getChallenge(address) {
  return new Promise((resolve, reject) => {
    request({
      uri: `${STAKING_HOST}/wallet/${address}/challenge`,
      json: true,
    }).then(result => {
      resolve(result.message);
    }).catch(request_errors.StatusCodeError, reason => {
      reject(reason.statusCode);
    });
  });
}

async function getBalance(address) {
  return request({
    uri: `${STAKING_HOST}/wallet/${address}/balance`,
    json: true,
  });
}

async function submitChallenge(coldWallet, hotWallet, signature) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      uri: `${STAKING_HOST}/wallet/${coldWallet}/challenge`,
      json: {
        hotWallet,
        signature
      },
    })
    .then(resolve)
    .catch(request_errors.StatusCodeError, reason => {
      reject(reason.statusCode);
    });
  });
}

async function anykey(cli, message) {
  const char = await cli.prompt(message, {type: 'single', required: false})
  process.stderr.write('\n')
  return char
}

class ConfigCommand extends Command {
  async run() {
    const {flags} = this.parse(ConfigCommand);
    console.log(messages.WALLET_EXPLAINER);
 
    const containers = await docker.getRunningContainerIds();
    if (containers['aurad']) {
      console.log(`Error: aurad is running, please run 'aura stop' before updating your config`);
      return;
    }
   
    let coldWallet = await cli.prompt('    ' + chalk.blue.bgWhite(messages.WALLET_PROMPT));      
    let challenge;
    try {
      challenge = await getChallenge(coldWallet);
    } catch(status) {
      if (status == 403) {
        console.log(`    ${chalk.red('ERROR')}: Your cold wallet is not qualified for staking`);
      } else {
        console.log(`    ${chalk.red('ERROR')}: Unknown error getting signing challenge`);
      }
      return;   
    }
    
    const { balance } = await getBalance(coldWallet);
    
    console.log('');
    
    let balanceFormatted = (new BigNumber(balance)).dividedBy(new BigNumber('1000000000000000000')).toString();
    
    console.log(`\n    Your staked ${chalk.cyan('AURA')} balance is ${balanceFormatted}.`);
    console.log(`    Use https://www.myetherwallet.com/signmsg.html or your preferred wallet software to sign this *exact* message:\n    ${chalk.blue.bgWhite(challenge)}${chalk.white.bgBlack('  ')}\n`);

    let signature = await cli.prompt('    "sig" value', {type: 'mask'});
    
    let recovered;
    try {
      recovered = await parity.web3.eth.accounts.recover(challenge, signature);
    } catch(e) {
      console.log('Error decoding sig value');
      return;
    }
    
    if (recovered.toLowerCase() != coldWallet.toLowerCase()) {
      console.log(`    ${chalk.red('ERROR')}: Your cold wallet is ${coldWallet.toLowerCase()} but you signed with ${recovered.toLowerCase()}`);
      return;
    }
    
    console.log('    Wallet signature confirmed.');
    
    let newAccount = await parity.web3.eth.accounts.create();
    
    try {   
      let result = await submitChallenge(coldWallet, newAccount.address, signature);  

      const buffer = await crypto.randomBytes(16);
      const token = buffer.toString('hex');
      
      let keystore = parity.web3.eth.accounts.encrypt(newAccount.privateKey, token);
  
      const settings = {
        coldWallet,
        token,
        hotWallet: keystore,
      };
  
      fs.writeFileSync(`${homedir}/.aurad/ipc/settings.json`, JSON.stringify(settings));        
      console.log('\n    Staking wallet confirmed. Run \'aura start\' to download IDEX trade history and begin staking.\n');
    } catch(e) {
      console.log('\n    Error submitting cold wallet challenge');
    }
  }
}

ConfigCommand.description = `Configure your staking wallet`

ConfigCommand.flags = {
}

module.exports = ConfigCommand
