import config from './config';

const settings = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.type,
};

module.exports = {
  development: settings,
  staging: settings,
  test: settings,
  production: settings,
};
