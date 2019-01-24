# AuraD: IDEX Staking Tier 3 [beta]

## Introduction

AuraD is software that enables the [IDEX](https://idex.market/) community to stake AURA, serve parts of the IDEX production infrastructure, and earn fees for participation. AuraD is the first part of a comprehensive plan to decentralize the centralized components of IDEX. For complete coverage, motivation, and roadmap, see our most recent post on [AURA Staking](https://medium.com/aurora-dao/aura-staking-pos-earn-trade-fees-36319229ceae).

#### A note about versions

**AuraD is currently beta software.** It is under development and subject to frequent changes, upgrades, and bug fixes. We appreciate your help in providing feedback and working around rough edges as we build towards 1.0.

## Requirements

### Staking

In order to be eligible to participate in Aura Staking, you must have a wallet that holds a minimum of 10,000 AURA for a minimum of 7 days. Dropping below a 10,000 AURA balance, even for a brief period, will reset the incubation period.

#### No 7-day requirement at launch

*On launch, the 7-day requirement will be suspended for 3 days! Any wallet with 10,000 AURA, regardless of how recently the AURA was transferred there, can start staking immediately.*

### Hardware / VPS

AuraD is designed to run on a computer or VPS that is continually connected to the internet with a stable IP address and inbound connectivity.

* 2GB+ memory
* 20GB+ storage

### Software

* Ubuntu 18.04 LTS
* Docker CE 18.09 ([Installation Guide](https://docs.docker.com/install/linux/docker-ce/ubuntu/))
* Docker Compose 1.17.1 ([Installation Guide](https://docs.docker.com/compose/install/))
* nvm ([Installation Guide](https://github.com/creationix/nvm))
* Node.js 10.15.0, npm 6.4.1 ([Installation Guide](https://github.com/creationix/nvm#usage))
* Git 17.1 ([Installation Guide](https://git-scm.com/downloads))

AuraD is designed to support a wide range of systems, but for the beta we recommend sticking to these requirements and versions.

## Getting AuraD

AuraD is distrbuted via the @auroradao/aurad-cli npm package with dependencies on Docker and Docker Compose.

## Getting Started

All of the requrements provide first-rate installation documentation, but we've collected the key steps to get up-and-running here. Start with a freshly installed copy of Ubuntu 18.04.

#### A note on users

Some VPS providers, such as Digital Ocean, set up new Ubuntu 18.04 instances with only the `root` user account configured. We recommend running AuraD as a regular user account rather than `root`. When you first log in, run `whoami` to check which user you are currently acting as. If the response is `root`, follow Digital Ocean's [instructions](https://www.digitalocean.com/community/tutorials/how-to-add-and-delete-users-on-ubuntu-16-04) on adding a user and adding sudo privileges in order to run AuraD.

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

### Install and launch AuraD

1. Install `aurad-cli` to start and manage AuraD
```
npm install -g @auroradao/aurad-cli
```

2. Configure a staking wallet
```
aura config
```
AuraD provides prompts asking for a staking wallet that contains at least 10,000 AURA for 7 days. Go to [MyEtherWallet](https://www.myetherwallet.com/signmsg.html) or your preferred wallet software to sign the challenge and provide the `sig` value to prove that you control the wallet.

AuraD employs a cold-wallet design so that staked funds never need to leave the staking wallet for maximum security.

3. Sync your Aura Node and start serving traffic
```
aura start
```
AuraD connects to the Ethereum network and downloads IDEX trade history data to serve to IDEX users. Depending on the resources of the underlying computer or VPS and network, the initial syncing process may take a few minutes to several hours.

TODO: documentation on forcing a full sync vs fast sync

#### A note on connectivity

In order to serve data to IDEX users, AuraD Nodes must be reachable from the public internet. Most home and office connections are not publicly reachable by default, so you may need to take steps like opening up specific ports on your router. AuraD requires public TCP access to port 8443, and has limits on how frequently a node can change IP addresses.

We recommend running AuraD on an always-on, contected machine or a cloud-hosted compute instance.

## Managing AuraD

AuraD is design to require minimal maintenance once it is live. For details on managing AuraD
```
aura
```
to display documentation on the `aurad-cli`'s capabilities.

### Common management tasks

#### Examining logs

Logs are the best source of information to understand what's happening with AuraD under the hood. To follow the AuraD logs
```
docker logs -f docker_aurad_1
```

#### Stopping AuraD

```
aura stop
```

#### Restarting AuraD

```
aura restart
```

#### Upgrading AuraD

To upgrade AuraD, stop the service, upgrade `@auroradao/aurad-cli`, and restart the service.
```
$ aura stop
$ npm install -g @auroradao/aurad-cli
$ aura start
```
Occasionally an upgrade may require running `aura config` before it can start serving traffic.

#### Running AuraD with a custom RPC endpoint

AuraD ships with its own copy of the [Parity Ethereum Client](https://www.parity.io/ethereum/) and uses Parity to load data from the Ethereum blockchain. To use a different Etheruem node, you can specify a custom RPC endpoint
```
aura start --rpc <RPC endpoint URL including port>
```

## Getting Help and Reporting Issues

For questions about getting started and help if you're stuck, please [reach out to our team on Discord](https://discord.gg/tQa9CAB). 

If you believe you have identified a bug in AuraD, please [file an issue](https://github.com/auroradao/aurad/issues).

## License

AuraD is licensed under the [GNU Lesser General Public License v3.0](https://www.gnu.org/licenses/lgpl-3.0.en.html).
