# IDEXd: IDEX Staking Tier 3 [beta]

**Note: IDEXd is the [official successor](https://idex.market/staking) of AuraD and provides the same functionality and services based on the IDEX token. AuraD is no longer supported. Please [see below](#Upgrading-from-AuraD-to-IDEXd) for instructions on upgrading from AuraD to IDEXd.**

## Introduction

IDEXd is software that enables the [IDEX](https://idex.market/) community to stake IDEX tokens, serve parts of the IDEX production infrastructure, and earn fees for participation. IDEXd is the first part of a comprehensive plan to decentralize the centralized components of IDEX. For complete coverage, motivation, and roadmap, see our most recent post on [IDEX Staking](https://medium.com/idex/aura-staking-pos-earn-trade-fees-36319229ceae).

#### A note about versions

**IDEXd is currently beta software.** It is under development and subject to frequent changes, upgrades, and bug fixes. We appreciate your help in providing feedback and working around rough edges as we build towards 1.0.

## Requirements

### Staking

In order to be eligible to participate in IDEX Staking, you must have a wallet that holds a minimum of 10,000 IDEX for a minimum of 7 days. Dropping below a 10,000 IDEX balance, even for a brief period, will reset the incubation period.

### Hardware / VPS

IDEXd is designed to run on a computer or VPS that is continually connected to the internet with a stable IP address and inbound connectivity.

* 2GB+ memory
* 20GB+ storage

### Software

* Ubuntu 18.04 LTS
* Docker CE 18.09 ([Installation Guide](https://docs.docker.com/install/linux/docker-ce/ubuntu/))
* Docker Compose 1.17.1 ([Installation Guide](https://docs.docker.com/compose/install/))
* nvm ([Installation Guide](https://github.com/creationix/nvm))
* Node.js 10.15.0, npm 6.4.1 ([Installation Guide](https://github.com/creationix/nvm#usage))
* Git 17.1 ([Installation Guide](https://git-scm.com/downloads))

IDEXd is designed to support a wide range of systems, but for the beta we recommend sticking to these requirements and versions.

## Getting IDEXd

IDEXd is distrbuted via the @idexio/idexd-cli npm package with dependencies on Docker and Docker Compose.

## Getting Started

All of the requrements provide first-rate installation documentation, but we've collected the key steps to get up-and-running here. Start with a freshly installed copy of Ubuntu 18.04.

#### A note on users

Some VPS providers, such as Digital Ocean, set up new Ubuntu 18.04 instances with only the `root` user account configured. We recommend running IDEXd as a regular user account rather than `root`. When you first log in, run `whoami` to check which user you are currently acting as. If the response is `root`, follow Digital Ocean's [instructions](https://www.digitalocean.com/community/tutorials/how-to-add-and-delete-users-on-ubuntu-16-04) on adding a user and adding sudo privileges in order to run IDEXd.

Log out and log in to the new, non-`root` user account before proceeding.

### Install Docker CE

1. Update packages
```
sudo apt update
```
2. Install dependencies that allow `apt` to install packages via https
```
sudo apt-get install apt-transport-https ca-certificates curl software-properties-common
```
3. Add Docker’s official GPG key:
```
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
```
4. Add the stable Docker repository to `apt`
```
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
```
5. Update `apt` to include Docker packages
```
sudo apt update
```
6. Install the Docker CE package
```
sudo apt install docker-ce
```
7. Confirm Docker is running
```
sudo systemctl status docker
```
The output should look similar to:
```
● docker.service - Docker Application Container Engine
   Loaded: loaded (/lib/systemd/system/docker.service; enabled; vendor preset: enabled)
   Active: active (running) since Mon 2019-01-07 16:59:51 UTC; 5min 12s ago
     Docs: https://docs.docker.com
 Main PID: 4076 (dockerd)
    Tasks: 15
   CGroup: /system.slice/docker.service
           └─4076 /usr/bin/dockerd -H unix://
```
8. Add your user to the `docker` group to avoid permissions issues
```
sudo usermod -aG docker ${USER}
```
9. Log out and log back in and `docker` [commands](https://docs.docker.com/) will be available from the prompt

### Install Docker Compose

1. Install the Docker Compose package
```
sudo apt install docker-compose
```

### Install nvm, Node.js & npm

1. Install build depenency packages
```
sudo apt install build-essential python
```
2. Install `nvm`
```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
```
3. Log out and log back in and `nvm` [commands](https://github.com/creationix/nvm#usage) will be available from the prompt
4. Install Node.js
```
nvm install 10.15
```

### Install and launch IDEXd

1. Install `idexd-cli` to start and manage IDEXd
```
npm install -g @idexio/idexd-cli
```

2. Configure a staking wallet
```
idex config
```
IDEXd provides prompts asking for a staking wallet that contains at least 10,000 IDEX for 7 days. Go to [MyEtherWallet](https://www.myetherwallet.com/interface/sign-message) or your preferred wallet software to sign the challenge and provide the `sig` value to prove that you control the wallet.

IDEXd employs a cold-wallet design so that staked funds never need to leave the staking wallet for maximum security.

3. Sync your IDEX Node and start serving traffic
```
idex start
```
IDEXd connects to the Ethereum network and downloads IDEX trade history data to serve to IDEX users. Depending on the resources of the underlying computer or VPS and network, the initial syncing process may take a few minutes to several hours.

TODO: documentation on forcing a full sync vs fast sync

#### A note on connectivity

In order to serve data to IDEX users, IDEXd Nodes must be reachable from the public internet. Most home and office connections are not publicly reachable by default, so you may need to take steps like opening up specific ports on your router. IDEXd requires public TCP access to port 8443, and has limits on how frequently a node can change IP addresses.

We recommend running IDEXd on an always-on, contected machine or a cloud-hosted compute instance.

## Managing IDEXd

IDEXd is design to require minimal maintenance once it is live. For details on managing IDEXd
```
idex
```
to display documentation on the `idexd-cli`'s capabilities.

### Common management tasks

#### Examining logs

Logs are the best source of information to understand what's happening with IDEXd under the hood. To follow the IDEXd logs
```
docker logs -f docker_idexd_1
```

#### Checking your staking status

Display your node's current status and earnings history
```
idex status
```
*idexd-cli*

The currently running version of the client

*Latest Version*

Latest version of the client available. If different than the currently running version, "Update Available" will be displayed. Update instructions can be found in this README

*Cold Wallet*

Ethereum address of the wallet holding IDEX tokens for staking

*Staked IDEX*

The current IDEX balance you are staking to earn credits. If you are staking > 10,000 IDEX it will reflect immediately as long as your 10k minimum has incubated for 7+ days.

Notice: Any delays in updating your balance will be fixed at payout time based on the timestamp of the block in which you added the IDEX.

*Total Staking IDEX*

The current staked IDEX balance across all active stakers (updated approximately once per minute)

*Staking*

Either “Online” or “Offline”, with the time the client last connected with IDEX

*Current Period*

Date and times of the current staking period. Periods run for 14 days starting on Mon 00:00:00 UTC and ending on Sun 11:59:59 UTC. Payouts are made in ETH at the end of each period, based on your credits earned during that period.

*My Period Credits/ Total Period Credits*

The number of credits earned by the staker this period, over the total amount of credits earned by ALL stakers this period. 1 credit = 10k IDEX staked for 5 minutes while your node is “online”.

*Last Period Earnings*

Amount of ETH earned by the staker during the last period. Note that payouts less than $3 USD based on ETH spot price at period close are rolled over to the next period.

Notice: This will read “0.000000 ETH” immediately after a period has ended and will be updated once the period earnings are calculated and sent by IDEX. This happens with 48 hours of a period close.

*Last Period Credits*

The number of credits earned last period, over the total amount of credits earned by ALL stakers last period. Staker payout is calculated from these numbers.

*Earnings History*

URL to view the earnings history of the staker in CSV format. This file can be opened by any text editor, Google Sheets, or Microsoft Excel.

*Further Information*

URL to view this documentation.

#### Stopping IDEXd

```
idex stop
```

#### Restarting IDEXd

```
idex restart
```

#### Upgrading IDEXd

To upgrade IDEXd, stop the service, upgrade `@idexio/idexd-cli`, and restart the service.
```
$ idex stop
$ npm install -g @idexio/idexd-cli
$ idex start
```
Occasionally an upgrade may require running `idex config` before it can start serving traffic.

#### Upgrading from AuraD to IDEXd

Before upgrading to IDEXd, swap AURA tokens for IDEX tokens using the [token swap tool](https://idex.market/aura-token-swap).

To upgrade from AuraD to IDEXd, stop and uninstall AuraD then install and start IDEXd.
```
$ aura stop
$ npm uninstall -g @auroradao/aurad-cli
$ npm install -g @idexio/idexd-cli
$ idex start
```

#### Running IDEXd with a custom RPC endpoint

IDEXd ships with its own copy of the [Parity Ethereum Client](https://www.parity.io/ethereum/) and uses Parity to load data from the Ethereum blockchain. To use a different Etheruem node, you can specify a custom RPC endpoint
```
idex start --rpc <RPC endpoint URL including port>
```

## Getting Help and Reporting Issues

For questions about getting started and help if you're stuck, please [reach out to our team on Discord](https://discord.gg/tQa9CAB). 

If you believe you have identified a bug in IDEXd, please [file an issue](https://github.com/idexio/idexd/issues).

## License

IDEXd is licensed under the [GNU Lesser General Public License v3.0](https://www.gnu.org/licenses/lgpl-3.0.en.html).
