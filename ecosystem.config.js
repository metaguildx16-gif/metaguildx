module.exports = {
  apps: [
    {
      name: "metaguildx-signer",
      script: "./apps/signer/dist/index.js",
      cwd: "/var/www/metaguildx",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3001
      },
      max_memory_restart: "512M",
      restart_delay: 5000,
      error_file: "/var/log/pm2/signer-error.log",
      out_file: "/var/log/pm2/signer-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      time: true,
      watch: false
    }
  ]
};
