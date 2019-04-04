module.exports = {
  apps : [{
    name: 'staker',
    script: 'lib/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    kill_timeout: 5000,
    exp_backoff_restart_delay: 1000,
    watch: "downtime.log",
    watch_delay: 1000,
    watch_options: {
      interval: 5000,
    },
    env: {
      WORKER: '1'
    },
  }],
};
