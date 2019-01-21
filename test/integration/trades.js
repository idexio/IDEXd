import assert from 'assert';
import { server, db } from './init';
import request from 'request-promise';
import { getTokenMap, initTokens, tradeToJson, tradeForHash, filterByReceipts } from '../../server/utils/trade_utils';

const VALID_TRADE = '0x62139752fdc099e00746984159cb099eaa6666eea1c87150e94e4dc20a3d29c1';
const VALID_IDEX_1_NOT_TRADE = '0x6189e4647ee127bfab6c6466cd28bbd7db8299c14937fe550d44becdc2ab238d';
const INVALID_TX = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const VALID_TX = '0x71ff2714f7e7e42ae69e7d44f2366ce6cb8343ae36f5d3806cf2e4206a1478f0';
const GOOD_BLOCK_NUMBER = 7102100;
const BAD_BLOCK_NUMBER = 3000000;

before(async () => {
  const tm = await getTokenMap();
  await initTokens(tm);
});

beforeEach(async () => {
  await db.sequelize.models.Trade.destroy({ truncate: true });
});

describe('Trades', () => {
  it('adds a valid trade to the database', async () => {
    const response = await request.put({
      uri: `http://127.0.0.1:8888/trades/${VALID_TRADE}`,
      json: true,
      resolveWithFullResponse: true
    });

    assert.equal(response.statusCode, 201);
    const trade = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.notEqual(trade, null);
    
    return Promise.resolve();
  });
  
  it('updates a valid trade in the database', async () => {
    const trade = await tradeForHash(VALID_TRADE);
    const json = await tradeToJson(trade);
    json.blockNumber = BAD_BLOCK_NUMBER;
    await db.sequelize.models.Trade.create(json);
    const createdTrade = await db.sequelize.models.Trade.findOne({ where: { transactionHash: VALID_TRADE } });
    assert.notEqual(createdTrade, null);

    const response = await request.put({
      uri: `http://127.0.0.1:8888/trades/${VALID_TRADE}`,
      json: true,
      resolveWithFullResponse: true
    });

    assert.equal(response.statusCode, 200);
    const updatedTrade = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.notEqual(updatedTrade, null);
    assert.equal(updatedTrade.blockNumber, 7102100);

    return Promise.resolve();
  });

  it('does not add other IDEX transactions to the database', async () => {
    const response = await request.put({
      uri: `http://127.0.0.1:8888/trades/${VALID_IDEX_1_NOT_TRADE}`,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });
  
    assert.equal(response.statusCode, 400);
    const trade = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.equal(trade, null);
    
    return Promise.resolve();
  });

  it('does not add valid non-IDEX transactions to the database', async () => {
    const response = await request.put({
      uri: `http://127.0.0.1:8888/trades/${VALID_TX}`,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });
  
    assert.equal(response.statusCode,400);
    const trade = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.equal(trade, null);

    return Promise.resolve();
  });

  it('does not add invalid transactions to the database', async () => {
    const response = await request.put({
      uri: `http://127.0.0.1:8888/trades/${INVALID_TX}`,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });
  
    assert.equal(response.statusCode, 400);
    const trade = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.equal(trade, null);

    return Promise.resolve();
  });

  it('deletes an invalid hash from the database', async () => {
    const trade = await tradeForHash(VALID_TRADE);
    trade.hash = INVALID_TX;
    const json = await tradeToJson(trade);
    const result = await db.sequelize.models.Trade.create(json);
    const tradeObject = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: INVALID_TX }
    });
    assert.notEqual(tradeObject, null);

    const response = await request.delete({
      uri: `http://127.0.0.1:8888/trades/${INVALID_TX}`,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });
  
    assert.equal(response.statusCode, 200);
    const tradeObjectAfter = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: INVALID_TX }
    });
    assert.equal(tradeObjectAfter, null);

    return Promise.resolve();
  });
  
  it('refuses to delete a valid trade from the database', async () => {
    const trade = await tradeForHash(VALID_TRADE);
    const json = await tradeToJson(trade);
    await db.sequelize.models.Trade.create(json);
    const tradeObject = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.notEqual(tradeObject, null);
      
    const response = await request.delete({
      uri: `http://127.0.0.1:8888/trades/${VALID_TRADE}`,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });
  
    assert.equal(response.statusCode, 409);
    const tradeAfter = await db.sequelize.models.Trade.findOne({
      where: { transactionHash: VALID_TRADE }
    });
    assert.notEqual(tradeAfter, null);

    return Promise.resolve();
  });
});