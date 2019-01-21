import Sequelize from 'sequelize';

const schema = () => ({
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  blockNumber: {
    type: Sequelize.INTEGER,
    validate: { isNumeric: true },
  },
  timestamp: {
    type: Sequelize.INTEGER,
    validate: { isNumeric: true },
  },
  type: {
    type: Sequelize.STRING,
    validate: { isIn: [['buy', 'sell']] },
  },
  nonce: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  transactionHash: {
    type: Sequelize.STRING,
    validate: {
      is: /^(0x)?[0-9a-f]{64}$/i,
    },
    unique: true
  },
  maker: {
    type: Sequelize.STRING,
    validate: {
      is: /^(0x)?[0-9a-f]{40}$/i,
    },
  },
  taker: {
    type: Sequelize.STRING,
    validate: {
      is: /^(0x)?[0-9a-f]{40}$/i,
    },
  },
  tokenBuy: {
    type: Sequelize.STRING,
    validate: {
      is: /^(0x)?[0-9a-f]{40}$/i,
    },
  },
  tokenSell: {
    type: Sequelize.STRING,
    validate: {
      is: /^(0x)?[0-9a-f]{40}$/i,
    },
  },
  symbolBuy: {
    type: Sequelize.STRING,
    validate: {
      is: /^[0-9a-z_]+/i,
    },
  },
  symbolSell: {
    type: Sequelize.STRING,
    validate: {
      is: /^[0-9a-z_]+/i,
    },
  },
  amount: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  amountBuy: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  amountSell: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  buyerFee: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  sellerFee: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  gasFee: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
  price: {
    type: Sequelize.STRING,
    validate: { isNumeric: true },
  },
});

class Trade extends Sequelize.Model {
  static init(sequelize) {
    return super.init(schema(), { sequelize, tableName: 'Trades' });
  }
}

export default Trade;
