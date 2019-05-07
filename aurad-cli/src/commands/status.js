const {Command, flags} = require('@oclif/command')
const request = require('request-promise');
const fs = require('fs');
const chalk = require('chalk');
const cliUtil = require('../shared/util');
const Docker = require('../shared/docker');
const package_json = require('../../package.json');
const homedir = require('os').homedir();
const semver = require('semver');
const registryUri = 'https://registry.npmjs.org/@idexio/idexd-cli';
const { STAKING_HOST } = require('../shared/config');

class StatusCommand extends Command {
  async run() {
 
    let docker = new Docker();
    let json;
    
    try {
      const settings = fs.readFileSync(`${homedir}/.idexd/ipc/settings.json`);
      json = JSON.parse(settings);
    } catch(e) {
      console.log("Error loading wallet, please run 'idex config' first");
      return;
    }

    console.log(`idexd-cli v${package_json.version}`);

    const packageInfo = await request({ uri: registryUri, json: true });
    const latestVersion = packageInfo['dist-tags'].latest;

    if (semver.lt(package_json.version, latestVersion)) {
      console.log(`Latest version: ${'v'+latestVersion} (update available)`);
    } else {
      console.log(`Latest version: ${chalk.green('v'+latestVersion)}`);
    }
    console.log(`Cold wallet: ${json.coldWallet}`);
    
    let uri = `${STAKING_HOST}/wallet/${json.coldWallet}/spot-balances`;
    const { balance, total, isQualified, dateAvailable } = await request({uri, json:true});
    
    const description = (isQualified === true) ? '' : ` (eligible for staking at ${dateAvailable})`;
    console.log(`Staked IDEX: ${Number(balance).toFixed(2)} IDEX ${description}`);
    console.log(`Total Staked IDEX: ${Number(total).toFixed(2)} IDEX`);

    try {
      const { keepAlive } = await cliUtil.getAuradStatus(docker);
      if (keepAlive) {
        if ((parseInt(keepAlive.status) === 200) && (keepAlive.timestamp > (Date.now() - 70000))) {
          console.log(`Staking: ${chalk.green('online')} [${new Date(keepAlive.timestamp)}]`);
        } else {
          console.log(`Staking: ${chalk.red('offline')} [${new Date(keepAlive.timestamp)}]`);
        }
        if (keepAlive.message) {
          console.log(`Status: ${keepAlive.message}`);
        }
      } else {
        console.log(`Staking: ${chalk.red('offline')} [${new Date()}]`);
      }
    } catch(e) {
      console.log(`Staking: ${chalk.red('offline')} [${new Date()}]`);
    }
    
    uri = `${STAKING_HOST}/wallet/${json.coldWallet}/reward-summary-v2`;
    const values = await request({uri, json:true});
    
    for(let key in values.summary) {
      console.log(`${key}: ${values.summary[key]}`);
    }
  }
}

StatusCommand.description = `Check status for your staking node`

StatusCommand.flags = {
}

module.exports = StatusCommand
