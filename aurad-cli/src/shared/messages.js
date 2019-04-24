const version = require('../../package.json').version;
const chalk = require('chalk');

const padding = (str, f) => {
  let i = process.stdout.columns - str.length
  let before = '', after = '';
  while (i--) {
    i % 2 == 0 ? before += ' ' : after += ' ';
  }
  f = f || chalk.white.bgBlack;
  return [f(before), f(after)];
}

module.exports = {
  WELCOME_MESSAGE: `IDEXd v${version}`,
  WALLET_EXPLAINER: `
    For IDEXd staking, you need a wallet with a minimum of 10,000 IDEX held for 7 days.
    We recommend using a cold wallet for security purposes.
    
    Once we verify ownership of your cold wallet, IDEXd will generate a local hot wallet for you.
  `,
  WALLET_PROMPT: 'Cold wallet address'
}
