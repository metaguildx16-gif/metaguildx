module.exports = {
  apps: [{
    name: "mgx-auto-retry",
    script: "/var/www/metaguildx/scripts/auto-retry.js",
    cron_restart: "*/5 * * * *",
    autorestart: false,
    watch: false,
    env: {
      DEPLOYER_PK: process.env.DEPLOYER_PK
    }
  }]
}
