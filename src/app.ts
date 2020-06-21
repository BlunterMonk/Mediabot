import express from "express";
import * as http from "http";
import * as fs from "fs";
import * as AVD from "./avd/avd.js";
import * as bodyParser from "body-parser";
import * as Torrent from "./util/torrent.js";
import { log, error, debug, trace } from "./global.js";
import { downloadFile } from "./util/download.js";
import { Config } from "./config/config.js";
import { RSSManager } from "./util/rss"; 

log("Mediabot Started");
const app = express();

// const server = http.createServer(homeRoute);
// server.listen(3000, () => {
//     log("Serving Mediabot Web Interface");
// });

/* Middlewares */
app.use(express.static('./public'));
app.use('/data', express.static('./data'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
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
    let data = AVD.GetCache();
    if (!data) {
        res.writeHead(400, {'Content-Type': 'text/html'});
        res.send();
        res.end();
        return;
    }
    
    res.header('Content-Type', 'application/json');
    res.status(200);
    res.send(data);
});

app.post("/dl", function(req, res) {
    const body = req.body; // your request body
    log("POST - Route: /dl, Headers: ", req.headers, ", Body: ", body);

    log("Starting Download: ", body.url);
    Torrent.downloadTorrentFile(Config.getDownloadDir(), body.url)
    .then(path => {
        log("Downloaded torrent file: ", path);

        var result = {
            filepath: "file.mkv"
        };

        res.header('Content-Type', 'text/html');
        res.status(200);
        res.send(result);
        res.end();

        Torrent.downloadTorrent(Config.getMediaDir(), path, 1, null)
        .then(r => {
            log("Successfully downloaded torrent");
            log(r);
        })
        .catch(e => {
            error("Failed to download torrent: ", e);
        });
    })
    .catch(e => {
        error("Failed to download .torrent file: ", e);
                
        res.writeHead(402, {'Content-Type': 'text/html'});
        res.send(`Failed to download .torrent file: ${e}`);
        res.end();
    });
});

app.post('/ping', function (req, res) {
    const body = req.body; // your request body

    // your "magical" code
    log("Server Pinged");

    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("pong");
    res.end();
});

app.post('/refresh', function (req, res) {
    const body = req.body; // your request body

    // your "magical" code
    log("Refreshed");

    RSSManager.updateFeeds();

    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("Feeds Refreshed");
    res.end();
});

app.get('/stats', function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    log("Opening Status Stream");

    Torrent.setTrackerUpdateMethod((trackers: Torrent.TrackerList) => {
        res.write("data: " + JSON.stringify(trackers) + "\n\n");
    });
});

var testStats = {
    "s843g8": "[horriblesubs]_princess_connect!_re_dive_-_10_[720p].mkv",
    "a35t1a": "[horriblesubs]_hachi-nan_tte,_sore_wa_nai_deshou!_-_10_[720p].mkv",
    "10a5n4": "[horriblesubs]_hamefura_-_10_[720p].mkv"
};
var timers = [0, 30, 50];

app.get('/teststats', function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    log("Opening Status Stream");
    var inter = setInterval(() => {
        var data = Object.keys(testStats).map((key, ind) => {
            data[key] = {
                id: key,
                progress: timers[ind],
                metadata: {
                    name: testStats[key]
                }
            }
            timers[ind] += 1 * (ind/5);
        });
        res.write("data: " + JSON.stringify(data) + "\n\n");
    }, 1000);
});


/* 3, 2, 1, Launch ! */
app.listen(process.env.PORT || 3000, function() {
    AVD.Init();
});
