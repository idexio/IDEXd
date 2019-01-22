import request from 'request-promise';
import { web3 } from '../helpers';
import { IDEX1_ADDRESS } from '../constants';

const pairs = {};
const tokensBySymbol = {};
const tokensByAddress = {};

export async function getTokenMap() {
  return request({
    method: 'POST',
    uri: 'https://api.idex.market/returnCurrenciesWithPairs',
    json: true,
  });
}

export function initTokens(tokenMap) {
  tokenMap.tokens.forEach(obj => {
    tokensBySymbol[obj.symbol] = obj;
    tokensByAddress[obj.address] = obj;
  });

  for (const fromToken in tokenMap.pairs) {
    if (fromToken && typeof fromToken === 'string') {
      tokensBySymbol[fromToken].isBase = true;
      pairs[fromToken] = {};
      tokenMap.pairs[fromToken].forEach(toToken => { pairs[fromToken][toToken] = true; });
    }
  }
  return { pairs, tokensBySymbol, tokensByAddress };
}

function isBaseTokenAddress(address) {
  const token = tokensByAddress[address];
  return (token && tokensBySymbol[token.symbol].isBase === true);
}

function trimDecimals(str) {
  str = str.toString();
  if (str.indexOf('.') > -1) {
    while (str.slice(-1) === '0') str = str.slice(0, -1);
    if (str.slice(-1) === '.') str = str.slice(0, -1);
  }
  return (str);
}

// @todo this needs better BigNumber formatting
function formatTrade(trade) {
  return {
    date: new Date(trade.timestamp * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, ''),
    amount: trimDecimals((trade.type === 'sell') ? trade.amount : (trade.amount / trade.price).toString()),
    type: trade.type,
    total: trimDecimals(trade.type === 'sell' ? trade.amount * trade.price : trade.amount),
    price: trimDecimals(trade.price),
    orderHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    uuid: trade.transactionHash,
    buyerFee: (trade.buyerFee * trade.price).toString(),
    sellerFee: (trade.sellerFee * trade.price).toString(),
    gasFee: '0', /* (trade.gasFee * trade.price).toString(), */
    timestamp: trade.timestamp,
    maker: trade.maker,
    taker: trade.taker,
    transactionHash: trade.transactionHash,
    usdValue: '0.0000000000000000',
  };
}

export async function tradeForHash(hash, requireReceipt = true) {
  if (!hash || hash.length !== 66 || !web3.utils.isHexStrict(hash)) {
    return null;
  }
  const tx = await web3.eth.getTransaction(hash);
  if (!tx) {
    return null;
  }

  if (tx.to && tx.input && tx.to.toLowerCase() === IDEX1_ADDRESS.toLowerCase() && tx.input.substr(0, 10) === '0xef343588') {
    const filtered = await filterByReceipts([tx]);
    if (filtered.length === 1) {
      const block = await web3.eth.getBlock(tx.blockNumber, false);
      tx.timestamp = block.timestamp;
      return tx;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

export async function filterByReceipts(txs) {
  const validTxs = [];

  // if receipts are already populated, just read the status
  txs = txs.filter(tx => {
    if (tx.txreceipt_status === '0') return (false);
    if (tx.txreceipt_status === '1') {
      validTxs.push(tx);
    }
    return (true);
  });

  if (txs.length === 0) return Promise.resolve(validTxs);
  const txsByHash = {};
  txs.forEach(tx => { (txsByHash[tx.hash] = tx); });

  const count = txs.length;
  let processed = 0;

  return new Promise((resolve, reject) => {
    const cb = (err, result) => {
      if (err) reject(err);
      else {
        if (!result) reject(new Error('receipt is null'));
        processed += 1;
        const tx = txsByHash[result.transactionHash];
        if (result.status === true) {
          Object.assign(tx, result);
          validTxs.push(txsByHash[result.transactionHash]);
        } else if (typeof result.status === 'undefined') {
          if (result.gasUsed !== tx.gas) {
            Object.assign(tx, result);
            validTxs.push(txsByHash[result.transactionHash]);
          }
        }
        if (processed === count) resolve(validTxs);
      }
    };

    const batch = new web3.BatchRequest();
    txs.map(tx => batch.add(web3.eth.getTransactionReceipt.request(tx.hash, cb)));
    batch.execute();
  });
}

export async function tradeToJson(tx) {
  // parsing the input with slice() and BigInt is drastically faster than web3 decodeParameters
  // replace the 'old' style here:
  // const args = web3.eth.abi.decodeParameters(['uint256[8]', 'address[4]', 'uint8[2]', 'bytes32[4]'], `0x${tx.input.substr(10)}`);
  // const [amountBuy, amountSell, expires, orderNonce, amount, tradeNonce, feeMake, feeTake] = args[0]; // eslint-disable-line
  // const [tokenBuy, tokenSell, maker, taker] = args[1].map(arg => arg.toLowerCase());

  tx.input = tx.input.substr(10);
  const param = (input, index, offset = 0) => input.substr(index*64 + offset, 64 - offset);
  const [
    amountBuy,
    amountSell,
    expires,
    orderNonce,
    amount,
    tradeNonce,
    feeMake,
    feeTake,
    tokenBuy,
    tokenSell,
    maker,
    taker
  ] = [
    BigInt('0x'+param(tx.input, 0)).toString(),
    BigInt('0x'+param(tx.input, 1)).toString(),
    BigInt('0x'+param(tx.input, 2)).toString(),
    BigInt('0x'+param(tx.input, 3)).toString(),
    BigInt('0x'+param(tx.input, 4)).toString(),
    BigInt('0x'+param(tx.input, 5)).toString(),
    BigInt('0x'+param(tx.input, 6)).toString(),
    BigInt('0x'+param(tx.input, 7)).toString(),
    '0x'+param(tx.input, 8, 24),
    '0x'+param(tx.input, 9, 24),
    '0x'+param(tx.input, 10, 24),
    '0x'+param(tx.input, 11, 24),
  ];

  if (!tokensByAddress[tokenSell] && tokenSell !== '0x0000000000000000000000000000000000000000') {
    const obj = { name: tokenSell, symbol: tokenSell, decimals: 18 };
    tokensBySymbol[obj.symbol] = obj;
    tokensByAddress[tokenSell] = obj;
  }

  if (!tokensByAddress[tokenBuy] && tokenBuy !== '0x0000000000000000000000000000000000000000') {
    const obj = { name: tokenBuy, symbol: tokenBuy, decimals: 18 };
    tokensBySymbol[obj.symbol] = obj;
    tokensByAddress[tokenBuy] = obj;
  }
    
  let symbolBuy = tokensByAddress[tokenBuy].symbol;
  let symbolSell = tokensByAddress[tokenSell].symbol;

  if ((symbolBuy === '') && (tokenBuy.toLowerCase() === '0xc66ea802717bfb9833400264dd12c2bceaa34a6d')) symbolBuy = 'MKR';
  if ((symbolSell === '') && (tokenSell.toLowerCase() === '0xc66ea802717bfb9833400264dd12c2bceaa34a6d')) symbolSell = 'MKR';

  const blockNumber = parseInt(tx.blockNumber);
  const timestamp = parseInt(tx.timeStamp || tx.timestamp);

  const type = isBaseTokenAddress(tokenBuy) ? 'buy' : 'sell';
  const buyerFee = (type === 'sell') ? feeTake : feeMake;
  const sellerFee = (type === 'sell') ? feeMake : feeTake;
  const gasFee = (BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice)).toString();

  const transactionHash = tx.hash;

  const tokenBuyDecimals = tokensByAddress[tokenBuy].decimals;
  const tokenSellDecimals = tokensByAddress[tokenSell].decimals;

  let numerator = BigInt(0);
  let denominator = BigInt(0);
  let numeratorDecimals = 0;
  let denominatorDecimals = 0;
  let amountDecimals = 0;

  if (type === 'buy') {
    [numerator, denominator, numeratorDecimals, denominatorDecimals, amountDecimals] = [
      BigInt(amountBuy),
      BigInt(amountSell),
      Number(tokenBuyDecimals),
      Number(tokenSellDecimals),
      Number(tokenBuyDecimals),
    ];
    amountDecimals = tokenBuyDecimals;
  } else {
    [numerator, denominator, numeratorDecimals, denominatorDecimals, amountDecimals] = [
      BigInt(amountSell),
      BigInt(amountBuy),
      Number(tokenSellDecimals),
      Number(tokenBuyDecimals),
      Number(tokenSellDecimals),
    ];
  }

  // force an extra 36 digits so we can safely divide with ints
  numerator *= BigInt(10) ** BigInt(36);
  let rawPrice = (numerator / denominator).toString();
  const decimalOffset = denominatorDecimals - numeratorDecimals - 36;

  rawPrice = rawPrice.padStart(Math.abs(decimalOffset) + 1, '0');
  let priceString = `${rawPrice.substr(0, rawPrice.length + decimalOffset)}.${rawPrice.substr(Math.max(0, rawPrice.length + decimalOffset), rawPrice.length)}`;
  if (priceString.slice(-1) === '.') priceString += '0';

  let amountString = amount.padStart(amountDecimals + 1, '0');
  amountString = `${amountString.substr(0, amountString.length - amountDecimals)}.${amountString.substr(Math.max(0, amountString.length - amountDecimals), amountString.length)}`;
  if (amountString.slice(-1) === '.') amountString += '0';

  let gasString = gasFee.padStart(19, '0');
  gasString = `${gasString.substr(0, gasString.length - 18)}.${gasString.substr(Math.max(0, gasString.length - 18), gasFee.length)}`;
  if (gasString.slice(-1) === '.') gasString += '0';

  let { nonce } = tx;
  nonce = String(nonce).padStart(20, '0');
  return Promise.resolve({
    blockNumber,
    timestamp,
    type,
    maker,
    taker,
    tokenBuy,
    tokenSell,
    symbolBuy,
    symbolSell,
    amount: amountString,
    amountBuy,
    amountSell,
    buyerFee,
    sellerFee,
    gasFee: gasString,
    transactionHash,
    price: priceString,
    nonce,
  });
}