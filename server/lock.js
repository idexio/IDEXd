export default class Lock {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  acquire() {
    if (!this._locked) {
      this._locked = true;
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this._queue.push(resolve);
    });
  }

  release() {
    if (this._locked === true) {
      if (this._queue.length > 0) {
        (this._queue.shift())();
      } else {
        this._locked = false;
      }
    }
  }
}
