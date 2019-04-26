require('dotenv').config({ path: `${__dirname}/../containers/docker/aurad_config.env` })

const commandExists = require('command-exists');
const util = require('util');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);
const execFile = util.promisify(require('child_process').execFile);
const homedir = require('os').homedir();
const mkdirp = require('mkdirp');
const Promise = require('bluebird');
const url = require('url');
const rimraf = require("rimraf");
const { STAKING_HOST } = require('../shared/config');

module.exports = class Docker {
  constructor(rpcUrl) {
    this.rpcUrl = rpcUrl || 'http://parity:8545';
  }
  
  env() {
    const rpc = url.parse(this.rpcUrl);
    const RPC_HOST = `${rpc.hostname}${rpc.pathname}`;
    const RPC_PROTOCOL = rpc.protocol.slice(0,-1);
    const RPC_PORT = rpc.port || (RPC_PROTOCOL === 'http' ? '80' : (RPC_PROTOCOL === 'https' ? '443' : ''));
    
    return `HOME=${homedir} RPC_HOST=${RPC_HOST} RPC_PROTOCOL=${RPC_PROTOCOL} RPC_PORT=${RPC_PORT} STAKING_HOST=${STAKING_HOST}`;
  }
  
  rpcIsCustom() {
    return (this.rpcUrl !== 'http://parity:8545');
  }
  
  async ensureDirs() {
    await mkdirp(`${homedir}/.idexd`);
    await this.migrateDirs();
    const dirs = [
      `${homedir}/.idexd/db`,
      `${homedir}/.idexd/ipc`,
      `${homedir}/.idexd/downloads`
    ];
    
    await Promise.map(dirs, dir => mkdirp(dir));

    if (process.getuid && process.getuid() === 0) {
      console.warn('[WARNING] running `idex` as root is not recommended');
    }
  }
  
  async migrateDirs() {
    if (fs.existsSync(`${homedir}/.aurad`)) {
      const runningContainers = await this.getRunningContainerIds();
      if (runningContainers['aurad'] || runningContainers['mysql']) {
        throw new Error('Cannot migrate .aurad data while containers are running. Please run `idex stop` first.');
      }
      if (fs.existsSync(`${homedir}/.aurad/db`)) {
        fs.renameSync(`${homedir}/.aurad/db`, `${homedir}/.idexd/db`);
      }
      if (fs.existsSync(`${homedir}/.aurad/ipc`)) {
        fs.renameSync(`${homedir}/.aurad/ipc`, `${homedir}/.idexd/ipc`);
      }
      if (fs.existsSync(`${homedir}/.aurad/downloads`)) {
        fs.renameSync(`${homedir}/.aurad/downloads`, `${homedir}/.idexd/downloads`);
      }
      if (fs.existsSync(`${homedir}/.aurad`)) {
        rimraf.sync(`${homedir}/.aurad`, {}, () => {});
      }
    }
  }
  
  async requireDocker() {
    try {
      let [dockerCmd, dockerVersion] = await this.hasDocker();
    } catch(e) {
      console.log('Docker is required.');
      process.exit(1);
    }

    try {
      let [composeCmd, composeVersion] = await this.hasCompose();
    } catch(e) {
      console.log('Docker Compose is required.');
      process.exit(1);
    }
  }
  
  composeFile() {
    return `${__dirname}/../containers/docker/docker-compose.yml`;
  }
  
  statusFile() {
    return `${homedir}/.idexd/ipc/status.json`;
  }

  async pull(services = []) {
    let [cmd, version] = await this.hasCompose();
    let {stdout} = await exec(`${this.env()} ${cmd} -f ${this.composeFile()} pull ${services.join(' ')}`);
    return(stdout);
  }
    
  async up(services = ['parity', 'mysql', 'idexd']) {
    this.ensureDirs();
    
    let [cmd, version] = await this.hasCompose();
    
    // only parity, but we're not using it
    if (this.rpcIsCustom() === true) {
      services = services.filter(s => s !== 'parity');
    }
    
    if (services.length === 0) return;
    
    await this.pull(services);
    
    let {stdout} = await exec(`${this.env()} ${cmd} -f ${this.composeFile()} up -d ${services.join(' ')}`);
    return(stdout);
  }
  
  async down() {
    let [cmd, version] = await this.hasCompose();
    let [dcmd, dversion] = await this.hasDocker();
    let containers = await this.getRunningContainerIds();
    try {
      await exec(`${dcmd} stop autoheal`);
    } catch(e){
      // ok to fail -- only for systems still running autoheal
    }
    if (containers['aurad']) {
      console.log('Stopping AuraD');
      try {
        await exec(`${dcmd} exec ${containers['aurad']} pm2 stop worker`);
        await exec(`${cmd} -f ${this.composeFile()} stop -t 20 aurad`);
      } catch(e){
        console.log(e);
      }
    }
    if (containers['idexd']) {
      console.log('Stopping IDEXd');
      try {
        await exec(`${dcmd} exec ${containers['idexd']} pm2 stop worker`);
        await exec(`${cmd} -f ${this.composeFile()} stop -t 20 idexd`);
      } catch(e){
        console.log(e);
      }
    }
    if (containers['mysql']) {
      console.log('Stopping MySQL');
      try {await exec(`${cmd} -f ${this.composeFile()} stop mysql`)} catch(e){console.log(e)}
    }
    if (containers['parity']) {
      console.log('Stopping Parity');
      try {await exec(`${cmd} -f ${this.composeFile()} stop parity`)} catch(e){console.log(e)}
    }
    console.log('Cleaning up');
    let {stdout} = await exec(`${cmd} -f ${this.composeFile()} down`);
    return(stdout);
  }
  
  async getRunningContainerIds() {
    let [cmd, version] = await this.hasCompose();
    let ids = {};
    let result = await exec (`${cmd} -f ${this.composeFile()} ps -q mysql`);
    ids['mysql'] = result.stdout.toString().split('\n')[0];    
    result = await exec (`${cmd} -f ${this.composeFile()} ps -q parity`);
    ids['parity'] = result.stdout.toString().split('\n')[0]; 
    result = await exec (`${cmd} -f ${this.composeFile()} ps -q aurad`);
    ids['aurad'] = result.stdout.toString().split('\n')[0]; 
    result = await exec (`${cmd} -f ${this.composeFile()} ps -q idexd`);
    ids['idexd'] = result.stdout.toString().split('\n')[0]; 
    return(ids);
  }
  
  async getContainerLogs(app) {
    let [cmd, version] = await this.hasDocker();
    let {stdout, stderr} = await exec (`${cmd} logs --tail 10000 ${app}`, {maxBuffer: 1024*1024*10});
    return(stdout == '' ? stderr : stdout);
  }
  
  async dbMigrate() {
    let [cmd, version] = await this.hasCompose();    
    const {stdio} = await exec(`${cmd} -f ${this.composeFile()} run --entrypoint /usr/idexd/node_modules/.bin/sequelize idexd db:migrate`);
    return(stdio);
  }
  
  async dbRunning(app) {
    let [cmd, version] = await this.hasDocker();
    try {
      const {stdio} = await exec(`${cmd} exec ${app} mysqladmin -uroot --password=${process.env.MYSQL_ROOT_PASSWORD} ping`);
      return (stdio && stdio.toString().match('mysqld is alive'));
    } finally {
      return(false);
    }
  }
    
  async dbShutdown(app)  {
    let [cmd, version] = await this.hasDocker();
    const result = await exec(`${cmd} exec ${app} mysqladmin -uroot --password=${process.env.MYSQL_ROOT_PASSWORD} shutdown`);
  }
  
  async hasDocker() {
    try {
      let cmd = await commandExists('docker');
      const dockerVersion = await exec(`${cmd} version --format '{{.Server.Version}}'`);
      return [cmd, dockerVersion.stdout.split('\n')[0]];
    } catch(e) {
      return(false);
    }
  }
    
  async hasCompose() {
    try {
      let cmd = await commandExists('docker-compose');
      let composeVersion = await exec(`${cmd} -v`);
      composeVersion = composeVersion.stdout.match(/version ([0-9]+\.?){3,}/)[0].split(' ').pop();
      return [cmd, composeVersion];
    } catch(e) {
      console.log(e);
      return(false);
    }
  }
}