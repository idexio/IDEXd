require('dotenv').config();
const convict = require('convict');

const config = convict({
  env: {
    format: ['production', 'staging', 'development', 'test'],
    default: 'development',
    arg: 'nodeEnv',
    env: 'NODE_ENV',
  },
  staking: {
    host: {
      format: String,
      default: 'http://localhost:8082',
      env: 'STAKING_HOST',
    },
  },
  rpc: {
    protocol: {
      format: String,
      default: 'http',
      env: 'RPC_PROTOCOL',
    },
    host: {
      format: String,
      default: 'localhost',
      env: 'RPC_HOST',
    },
    port: {
      format: String,
      default: '8545',
      env: 'RPC_PORT',
    },
  },
  server: {
    host: {
      format: String,
      default: '0.0.0.0',
      env: 'HOST',
    },
    port: {
      format: String,
      default: '8443',
      env: 'PORT',
    },
    statusApiPort: {
      format: String,
      default: '',
      env: 'STATUS_API_PORT',
    },
  },
  db: {
    type: {
      format: String,
      default: 'mysql',
      env: 'DB_TYPE',
    },
    host: {
      format: String,
      default: 'localhost',
      env: 'DB_HOST',
    },
    port: {
      format: String,
      default: '3306',
      env: 'DB_PORT',
    },
    name: {
      format: String,
      default: 'aurad',
      env: 'DB_DATABASE',
    },
    user: {
      format: String,
      default: '',
      env: 'DB_USERNAME',
    },
    password: {
      format: String,
      default: '',
      env: 'DB_PASSWORD',
    },
  },
});

const env = config.get('env');
config.loadFile(`./config/${env}.json`);

config.validate({ allowed: 'strict' });
config.set('db.url', `${config.get('db.type')}://${config.get('db.user')}:${config.get('db.password')}@${config.get('db.host')}:${config.get('db.port')}/${config.get('db.name')}`);

export default config.getProperties();
