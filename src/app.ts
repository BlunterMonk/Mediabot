import * as http from "http";
import * as fs from "fs";
import { log, error, debug, trace } from "./global.js";
import * as bodyParser from "body-parser";
import express from "express";
import * as AVD from "./avd/avd.js";

log("Mediabot Started");
const app = express();
AVD.Init();

// const server = http.createServer(homeRoute);
// server.listen(3000, () => {
//     log("Serving Mediabot Web Interface");
// });

/* Middlewares */
app.use(express.static('./public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

/* Routes */
app.get('/', function (req, res) {
    res.sendFile('index.html');
});

// TODO: add error checking
app.get("/rss", function (req, res) {
    let data = JSON.parse(fs.readFileSync("./data/rss-cache.json").toString());
    
    // res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Content-Type', 'application/json');
    res.status(200);
    res.send(data);
});

app.post('/ping', function (req, res) {
    const body = req.body; // your request body

    // your "magical" code
    log("Server Pinged");

    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("pong");
    res.end();
});

/* 3, 2, 1, Launch ! */
app.listen(process.env.PORT || 3000, function() {
});

function homeRoute(request, response) {

  fs.readFile("./public/index.html", (err, data) => {
      if (err) {
          log(err);
          return;
      }

      response.writeHead(200, {'Content-Type': 'text/html'});
      response.write(data);
      response.end();
  });
}