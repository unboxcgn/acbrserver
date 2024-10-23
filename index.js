const express = require('express');
const bodyParser = require('body-parser'); 
const crypto = require('crypto');
const db = require('./database.js');

const KEYS = require('./keys.js');


const MAX_BODY_LENGTH = '100mb';
const PORT = 8080;
const API_ENDPOINT = "/api/v1/rides"; 

/* always POST. Contains a JSON with root entries
- "apikey" (constant),
- "uuid" (ride uuid),
- "data" (encapsulated JSON as string).
- "signature" (Base64 of SHA256 signature of data string signed with private key)
*/

//when data is empty object ("{}"), request is a delete
//when data is a non-empty object, request is a create or modify

let app 

run();

async function run() {
  await db.init('database.sqlite');
  const pubkey = await db.getRidePublicKey('myUuid');
  console.log(`pubkey is ${pubkey}`);

  const app = express();
  app.use(bodyParser.json({limit: MAX_BODY_LENGTH})); // for parsing application/json
  app.post(API_ENDPOINT, handleRideRequest);
  app.listen(PORT, () => {
    console.log(`My app listening on port ${PORT}`);
  })

}


async function handleRideRequest(request, response)  {
  const body = request.body;
  if (typeof(body) != "object") {
    return response.status(400).send('Bad request');
  }
  const apikey = body.apikey;
  if (typeof(apikey) != "string") {
    return response.status(400).send('Request bad key');
  }
  if (KEYS.API_KEYS.indexOf(apikey) < 0) {
    return response.status(401).send('Invalid API key');
  }
  const uuid = body.uuid;
  if (typeof(uuid) != "string") {
    return response.status(400).send('Request bad uuid');
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

  //TODO: if ride exists, take public key from there!
  let publicKeyString = data.publicKey;
  if (typeof(publicKeyString) != "string") {
    return response.status(400).send('Request invalid data pubkey');    
  }
  let publicKey = null;
  try {
    publicKey = crypto.createPublicKey({key: publicKeyString, format:'pem', type: 'pkcs1', encoding:'utf8'});
  } catch (e) {
    console.log(e.message);
    return response.status(400).send('Request malformed public key');    
  }

  const verify = crypto.createVerify('SHA256');
  verify.write(dataString);
  verify.end();

  console.log(`publicKeyString is ${publicKeyString} len ${publicKeyString.length} hash ${crypto.createHash('md5').update(publicKeyString).digest('hex')}`);
  console.log(`signatureBase64 is >>${signatureBase64}<< len ${signatureBase64.length} hash ${crypto.createHash('md5').update(signatureBase64).digest('hex')}`);
  console.log(`datastring is >>${dataString}<< len ${dataString.length} hash ${crypto.createHash('md5').update(dataString).digest('hex')}`);

  const isVerified = verify.verify(publicKey, signatureBase64, 'base64');
  console.log(`isVerified is ${isVerified}`);

  //TODO: check signature




  const respJson = { body : JSON.stringify(body)};
  const respStr = JSON.stringify(respJson);
  console.log(`responding ${respStr}`);
  response.send(respStr);
}



/*

function handleRequest(req, res) {
  try {
    const url = URL.parse(req.url);
    const path = url.pathname;
    const method = req.method;
    if (path != API_ENDPOINT) {
      res.status(404).end("Not found");
      return;
    }
    if (method != 'POST') {
      res.status(405).end("Method not allowed");
      return;
    }


  } catch (e) {
    res.status(500).end("Internal error, sorry!");
  }

}

function handleCreateRide(req, res) {

};

*/