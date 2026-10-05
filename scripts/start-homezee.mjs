import { spawn } from "node:child_process";
const collector = spawn("python3", ["portal_collector.py"], {stdio:"inherit", env:process.env});
const app = spawn("node", [".output/server/index.mjs"], {stdio:"inherit", env:{...process.env,HOST:"0.0.0.0",PORT:process.env.PORT || "8080"}});
function stop(){collector.kill();app.kill();}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
collector.on("exit", code=>{stop();process.exit(code || 1)});app.on("exit",code=>{stop();process.exit(code || 0)});
