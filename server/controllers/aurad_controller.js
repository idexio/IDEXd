import { Op } from 'sequelize';
import crypto from 'crypto';
import ApiController from './api_controller';

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

export default class AuradController extends ApiController {
  routes() {
    const { app, db } = this;
    const { Trade } = db.sequelize.models;

    app.get('/health', (req, res) => {
      res.send('OK');
    });

    app.post('/returnTradeHistoryMeta', async (req, res) => {
      const start = parseInt(req.body.start, 10);
      const end = parseInt(req.body.end, 10);
      const { market, address } = req.body;

      const lastTrade = await Trade.findOne({
        order: [['blockNumber', 'DESC']],
      });

      const maxBlock = lastTrade ? lastTrade.get('blockNumber') : 1;
      const trades = await AuradController
        .getTradeHistory(Trade, start, end, market, address, maxBlock);

      const before = await Trade.findOne({
        where: { timestamp: { [Op.lt]: start } },
        order: [['timestamp', 'DESC'], ['nonce', 'DESC']],
      });

      const hash = crypto.createHash('sha256').update(JSON.stringify(trades)).digest('hex');
      res.setHeader('x-content-hash', hash);
      res.json({
        trades,
        meta: {
          noData: ((trades.length === 0) && (before === null)),
          blockNumber: maxBlock,
        },
        nextTime: before && before.timestamp,
      });
    });
  }

  static async getTradeHistory(Trade, start, end, market, address, maxBlock = -1) {
    let query;

    if (market) {
      const symbols = market.split('_');
      query = {
        where: {
          [Op.or]: [{
            symbolBuy: symbols[0],
            symbolSell: symbols[1],
          }, {
            symbolBuy: symbols[1],
            symbolSell: symbols[0],
          }],
          timestamp: {
            [Op.gte]: start,
            [Op.lte]: end,
          },
        },
        limit: 5000,
        order: [['timestamp', 'DESC'], ['nonce', 'DESC']],
      };
    } else if (address) {
      query = {
        where: {
          [Op.or]: [{
            maker: address.toLowerCase(),
          }, {
            taker: address.toLowerCase(),
          }],
          timestamp: {
            [Op.gte]: start,
            [Op.lte]: end,
          },
        },
        limit: 5000,
        order: [['timestamp', 'DESC'], ['nonce', 'DESC']],
      };
    } else {
      return ([]);
    }

    if (maxBlock > 0) query.where.blockNumber = { [Op.lte]: maxBlock };

    const trades = await Trade.findAll(query);
    return trades.map(formatTrade);
  }
}
