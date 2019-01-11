module.exports = {
  apps : [{
    name: 'app',
    script: 'lib/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    kill_timeout: 5000,
  },{
    name: 'worker',
    script: 'lib/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    kill_timeout: 5000,
    env: {
      WORKER: '1'
    },
  }],
};
