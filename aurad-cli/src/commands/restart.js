const {Command, flags} = require('@oclif/command');
const StartCommand = require('./start');
const StopCommand = require('./start');

class RestartCommand extends Command {
  async run() {
    const {flags} = this.parse(RestartCommand)
    await StopCommand.run();
    await StartCommand.run(['--rpc', flags.rpc])
  }
}

RestartCommand.description = `Restart aura background services`

RestartCommand.flags = {
  rpc: flags.string({char: 'r', description: 'rpc server'}),
}

module.exports = RestartCommand
