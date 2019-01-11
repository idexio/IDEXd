import crypto from 'crypto';
import Trade from './models/trade';

const formPayload = (timestamp, coldWallet, hotWallet, json) => ['POST', timestamp, coldWallet, hotWallet, JSON.stringify(json)].join(':');

const keepAliveHeaders = (web3, coldWallet, account, timestamp, json, challenge) => {
  const payload = formPayload(timestamp, coldWallet, account.address, json);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const authorization = account.sign(payload);

  return {
    'x-aurad-id': coldWallet,
    'x-aurad-address': account.address,
    'x-aurad-date': timestamp,
    'x-aurad-digest': digest,
    'x-aurad-authorization': authorization.signature,
    'x-aurad-challenge': challenge,
  };
};

const reportError = (msg) => {
  throw new Error(msg);
};

const keepAliveVerify = async (web3, req, res, body) => {
  const requiredHeaders = ['x-aurad-id', 'x-aurad-address', 'x-aurad-date', 'x-aurad-digest', 'x-aurad-authorization'];
  requiredHeaders.forEach(header => {
    if (!req.get(header)) reportError(`${header} is required`);
  });

  const coldWallet = req.get('x-aurad-id');
  if (!web3.utils.isAddress(coldWallet)) reportError('invalid ethereum address');

  const hotWallet = req.get('x-aurad-address');
  if (!web3.utils.isAddress(hotWallet)) reportError('invalid ethereum address');

  const timestamp = req.get('x-aurad-date');
  const digest = req.get('x-aurad-digest');
  const signature = req.get('x-aurad-authorization');

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
