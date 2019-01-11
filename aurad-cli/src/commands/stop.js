const {Command, flags} = require('@oclif/command')
const Docker = require('../shared/docker');
const docker = new Docker();

class StopCommand extends Command {
  async run() {
    const {flags} = this.parse(StopCommand)
    let result = await docker.down();
    console.log(result);
  }
}

StopCommand.description = `Stop aura background services`

StopCommand.flags = {}

module.exports = StopCommand
