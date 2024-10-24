const sqlite3 = require('sqlite3').verbose();

let db = null;

const createRideTable = `
CREATE TABLE IF NOT EXISTS ride (
	id INTEGER PRIMARY KEY,
	uuid TEXT NOT NULL UNIQUE,
	startDate REAL NOT NULL,
	endDate REAL NOT NULL,
	dist REAL NOT NULL,
	motionDist REAL NOT NULL,
	duration REAL NOT NULL,
	motionDuration REAL NOT NULL,
	maxSpeed REAL NOT NULL,
	publicKey TEXT NOT NULL,
	rideType INTEGER NOT NULL,
	vehicleType INTEGER NOT NULL,
	mountType INTEGER NOT NULL,
	flags INTEGER NOT NULL,
	comment TEXT NOT NULL
)`;

const createLocationTable = `
CREATE TABLE IF NOT EXISTS location(
	id INTEGER PRIMARY KEY,
	rideId INTEGER NOT NULL,
	timestamp REAL NOT NULL,
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	accuracy REAL NOT NULL,
	altitude REAL NOT NULL,
	altitudeAccuracy REAL NOT NULL,
	heading REAL NOT NULL,
	headingAccuracy REAL NOT NULL,
	speed REAL NOT NULL,
	speedAccuracy REAL NOT NULL
)`;

function isNumber(val) {
  return (typeof(val) === 'number' && isFinite(val));
}

function isString(val) {
  return (typeof(val) === 'string');
}

function isStringOrUndefined(val) {
  return (typeof(val) === 'string') || (typeof(val) === 'undefined');
}

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
        // createRide("myUuid",
        //   {
        //     publicKey: "myPubKey",
        //     startDate: 123,
        //     endDate: 456,
        //     dist: 123.4,
        //     motionDist: 112.3,
        //     duration: 332,
        //     motionDuration:321,
        //     maxSpeed: 33.3,
        //     rideType: 1,
        //     vehicleType: 2,
        //     mountType: 3,
        //     flags: 0
        //   });
		  });
      console.log(`using database at ${filename}`);
    }
    resolve();
  });
}

async function getRidePublicKey(uuid) {
  try {
    if (!isString(uuid)) {
      return null;
    }
    const result = await query("SELECT publicKey FROM ride WHERE uuid = (?) LIMIT 1", uuid);
    if (result.length > 0) {
      return result[0].publicKey;
    } else {
      return null;
    }
  } catch (e) {
    console.log(`DB fail in getRidePublicKey: ${e}`);
    return false;        
  }
}

async function createRide(uuid, data) {
  try {
    if (!isString(uuid)) {
      return false;
    }
    if (!checkCreateRideData(data)) { //this might be duplicate, but we need to ensure sane input.
      return false;
    }
    const comment = isString(data.comment) ? data.comment : "";
    const sql = `INSERT INTO ride 
    (uuid,startDate,endDate,dist,motionDist,duration,motionDuration,maxSpeed,publicKey,rideType,vehicleType,mountType,flags,comment)
    VALUES
    (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const args = [uuid, data.startDate, data.endDate, data.dist, data.motionDist, data.duration, data.motionDuration,
      data.maxSpeed, data.publicKey, data.rideType, data.vehicleType, data.mountType, data.flags, comment];
    await query(sql, args);
    //TODO: locations ***************
    return true;
  } catch (e) {
    console.log(`DB fail in createRide: ${e}`);
    return false;        
  }
}

async function updateRide(uuid, data) {
  try {
    const result = await query("SELECT * FROM ride WHERE uuid = ?", uuid);
    if (result.length < 1) {
      return false;
    }
    const existing = result[0];

    const sql = `UPDATE ride SET 
    startDate = ?,
    endDate = ?,
    dist = ?,
    motionDist = ?,
    duration = ?,
    motionDuration = ?,
    maxSpeed = ?,
    publicKey = ?,
    rideType = ?,
    vehicleType = ?,
    mountType = ?,
    comment = ?
    WHERE id = ?
    `;

    const values = [
      isNumber(data.startDate)      ? data.startDate      : existing.startDate,
      isNumber(data.endDate)        ? data.endDate        : existing.endDate,
      isNumber(data.dist)           ? data.dist           : existing.dist,
      isNumber(data.motionDist)     ? data.motionDist     : existing.motionDist,
      isNumber(data.duration)       ? data.duration       : existing.duration,
      isNumber(data.motionDuration) ? data.motionDuration : existing.motionDuration,
      isNumber(data.maxSpeed)       ? data.maxSpeed       : existing.maxSpeed,
      isString(data.publicKey)      ? data.publicKey      : existing.publicKey,
      isNumber(data.rideType)       ? data.rideType       : existing.rideType,
      isNumber(data.vehicleType)    ? data.vehicleType    : existing.vehicleType,
      isNumber(data.mountType)      ? data.mountType      : existing.mountType,
      isString(data.comment)        ? data.comment        : existing.comment,
      existing.id
    ];
    await query("SELECT * FROM ride WHERE uuid = ?", values); 
    //TODO: locations **********
    return true;
  } catch (e) {
    console.log(`DB fail in updateRide: ${e}`);
    return false;    
  }
}

async function deleteRide(uuid) {
  try {
    const result = await query("SELECT id FROM ride WHERE uuid = ? LIMIT 1", uuid);
    if (result.length < 1) {
      return true;
    }
    const rideId = result[0].id;
    await query("DELETE FROM location WHERE rideId = (?)", rideId);
    await query("DELETE FROM ride WHERE id = (?)", rideId);
    return true;
  } catch (e) {
    console.log(`DB fail in deleteRide: ${e}`);
    return false;
  }
}

function checkCreateRideData(data) {
  if (typeof(data) != 'object') {
    return false;
  }
  return isNumber(data.startDate) &&
    isNumber(data.endDate)        &&
    isNumber(data.dist)           &&
    isNumber(data.motionDist)     &&
    isNumber(data.duration)       &&
    isNumber(data.motionDuration) &&
    isNumber(data.maxSpeed)       &&
    isString(data.publicKey)      &&
    isNumber(data.rideType)       && 
    isNumber(data.vehicleType)    && 
    isNumber(data.mountType)      && 
    isStringOrUndefined(data.comment);
}


exports.init = init;
exports.getRidePublicKey = getRidePublicKey;
exports.createRide = createRide;
exports.updateRide = updateRide;
exports.deleteRide = deleteRide;
exports.checkCreateRideData = checkCreateRideData;
