idex
=====



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @idexio/idexd-cli
$ idex COMMAND
running command...
$ idex (-v|--version|version)
@idexio/idexd-cli/0.2.0 darwin-x64 node-v11.14.0
$ idex --help [COMMAND]
USAGE
  $ idex COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`idex config`](#idex-config)
* [`idex help [COMMAND]`](#idex-help-command)
* [`idex logs`](#idex-logs)
* [`idex restart`](#idex-restart)
* [`idex start`](#idex-start)
* [`idex status`](#idex-status)
* [`idex stop`](#idex-stop)
* [`idex up`](#idex-up)

## `idex config`

Configure your staking wallet

```
USAGE
  $ idex config
```

_See code: [src/commands/config.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/config.js)_

## `idex help [COMMAND]`

display help for idex

```
USAGE
  $ idex help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.4/src/commands/help.ts)_

## `idex logs`

Print raw logs

```
USAGE
  $ idex logs

OPTIONS
  -n, --name=name  name of log to print (idexd, parity or mysql)
```

_See code: [src/commands/logs.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/logs.js)_

## `idex restart`

Restart aura background services

```
USAGE
  $ idex restart

OPTIONS
  -r, --rpc=rpc  rpc server
```

_See code: [src/commands/restart.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/restart.js)_

## `idex start`

Start the idex staking app

```
USAGE
  $ idex start

OPTIONS
  -r, --rpc=rpc  rpc server
```

_See code: [src/commands/start.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/start.js)_

## `idex status`

Check status for your staking node

```
USAGE
  $ idex status
```

_See code: [src/commands/status.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/status.js)_

## `idex stop`

Stop aura background services

```
USAGE
  $ idex stop
```

_See code: [src/commands/stop.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/stop.js)_

## `idex up`

Launch aura services in background

```
USAGE
  $ idex up
```

_See code: [src/commands/up.js](https://github.com/idexio/idexd/blob/v0.2.0/src/commands/up.js)_
<!-- commandsstop -->
