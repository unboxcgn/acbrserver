const server = require('./server.js');
const { program } = require('commander');
const fs = require('fs');
const { exit } = require('node:process');


program
  .description('Run the accessible city / bessere radwege db server')
  .option('-c, --config <string>', 'configuration file', './config.json')
  .option('-p, --port <integer>', 'server port')
  .option('-b, --dbfile <string>', 'SQLite DB file')
  .option('-a, --apikeys <string>', 'Single API key or JSON Array of API keys')
  .option('--migrate-annotations-table', 'Migrate annotations table');

program.parse();

let port;
let dbfile;
let keys;

const options = program.opts();
let configfile = options.config;
console.log(`Trying config file ${configfile}`);

try {
  const data = fs.readFileSync(configfile,
    { encoding: 'utf8', flag: 'r' });
  const config = JSON.parse(data);
  if (typeof(config.port) != 'undefined') {
    if (typeof(config.port) == 'number') {
      console.log(`Found port in config file`);
      port = config.port;
    } else {
      console.log(`invalid port in config file: ${config.port}`);
      process.exit(1);
    }
  }
  if (typeof(config.dbfile) != 'undefined') {
    if (typeof(config.dbfile) == 'string') {
      console.log(`Found dbfile in config file`);
      dbfile = config.dbfile;
    } else {
      console.log(`invalid port in config file: ${config.port}`);
      process.exit(1);
    }
  }
  if (Array.isArray(config.apikeys)) {
    console.log(`Found API keys array in config file`);
    keys = config.apikeys;
  }
} catch (e) {
  console.log(`Could not read config file ${configfile}`);
}

if (typeof(options.port) != 'undefined') {
  try {
    const p = parseInt(options.port);
    port = p;
  } catch(e) {
    console.log(`invalid port parameter ${options.port}`);
  }
}
if (typeof(options.dbfile) != 'undefined') {
  dbfile = options.dbfile;
}
if (typeof(options.keys) != 'undefined') {
  let k;
  try {
    const ks = JSON.parse(options.keys);
    if (Array.isArray(ks)) {
      console.log(`Keys command line argument is interpreted as key set`);
      k = ks;
    }
    console.log(`ks type ${typeof(ks)}`);
  } catch (e) {
  }
  if (typeof(k) == 'undefined') {
    console.log(`Keys command line argument is interpreted as single key`);
    k = [options.keys];
  }
  keys = k;
}

if (typeof(port) != 'number') {
  console.log("No valid port specified!");
  process.exit(1);
}
if (typeof(dbfile) != 'string') {
  console.log("No valid dbfile specified!");
  process.exit(1);
}
if (!Array.isArray(keys)) {
  console.log("No valid API keys specified!");
  process.exit(1);
}

console.log(`Using port ${port} dbfile file ${dbfile} key count ${keys.length}`);

if (options.migrateAnnotationsTable) {
  console.log(`Migrating annotations table. Note: You should not need to do this. It's better to drop the table (losing its contents). Will be recreated on next start.`);
  const db = require('./database.js');
  db.migrateAnnotationsTable(dbfile).then(() => {process.exit(1);});
}

server.runServer(port, dbfile, keys);  

