import Sequelize from 'sequelize';
import fs from 'fs';
import path from 'path';
import config from './config';
import { web3 } from './helpers';

export default class Db {
  constructor() {
    if (Db._instance) return (Db._instance);
    Db._instance = this;

    this.sequelize = new Sequelize(config.db.url, {
      logging: (x) => {
        if (process.env.DEBUG === '1') console.log(x);
      },
      dialectOptions: {
        compress: true,
      },
    });

    this.loadModels();
  }

  async waitFor(maxTries = 10, delay = 10000) {
    let success = false;
    do {
      try {
        await this.sequelize.authenticate();
        success = true;
      } catch (e) {
        console.log('db connection failed, retry');
        if (this._closed !== true) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      maxTries = maxTries - 1;
    } while (success === false && this._closed !== true && maxTries > 0);
    return(success);
  }

  loadModels() {
    const basename = path.basename(__filename);
    const dir = 'server/models';
    const models = {};

    const files = fs.readdirSync(dir).filter(file => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js'));

    files.forEach(file => {
      const Model = require(`./models/${file}`).default; // eslint-disable-line
      Model.init(this.sequelize, Sequelize);
      Model.web3 = web3;
      models[Model.name] = Model;
    });

    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
  }
}
