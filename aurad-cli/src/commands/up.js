const {Command, flags} = require('@oclif/command')
const Docker = require('../shared/docker');
const docker = new Docker();

class UpCommand extends Command {
  async run() {
    const {flags} = this.parse(UpCommand)
    let [dockerCmd, dockerVersion] = await docker.hasDocker();
    let [dockerComposeCmd, dockerComposeVersion] = await docker.hasCompose();
    console.log('Docker version ' + dockerVersion);
    console.log('Compose version ' + dockerComposeVersion);
    
    let up = await docker.up();
    let containers = await docker.getRunningContainerIds();  
    console.log(containers);
  }
}

UpCommand.description = `Launch aura services in background`

UpCommand.flags = {
}

module.exports = UpCommand
