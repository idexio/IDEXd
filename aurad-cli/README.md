aura
=====



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @auroradao/aurad-cli
$ aura COMMAND
running command...
$ aura (-v|--version|version)
@auroradao/aurad-cli/0.1.2 darwin-x64 node-v10.12.0
$ aura --help [COMMAND]
USAGE
  $ aura COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`aura config`](#aura-config)
* [`aura help [COMMAND]`](#aura-help-command)
* [`aura logs`](#aura-logs)
* [`aura restart`](#aura-restart)
* [`aura start`](#aura-start)
* [`aura status`](#aura-status)
* [`aura stop`](#aura-stop)
* [`aura up`](#aura-up)

## `aura config`

Configure your staking wallet

```
USAGE
  $ aura config
```

_See code: [src/commands/config.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/config.js)_

## `aura help [COMMAND]`

display help for aura

```
USAGE
  $ aura help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.4/src/commands/help.ts)_

## `aura logs`

Print raw logs

```
USAGE
  $ aura logs

OPTIONS
  -n, --name=name  name of log to print (aura, parity or mysql)
```

_See code: [src/commands/logs.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/logs.js)_

## `aura restart`

Restart aura background services

```
USAGE
  $ aura restart

OPTIONS
  -r, --rpc=rpc  rpc server
```

_See code: [src/commands/restart.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/restart.js)_

## `aura start`

Start the aura staking app

```
USAGE
  $ aura start

OPTIONS
  -r, --rpc=rpc  rpc server
```

_See code: [src/commands/start.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/start.js)_

## `aura status`

Check status for your staking node

```
USAGE
  $ aura status
```

_See code: [src/commands/status.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/status.js)_

## `aura stop`

Stop aura background services

```
USAGE
  $ aura stop
```

_See code: [src/commands/stop.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/stop.js)_

## `aura up`

Launch aura services in background

```
USAGE
  $ aura up
```

_See code: [src/commands/up.js](https://github.com/auroradao/aurad/blob/v0.1.2/src/commands/up.js)_
<!-- commandsstop -->
