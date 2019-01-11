const {Command, flags} = require('@oclif/command')

const Listr       = require('listr');
const chalk       = require('chalk');
const fs          = require('fs');
const rxjs        = require('rxjs');
const moment      = require('moment');
const {cli}       = require('cli-ux');
const request     = require('request-promise');
const Docker      = require('../shared/docker');
const Parity      = require('../shared/parity');
const messages    = require('../shared/messages');
const cliUtil     = require('../shared/util');
const homedir     = require('os').homedir();

let docker = null;
let parity = null;

const start = new Listr([
    {
        title: 'Starting AuraD',
        task: () => {
          return new Listr([
            {
                title: 'Launching Local Services',
                task: async () => {
                  await docker.up(['parity', 'mysql']);
                }
            }
        ]);
      }
    },
    {
        title: 'Updating IDEX Trade History',
        task: () => {
          return new Listr([
            {
                title: 'Synchronizing Ethereum Node',
                task: async () => {
                  await parity.waitForRpc();
                  return parity.syncObservable();
                },
                enabled: ctx => (docker.rpcIsCustom() !== true),
            },
            {
                title: 'Downloading IDEX Snapshots',
                task: async () => {
                  let obj = {};                  
                  
                  while(!obj.mysql) {
                    obj = await docker.getRunningContainerIds();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  await docker.up(['aurad']);
                  
                  return new rxjs.Observable(observer => {
                    let progress = 0;
                    let message = '';
                    let timer = setInterval(async () => {
                      try {
                        let status = await cliUtil.getAuradStatus(docker);
                        let {downloadsStart, downloadsCurrent, downloadsEnd, polling, keepAlive} = status;
                        if (downloadsStart && downloadsCurrent && downloadsEnd) {
                          if (downloadsStart == downloadsEnd) progress = 1;
                          else progress = (downloadsCurrent - downloadsStart) / (downloadsEnd - downloadsStart);
                        } else {
                          // no downloads being tracked, and polling flag is on
                          if (polling && polling === true) {
                            progress = 1;
                          }
                        }
                        message = Number(100*progress).toFixed(2)+"%";
                      } catch(e) {
                        //message = e.toString();
                      }
                      if (progress < 1) {
                        observer.next(cliUtil.createBar(progress, process.stdout.columns  - 12 - message.length, message));
                      } else {
                        clearInterval(timer);
                        observer.complete();
                      }
                    }, 500);
                  });
                }
            }            
        ], {concurrent: false});}
    },
    {
        title: 'Writing IDEX Trades',
        task: () => {
          return new rxjs.Observable(observer => {
            let progress = 0;
            let timer = setInterval(async () => {
              try {
                let status = await cliUtil.getAuradStatus(docker);
                let {snapshotsStart, snapshotsCurrent, snapshotsEnd, polling, keepAlive} = status;
                if (snapshotsStart && snapshotsCurrent && snapshotsEnd) {
                  progress = (snapshotsCurrent - snapshotsStart) / (snapshotsEnd - snapshotsStart);
                } else {
                  // no downloads being tracked, and polling flag is on
                  if (polling && polling === true) {
                    progress = 1;
                  }
                }
              } catch(e) {}
              if (progress < 1) {
                observer.next(cliUtil.createBar(progress, process.stdout.columns-18, ' '+Number(100*progress).toFixed(2)+"%"));
              } else {
                clearInterval(timer);
                observer.complete();
              }
            }, 500);
          });
        }
    },
    {
        title: 'Serving IDEX Requests',
        task: () => {return new Promise(resolve => setTimeout(resolve, 1000))}
    }
]);

class StartCommand extends Command {
  async run() {
    const {flags} = this.parse(StartCommand)
    let rpc = flags.rpc || ''
    
    parity = new Parity(rpc || 'http://localhost:8545');
    docker = new Docker(rpc || 'http://parity:8545');
    docker.requireDocker();
    console.log(messages.WELCOME_MESSAGE);
    
    if (rpc) {
      console.log('Using custom RPC = ' + rpc);
    }
    
    try {
      const settings = fs.readFileSync(`${homedir}/.aurad/ipc/settings.json`);
      const json = JSON.parse(settings);
    } catch(e) {
      console.log("Error loading wallet, please run 'aura config' first");
      return;
    }
    
    await start.run();
  }
}

StartCommand.description = `Start the aura staking app`

StartCommand.flags = {
  rpc: flags.string({char: 'r', description: 'rpc server'}),
}

module.exports = StartCommand
