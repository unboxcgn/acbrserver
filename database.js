const sqlite3 = require('sqlite3').verbose();

let db = null;

const createRideTable = `
CREATE TABLE IF NOT EXISTS ride (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	startDate REAL,
	endDate REAL,
	dist REAL,
	motionDist REAL,
	duration REAL,
	motionDuration REAL,
	maxSpeed REAL,
	publicKey TEXT,
	rideType INTEGER,
	vehicleType INTEGER,
	mountType INTEGER,
	flags INTEGER,
	comment TEXT
)`;

const createLocationTable = `
CREATE TABLE IF NOT EXISTS location(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	rideId INTEGER,
	timestamp REAL,
	latitude REAL,
	longitude REAL,
	accuracy REAL,
	altitude REAL,
	altitudeAccuracy REAL,
	heading REAL,
	headingAccuracy REAL,
	speed REAL,
	speedAccuracy REAL
)`;

async function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error)
        reject(error);
      else
        resolve(rows);
    });
  });
};

async function init(filename) {
  return new Promise((resolve, reject) => {

    if (db === null) {
	 	  db = new sqlite3.Database(filename);
		  const result = db.serialize(() => {
			  db.run(createRideTable);
		  	db.run(createLocationTable);
        db.run(`INSERT INTO ride (uuid, publicKey) values ("myUuid", "myPubKey")`);
		  });
      console.log(`using database at ${filename}`);
    }
    resolve();
  });
}

async function getRidePublicKey(uuid) {
  if (db === null) throw new Error(`database not initialized`);
  const result = await query("SELECT publicKey FROM ride WHERE uuid = (?) LIMIT 1", uuid);
  if (result.length > 0) {
    return result[0].publicKey;
  } else {
    return null;
  }
}



exports.init = init;
exports.getRidePublicKey = getRidePublicKey;

