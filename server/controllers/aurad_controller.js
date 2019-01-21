import { Op } from 'sequelize';
import crypto from 'crypto';
import { trimDecimals, formatTrade, tradeForHash, tradeToJson } from '../utils/trade_utils';
import ApiController from './api_controller';

export default class AuradController extends ApiController {
  routes() {
    const { app, db } = this;
    const { Trade } = db.sequelize.models;

    app.get('/health', (req, res) => {
      res.send('OK');
    });
    
    app.put('/trades/:hash', async (req, res) => {
      try {
        const hash = req.params.hash;
        const trade = await tradeForHash(hash);
        if (null !== trade) {
          const json = await tradeToJson(trade);
          const created = await db.sequelize.models.Trade.upsert(json);
          if (false === created) {
            res.status(200).json({'message': 'trade updated'});
          } else {
            res.status(201).json({'message': 'trade created'});
          }
        } else {
          res.status(400).json({'message': 'invalid trade hash'});
        }
      } catch(e) {
        console.log(e);
        res.status(500).json({'message': e.message});
      }
    });
    
    app.delete('/trades/:hash', async (req, res) => {
      const hash = req.params.hash;
      const trade = await Trade.findOne({
        where: { transactionHash: hash }
      });
      if (!trade) {
        return res.status(404).json({'message': 'trade not found'});
      }
      const tx = await tradeForHash(hash);
      if (null !== tx) {
        return res.status(409).json({'message': 'trade is valid'});
      }
      await trade.destroy();
      return res.status(200).json({'message': 'invalid trade successfully removed'});
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
