

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn(
      'Trades',
      'nonce',
      {
        type: Sequelize.STRING,
      },
    );
  },

  down: async (queryInterface /* Sequelize */) => {
    await queryInterface.changeColumn(
      'Trades',
      'nonce',
      {
        type: Sequelize.BIGINT,
      },
    );
  },
};
