// PM2 process definition for running Netora on a VPS.
// The background job worker (MikroTik health checks, RADIUS disconnects)
// runs in-process inside the same server started by `dist/index.js`
// (see server/_core/index.ts -> startBackgroundJobWorker()), so a single
// PM2 app is sufficient — there is no separate worker process to manage.
//
// Usage:
//   npm run build
//   pm2 start ecosystem.config.cjs
//   pm2 save              # persist across reboots
//   pm2 startup           # (one-time) generate OS boot script
module.exports = {
  apps: [
    {
      name: "netora",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      // .env is loaded at runtime by `dotenv/config` (see server/_core/index.ts),
      // so PM2 only needs to guarantee NODE_ENV here.
      env: {
        NODE_ENV: "production",
      },
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
