const server = require('./server.js');
const { exit } = require('node:process');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 9999;
const DB_FILE = "testdb.sqlite";
const API_PATH = "/api/v1/rides";
const API_KEY = "dummy_key";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { 
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
});

runTests().then(() => {
  process.exit(0);
});

async function postRequest(data) {
  data['publicKey'] = publicKey;
  const dataString = JSON.stringify(data);
  const sign = crypto.createSign('SHA256');
  sign.write(dataString);
  sign.end();
  const signatureBase64 = sign.sign(privateKey, 'base64');
  const payload = {
    apikey: API_KEY,
    data: dataString,
    signature:signatureBase64
  };
  const payloadString = JSON.stringify(payload);
  const url = `http://127.0.0.1:${PORT}${API_PATH}`;
  const response = await fetch(url, {
    method: "POST",
    body: payloadString,
    headers: {
     "Content-type": "application/json; charset=UTF-8"
    }
  });
  return response.ok;
}

async function getDump() {
  const url = `http://127.0.0.1:${PORT}${API_PATH}`;
  const response = await fetch(url, {
    method: "GET"
  });
  if (response.ok) {
    const data = await response.text();
    return JSON.parse(data);
  } else {
    return null;
  }
}

var passed = 0;
var failed = 0;

function EXPECT(condition, description) {
  if (condition) {
    passed++;
  } else {
    console.log(`Test failed: ${description}`);
    failed++;
  }
}

async function runTests() {
  try {
    fs.unlinkSync(DB_FILE);    
  } catch (e) {}
  passed = 0;
  failed = 0;

  console.log("running tests");
  await server.runServer(PORT, DB_FILE, [API_KEY]);

  const state0 = await getDump();
  EXPECT(Array.isArray(state0), "state0 should be an array");
  EXPECT(state0.length == 0, "state0 should be empty");
  
  const data1 = {
    uuid:'uuid1',
    startDate:123,
    endDate:456,
    dist:1000,
    motionDist:900,
    duration:122,
    motionDuration:100,
    maxSpeed:60,
    rideType:0,
    vehicleType:1,
    mountType:2,
    flags:3,
    comment:'',
    locations:[{
      timestamp:150,
      latitude:50,
      longitude:6,
      accuracy:100,
      altitude:20,
      altitudeAccuracy:90,
      heading:100,
      headingAccuracy:80,
      speed:10,
      speedAccuracy:70
    }, {
      timestamp:160,
      latitude:50.1,
      longitude:6.1,
      accuracy:100,
      altitude:20,
      altitudeAccuracy:90,
      heading:100,
      headingAccuracy:80,
      speed:10,
      speedAccuracy:70
    }],
    annotations:[
    {
      timestamp:170,
      latitude:50.05,
      longitude:6.05,
      type:1,
      flags:7,
      comment:"annotation"
    }]
  };
  const ok1 = await postRequest(data1);
  EXPECT(ok1, "Request 1 should be ok");
  const state1 = await getDump();
  EXPECT(Array.isArray(state1), "state1 should be an array");
  EXPECT(state1.length == 1, "state1 should contain one ride");
  EXPECT(state1[0].locations.length == 2, "state1 ride1 should contain two locations");
  EXPECT(state1[0].annotations.length == 1, "state1 ride1 should contain one annotation");
  EXPECT(state1[0].startDate == 123, "state1 ride1 should start at 123");
  EXPECT(state1[0].endDate == 456, "state1 ride1 should end at 456");

  const data2 = {
    uuid:'uuid1',
    startDate:150
  };
  const ok2 = await postRequest(data2);
  EXPECT(ok2, "Request 2 should be ok");
  const state2 = await getDump();
  EXPECT(Array.isArray(state2), "state2 should be an array");
  EXPECT(state2.length == 1, "state2 should contain one ride");
  EXPECT(state2[0].locations.length == 2, "state2 ride1 should contain two locations");
  EXPECT(state2[0].annotations.length == 1, "state2 ride1 should contain one annotation");
  EXPECT(state2[0].startDate == 150, "state2 ride1 should start at 150");
  EXPECT(state2[0].endDate == 456, "state2 ride1 should end at 456");

  const data3 = {
    uuid:'uuid1',
    action:'DELETE'
  };
  const ok3 = await postRequest(data3);
  EXPECT(ok3, "Request 3 should be ok");
  const state3 = await getDump();
  EXPECT(Array.isArray(state3), "state3 should be an array");
  EXPECT(state3.length == 0, "state3 should be empty");

  console.log(`tests passed: ${passed} failed: ${failed}`);
  fs.unlinkSync(DB_FILE);

  return failed == 0;
}