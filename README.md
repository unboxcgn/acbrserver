# Accessible City / Bessere Radwege server

This is a very simple server backend for the Accessible City / Bessere Radwege projects. It allows rides to be stored on a server in an anonymous form. This component should be run non-public and published through a HTTPS proxy. Information about the API can be found in the `src/server.js` source file. In short, it opens a HTTP endpoint `/api/v1/rides` that allows POST requests to create, modify and delete rides. GET requests to this endpoint will deliver a JSON dump of the ride database.

Access is controlled in two ways:

- through an API key. Each request must contain a valid API key. We are aware that this is not a secure mechanism, but it makes malicious requests slightly more difficult. The actual keys for the Accessible City or Bessere Radwege projects are not part of this repository. 

- through a public/private key pair: This mechanism allows the owner of a specific ride to modify and delete the corresponding data on the server while remaining anonymous. Each ride has a unique public/private key pair. The public key is transmitted to the server in the creation request while the corresponding private key is kept within the mobile app that recoded the ride. Subsequent requests pertaining to this ride need to be signed using the private key and will be verified with the initial public key.

## Install

The server is written in nodejs / npm. Make sure they are installed.

- Copy the contents of this repository to your server.
- run `npm install`
- Copy the `config.json.template` file to `config.json` and edit its contents to fit your environment.

## Usage

- From the root directory, run `node src/index.js`

Running the application without arguments will use `config.json` as default. To see optional command line arguments, run `node src/index.js --help`.

Depending on your requirements, you might want to set up the process as a continuous service / server process. Use the specific features of your server OS to accomplish this task.
