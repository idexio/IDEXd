import crypto from 'crypto';
import Trade from './models/trade';

const formPayload = (timestamp, coldWallet, hotWallet, json) => ['POST', timestamp, coldWallet, hotWallet, JSON.stringify(json)].join(':');

const keepAliveHeaders = (web3, coldWallet, account, timestamp, json, challenge) => {
  const payload = formPayload(timestamp, coldWallet, account.address, json);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const authorization = account.sign(payload);

  return {
    'x-idexd-id': coldWallet,
    'x-idexd-address': account.address,
    'x-idexd-date': timestamp,
    'x-idexd-digest': digest,
    'x-idexd-authorization': authorization.signature,
    'x-idexd-challenge': challenge,
  };
};

const reportError = (msg) => {
  throw new Error(msg);
};

const keepAliveVerify = async (web3, req, res, body) => {
  const requiredHeaders = ['x-idexd-id', 'x-idexd-address', 'x-idexd-date', 'x-idexd-digest', 'x-idexd-authorization'];
  requiredHeaders.forEach(header => {
    if (!req.get(header)) reportError(`${header} is required`);
  });

  const coldWallet = req.get('x-idexd-id');
  if (!web3.utils.isAddress(coldWallet)) reportError('invalid ethereum address');

  const hotWallet = req.get('x-idexd-address');
  if (!web3.utils.isAddress(hotWallet)) reportError('invalid ethereum address');

  const timestamp = req.get('x-idexd-date');
  const digest = req.get('x-idexd-digest');
  const signature = req.get('x-idexd-authorization');

  const payload = formPayload(timestamp, coldWallet, hotWallet, body);
  const expectedHash = crypto.createHash('sha256').update(payload).digest('hex');
  if (expectedHash !== digest) reportError('invalid digest');

  const recovered = await web3.eth.accounts.recover(payload, signature);
  if (recovered.toLowerCase() !== hotWallet.toLowerCase()) reportError('invalid signature');

  ['blockNumber', 'version'].forEach(field => {
    if (!body[field]) {
      reportError(`${field} is required`);
    }
  });

  // verify the block number and version
  return true;
};

module.exports = {
  Trade, keepAliveHeaders, keepAliveVerify,
};
