import request from 'request-promise';

class DebugHttpProvider {
  constructor(host, options) {
    options = options || {};
    this.host = host || 'http://localhost:8545';
    this.timeout = options.timeout || 0;
    this.headers = options.headers;
    this.connected = false;
  }
  send(payload, callback) {
    request({
      uri: this.host,
      method: 'POST',
      json: payload,
      headers: this.headers,
    })
    .then(v => callback(null, v))
    .catch(callback)
  }
}

module.exports = DebugHttpProvider;
