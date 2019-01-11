

module.exports = {
  up: async (queryInterface /* Sequelize */) => {
    await queryInterface.addIndex('Trades', ['timestamp', 'nonce']);
  },

  down: async (queryInterface /* Sequelize */) => {
    await queryInterface.removeIndex('Trades', ['timestamp', 'nonce']);
  },
};
