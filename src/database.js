const sqlite3 = require('sqlite3').verbose();

let dbPath = ":memory:";

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

const createAnnotationTable = `
CREATE TABLE IF NOT EXISTS annotation(
  id INTEGER PRIMARY KEY,
  rideId INTEGER NOT NULL,
  timestamp REAL NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  type INTEGER NOT NULL DEFAULT 0,
  flags INTEGER NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT ''
)`;

function isNumber(val) {
  return (typeof(val) === 'number' && isFinite(val));
}

function isInt(val) {
  return (Number.isInteger(val));
}

function isString(val) {
  return (typeof(val) === 'string');
}

function isStringOrUndefined(val) {
  return (typeof(val) === 'string') || (typeof(val) === 'undefined');
}

function isUndefined(val) {
  return (typeof(val) === 'undefined');
}

function isArray(val) {
  return Array.isArray(val);
}

async function openDb(filename) {
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database(filename, (error) => {
      if (error)
        reject(error);
      else
        resolve(db);
    });
  });
}

//returns rows on success
async function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error)
        reject(error);
      else
        resolve(rows);
    });
  });
};

//returns last row id on success
async function run(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error)
        reject(error);
      else
        resolve(this.lastID);
    });
  });
};


//creates a location entry if proper data is given
async function createLocation(db, rideId, location) {
  const ok = isNumber(location.timestamp) &&
    isNumber(location.latitude) &&
    isNumber(location.longitude) &&
    isNumber(location.accuracy) &&
    isNumber(location.altitude) &&
    isNumber(location.altitudeAccuracy) &&
    isNumber(location.heading) &&
    isNumber(location.headingAccuracy) &&
    isNumber(location.speed) &&
    isNumber(location.speedAccuracy);
  if (!ok) {
    return false;
  }
  const sql = `INSERT INTO location
  (rideId,timestamp,latitude,longitude,accuracy,altitude,altitudeAccuracy,heading,headingAccuracy,speed,speedAccuracy)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  const values = [rideId,location.timestamp,location.latitude,location.longitude,location.accuracy,location.altitude,
    location.altitudeAccuracy,location.heading,location.headingAccuracy,location.speed,location.speedAccuracy];
  return run(db, sql, values);
}

// deletes old locations and inserts new locations for a ride
async function replaceLocations(db, rideId, locations) {
  await run(db, "DELETE FROM location WHERE rideId = ?", rideId);
  let ok = true;
  for (const locIdx in locations) {
    const location = locations[locIdx];
    ok = ok && await createLocation(db, rideId, location);
  }
  return ok;
}

//creates an annotation entry if proper data is given
async function createAnnotation(db, rideId, annotation) {
  if (isUndefined(annotation.type)) {
    annotation.type = 0;
  }
  if (isUndefined(annotation.flags)) {
    annotation.flags = 0;
  }
  if (isUndefined(annotation.comment)) {
    annotation.comment = '';
  }
  const ok = isNumber(annotation.timestamp) &&
    isNumber(annotation.latitude) &&
    isNumber(annotation.longitude) &&
    isNumber(annotation.type) &&
    isNumber(annotation.flags) &&
    isString(annotation.comment);
  if (!ok) {
    return false;
  }
  const sql = `INSERT INTO annotation
  (rideId,timestamp,latitude,longitude,type,flags,comment)
  VALUES (?,?,?,?,?,?,?)`
  const values = [rideId,annotation.timestamp,annotation.latitude,annotation.longitude,annotation.type,annotation.flags,
    annotation.comment];
  return run(db, sql, values);
}

// deletes old annotations and inserts new annotations for a ride
async function replaceAnnotations(db, rideId, annotations) {
  await run(db, "DELETE FROM annotation WHERE rideId = ?", rideId);
  let ok = true;
  for (const idx in annotations) {
    const annotation = annotations[idx];
    ok = ok && await createAnnotation(db, rideId, annotation);
  }
  return ok;
}



//does init stuff, creating database if needed
async function init(filename) {
  dbPath = filename;
  const db = await openDb(dbPath);
  await run(db, createRideTable);
  await run(db, createLocationTable);
  await run(db, createAnnotationTable);
  db.close();

  // create dummy rides for testing only
  // createRide("uuid",
  //   {startDate:1,endDate:2,dist:3,motionDist:4,duration:5,motionDuration:6,maxSpeed:7,publicKey:"hallo",rideType:8,vehicleType:9,mountType:10,flags:11}
  // );
  // createRide("uuid2",
  //   {startDate:1,endDate:2,dist:3,motionDist:4,duration:5,motionDuration:6,maxSpeed:7,publicKey:"hallo",rideType:8,vehicleType:9,mountType:10,flags:11}
  // );
  console.log(`using database at ${dbPath}`);
}

async function getRidePublicKey(uuid) {
  if (!isString(uuid)) {
    return null;
  }
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return null;
  }
  try {
    const result = await query(db, "SELECT publicKey FROM ride WHERE uuid = ? LIMIT 1", uuid);
    if (result.length > 0) {
      return result[0].publicKey;
    } else {
      return null;
    }
  } catch (e) {
    console.log(`DB fail in getRidePublicKey: ${e}`);
    return null;
  } finally {
    db.close();
  }
}

async function createRide(uuid, data) {
  //TODO: wrap in transaction *****
  if (!isString(uuid)) {
    return false;
  }
  if (!checkCreateRideData(data)) { //this might be duplicate, but we need to ensure sane input.
    return false;
  }
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return false;
  }
  try {
    const comment = isString(data.comment) ? data.comment : "";
    const sql = `INSERT INTO ride 
    (uuid,startDate,endDate,dist,motionDist,duration,motionDuration,maxSpeed,publicKey,rideType,vehicleType,mountType,flags,comment)
    VALUES
    (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const args = [uuid, data.startDate, data.endDate, data.dist, data.motionDist, data.duration, data.motionDuration,
      data.maxSpeed, data.publicKey, data.rideType, data.vehicleType, data.mountType, data.flags, comment];
    const rideId = await run(db, sql, args);
    if (isArray(data.locations)) {
      await replaceLocations(db, rideId, data.locations);
    }
    if (isArray(data.annotations)) {
      await replaceAnnotations(db, rideId, data.annotations);
    }
    return true;
  } catch (e) {
    console.log(`DB fail in createRide: ${e}`);
    return false;
  } finally {
    db.close();
  }
}

async function updateRide(uuid, data) {
  //TODO: wrap in transaction *****
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return false;
  }
  try {
    const result = await query(db, "SELECT * FROM ride WHERE uuid = ?", uuid);
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
    flags = ?,
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
      isInt(data.rideType)          ? data.rideType       : existing.rideType,
      isInt(data.vehicleType)       ? data.vehicleType    : existing.vehicleType,
      isInt(data.mountType)         ? data.mountType      : existing.mountType,
      isInt(data.flags)             ? data.flags          : existing.flags,
      isString(data.comment)        ? data.comment        : existing.comment,
      existing.id
    ];
    await run(db, sql, values);
    if (isArray(data.locations)) {
      await replaceLocations(db, existing.id, data.locations);
    }
    if (isArray(data.annotations)) {
      await replaceAnnotations(db, rideId, data.annotations);
    }
    return true;
  } catch (e) {
    console.log(`DB fail in updateRide: ${e}`);
    return false;    
  } finally {
    db.close();
  }
}

async function deleteRide(uuid) {
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return false;
  }
  try {
    const result = await query(db, "SELECT id FROM ride WHERE uuid = ? LIMIT 1", uuid);
    if (result.length < 1) {
      return true;
    }
    const rideId = result[0].id;
    await query(db, "DELETE FROM location WHERE rideId = (?)", rideId);
    await query(db, "DELETE FROM annotation WHERE rideId = (?)", rideId);
    await query(db, "DELETE FROM ride WHERE id = (?)", rideId);
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
    isInt(data.rideType)          && 
    isInt(data.vehicleType)       && 
    isInt(data.mountType)         && 
    isInt(data.flags)             && 
    isStringOrUndefined(data.comment);
}

/** will return array of ids. Empty array on failure */
async function getRideIds() {
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return [];
  }
  try {
    const results = await query(db, "SELECT id FROM ride ORDER BY startDate DESC");
    return results.map(ride => ride.id);
  } catch (e) {
    console.log(`DB fail in getRideIds: ${e}`);
    return [];
  } finally {
    db.close();
  }
}

/** will return map of ride. null on failure */
async function dumpRide(rideId, doLocations = true, doAnnotations = true) {
  let db = null;
  try {
    db = await openDb(dbPath);
  } catch (e) {
    return null;
  }
  try {
    const rides = await query(db, "SELECT startDate,endDate,dist,motionDist,duration,motionDuration,maxSpeed,rideType,vehicleType,mountType,flags,comment FROM ride WHERE id = ? LIMIT 1",rideId);
    if (rides.length != 1) {
      return null;
    }
    const dump = rides[0]
    if (doLocations) {
      const locations = await query(db, "SELECT timestamp,latitude,longitude,accuracy,altitude,altitudeAccuracy,heading,headingAccuracy,speed,speedAccuracy FROM location WHERE rideId = ? ORDER BY timestamp",rideId);
      dump['locations'] = locations;
    }
    if (doAnnotations) {
      const annotations = await query(db, "SELECT timestamp,latitude,longitude,type,flags,comment FROM annotation WHERE rideId = ? ORDER BY timestamp",rideId);
      dump['annotations'] = annotations;
    }
    return dump;
  } catch (e) {
    console.log(`DB fail in dumpRide: ${e}`);
    return null;
  } finally {
    db.close();
  }
}

exports.init = init;
exports.getRidePublicKey = getRidePublicKey;
exports.createRide = createRide;
exports.updateRide = updateRide;
exports.deleteRide = deleteRide;
exports.checkCreateRideData = checkCreateRideData;
exports.getRideIds = getRideIds;
exports.dumpRide = dumpRide;
