const {Command, flags} = require('@oclif/command')
const Docker = require('../shared/docker');

const docker = new Docker();

class LogsCommand extends Command {
  async run() {
    const {flags} = this.parse(LogsCommand)
    let name = flags.name || 'aurad'
    if (name == 'aura') name = 'aurad';
    name = name.toLowerCase();
    
    if (['aurad', 'mysql', 'parity'].indexOf(name) === -1) {
      console.log(`Invalid log name, choose one of 'aurad' (default), 'mysql' or 'parity'`);
      return;
    }
    
    let [dockerCmd, dockerVersion] = await docker.hasDocker();
    let [dockerComposeCmd, dockerComposeVersion] = await docker.hasCompose();
    console.log('Docker version ' + dockerVersion);
    console.log('Compose version ' + dockerComposeVersion);
    
    let containers = await docker.getRunningContainerIds(); 
    if (!containers[name]) {
      console.log(`Oops, looks like ${name} is not running.`);
      return;
    }
    
    let logStream = await docker.getContainerLogs(containers[name]);
    console.log(logStream);
  }
}

LogsCommand.description = `Print raw logs`

LogsCommand.flags = {
  name: flags.string({char: 'n', description: 'name of log to print (aura, parity or mysql)'})
}

module.exports = LogsCommand
