const {Command, flags} = require('@oclif/command');
const StartCommand = require('./start');
const StopCommand = require('./stop');

class RestartCommand extends Command {
  async run() {
    const {flags} = this.parse(RestartCommand)
    await StopCommand.run([]);
    const opts = [];
    for (let flag in flags) {
      opts.push([`--${flag}`, flags[flag]]);
    }
    await StartCommand.run(opts);
  }
}

RestartCommand.description = `Restart aura background services`

RestartCommand.flags = {
  rpc: flags.string({char: 'r', description: 'rpc server'}),
}

module.exports = RestartCommand
