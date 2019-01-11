const fs = require('fs');

module.exports = class Util {
  static createBar(progress, length, message = '') {
    // Determine distance finished.
    let distance = progress * length;
    // Start progress bar.
    let bar = "[";
    // Add main portion.
    bar += "=".repeat(Math.floor(distance));
    // Add intermediate porttion.
    bar += distance % 1 > 0.5 ? "-" : "";
    // Extend empty bar.
    bar += " ".repeat(length > bar.length ? length - bar.length : 0);
    // Cap progress bar.
    bar += "] ";
    bar += message
    return bar;
  }
  
  static async getAuradStatus(docker) {
    const f = docker.statusFile();
    return new Promise((resolve, reject) => {
      fs.readFile(f, 'utf8', (err, result) => {
        if (err) reject(err);
        else {
          try {
            const json = JSON.parse(result);
            resolve(json);
          } catch(e) {
            reject(e);
          }
        }
      });
    });
  }
}