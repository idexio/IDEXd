module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Trades', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      blockNumber: Sequelize.INTEGER,
      timestamp: Sequelize.INTEGER,
      type: Sequelize.STRING,
      transactionHash: Sequelize.STRING,
      maker: Sequelize.STRING,
      taker: Sequelize.STRING,
      tokenBuy: Sequelize.STRING,
      tokenSell: Sequelize.STRING,
      symbolBuy: Sequelize.STRING,
      symbolSell: Sequelize.STRING,
      amount: Sequelize.STRING,
      amountBuy: Sequelize.STRING,
      amountSell: Sequelize.STRING,
      buyerFee: Sequelize.STRING,
      sellerFee: Sequelize.STRING,
      gasFee: Sequelize.STRING,
      price: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('Trades', ['blockNumber']);
    await queryInterface.addIndex('Trades', ['symbolBuy', 'symbolSell', 'timestamp']);
    await queryInterface.addIndex('Trades', ['transactionHash'], { indicesType: 'UNIQUE' });
  },
  down: (queryInterface) => queryInterface.dropTable('Trades'),
};
