const express = require('express');
const bodyParser = require('body-parser'); 
const crypto = require('crypto');
const db = require('./database.js');

const MAX_BODY_LENGTH = '100mb';
const API_ENDPOINT = "/api/v1/rides"; 

/* API_ENDPOINT requests to manipulate entries (create / update / delete) are always POST.
Payload is a JSON with root entries
- "apikey" (constant),
- "data" (encapsulated JSON as string).
- "signature" (SHA256-RSA (PKCS1v1.5) signature of data string using the ride's 
private key)

Data contains a dictionary with ride information. For all requests targeting a specific
ride, the `uuid` property must be given to uniquely identify the ride.
Based on DB state and contents, request will be treated as create, update or delete:

If data contains a field "action":"DELETE", request is treated as a DELETE request.
The ride with this UUID, along with all its associated data, should be removed
from the server. Attempting to DELETE a ride with an unknown UUID has no effect.

Otherwise the request is treated as a CREATE or UPDATE, depending on the stored
rides on the server. If a ride with the given UUID exists, it is considered an
UPDATE, otherwise it is a CREATE.

CREATE requests will provide a new reide-specific public key that will be stored 
and used to authenticate following UPDATE or DELETE requests for this ride,
ensuring that only the originator of this ride will be allowed to change its state.

CREATE requests will require a full set of properties for the ride:
  required: uuid TEXT - unique ride identifier
  required: startDate REAL - start UNIX timestamp 
  required: endDate REAL - end UNIX timestamp 
  required: dist REAL - total distance in m
  required: motionDist REAL - distance in m considered as moving in vehicle
  required: duration REAL - total duration of recording (may slightly vary from endDate-startDate)
  required: motionDuration REAL - duration considered as moving in vehicle
  required: maxSpeed REAL - max speed in m/s
  required: publicKey TEXT - public key of ride (BASE64 string)
  required: rideType INTEGER - ride type enumeration
  required: vehicleType INTEGER - vehicle type enumeration
  required: mountType INTEGER - mount of recording device enumeration
  required: flags INTEGER - ride flags bitset
  required: locations - ARRAY of location entries
  optional: comment TEXT - used for debugging only

UPDATE requests only require the fields to be changed. However, it's a good
idea to re-submit all properties.

If a CREATE or UPDATE requests contains entries with associated data arrays
(e.g. `locations`), all corresponding entries will be replaced. If entries of
this type were previously stored on the server, they will be deleted. If no
such entry exists in the request, previous data will be kept. As an example:
When a ride with associated locations exists on the server and an UPDATE
request without a `locations` entry is received, the old locations will be
kept. If an UPDATE request with a new `locations` array is received (even
an empty one), all old locations will be deleted and the new locations will
be added instead.

Malformed or invalid requests will result in a 4xx error response. Failed valid
reqests will usually result in a 5xx error code. Successful valid requests
will result in a 200 OK error containing a JSON {ok : true}. 

Attempts to delete a non-existing ride will not change the server. Nevertheless,
as this is regarded as a valid request, it will result in a 200 OK message.

A GET request to API_ENDPOINT will dump all rides on the server as a JSON.
UUids and public keys are removed. This behavior is not final and is expected
to go in a later release. However, it is a convenient way to retrieve the
server's data for development. 

*/

let apikeys = [];

async function runServer(port, dbfile, keys) {
  apikeys = keys;
  await db.init(dbfile);
  const app = express();
  app.use(bodyParser.json({limit: MAX_BODY_LENGTH})); // for parsing application/json
  app.post(API_ENDPOINT, handlePostRides);
  app.get(API_ENDPOINT, handleGetRides);
  app.listen(port, () => {
    console.log(`My app listening on port ${port}`);
  })
}

async function handlePostRides(request, response)  {
  const body = request.body;
  if (typeof(body) != "object") {
    return response.status(400).send('Bad request');
  }
  const apikey = body.apikey;
  if (typeof(apikey) != "string") {
    return response.status(400).send('Request bad key');
  }
  if (apikeys.indexOf(apikey) < 0) {
    return response.status(401).send('Invalid API key');
  }
  const signatureBase64 = body.signature;
  if (typeof(signatureBase64) != "string") {
    return response.status(400).send('Request bad signature');
  }
  const dataString = body.data;
  if (typeof(dataString) != "string") {
    return response.status(400).send('Request bad data');
  }
  let data = null;
  try {
    data = JSON.parse(dataString);
  } catch (e) {
    return response.status(400).send('Request malformed data');    
  }
  if (typeof(data) != "object") {
    return response.status(400).send('Request invalid data');    
  }
  const uuid = data.uuid;
  if (typeof(uuid) != "string") {
    return response.status(400).send('Request bad uuid');
  }
  //if ride exists, take public key from there. Use provided pub key for new rides.
  const existingPublicKeyString = await db.getRidePublicKey(uuid);
  const rideExists = (typeof(existingPublicKeyString) == "string");
  const publicKeyString = rideExists ? existingPublicKeyString : data.publicKey;
  if (typeof(publicKeyString) != "string") {
    return response.status(400).send('Request invalid data pubkey');    
  }
  let publicKey = null;
  try {
    publicKey = crypto.createPublicKey({key: publicKeyString, format:'pem', type: 'pkcs1', encoding:'utf8'});
  } catch (e) {
    console.log(`create public key from string failed: ${e.message}`);
    return response.status(400).send('Request malformed public key');    
  }
  const verify = crypto.createVerify('SHA256');
  verify.write(dataString);
  verify.end();

  const isVerified = verify.verify(publicKey, signatureBase64, 'base64');
  if (!isVerified) {
    return response.status(403).send('Request could not be verified');        
  }

  //request is verified and request-independent sanity checks are done. Handle request.
  const actionString = data.action;
  let ok = false;
  if (actionString === "DELETE") {
    ok = await db.deleteRide(uuid);
  } else if (rideExists) {
    ok = await db.updateRide(uuid, data);
  } else {
    if (!db.checkCreateRideData(data)) {
      return response.status(400).send('Incomplete dataset');        
    }
    ok = await db.createRide(uuid, data);
  }

  if (!ok) {
    return response.status(500).send('Could not handle request');        
  }
  response.status(200).send('{"ok":true}');
}

async function handleGetRides(request, response)  {
  response.status(200);
  const locations = (request.query.locations === '0') ? false : true;
  const annotations = (request.query.annotations === '0') ? false : true;

  response.setHeader('content-type', 'application/json');
  const rideIds = await db.getRideIds();
  const dump = [];
  for (const idx in rideIds) {
    const id = rideIds[idx];
    const ride = await db.dumpRide(id, locations, annotations);
    if (typeof(ride) === 'object') {
      dump.push(ride);
    }
  }
  response.send(JSON.stringify(dump));
}

exports.runServer = runServer;
