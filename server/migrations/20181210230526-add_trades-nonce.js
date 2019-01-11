

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'Trades',
      'nonce',
      {
        type: Sequelize.BIGINT,
      },
    );
  },

  down: (queryInterface /* Sequelize */) => {
    queryInterface.removeColumn('Trades', 'nonce');
  },
};
