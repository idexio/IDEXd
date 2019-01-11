import cors from 'cors';
import requireAll from 'require-all';
import bodyParser from 'body-parser';
import compression from 'compression';

export default class Routes {
  /**
   * @param app
   * @param db
   */
  constructor(app, db) {
    if (Routes._instance) return Routes._instance;
    Routes._instance = this;

    Object.assign(this, { app, db });
    this.middleware();
    this.controllers();
  }

  middleware() {
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(bodyParser.json());
  }

  controllers() {
    this.controllers = requireAll({
      dirname: `${__dirname}/controllers`,
      filter: /(.+_controller)\.js$/,
      resolve: Controller => {
        const c = new (Controller.default)(this.app); // eslint-disable-line
        c.routes();
      },
    });
  }
}
