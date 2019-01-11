import Db from '../db';

export default class ApiController {
  /**
   * @param app
   */
  constructor(app) {
    this.app = app;
    this.db = new Db();
  }

  routes() {}
}
