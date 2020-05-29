//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import { log, error, debug } from "../global.js";
import spawn = require('cross-spawn'); 
const bencode = require(`bencode`);

type OnUpdate = ((log: string, elapsed: number) => void);
export interface TorrentResult {
    name: string;
    metadata: any;
    destination: string;
    elapsedTime: number;
}
interface torrentMetadata {
    name: string;
    size: number;
    files: {name: string, size: number}[];
}

// download the torrent 
export function downloadTorrent(saveLocation: string, torrentPath: string, onUpdate: OnUpdate): Promise<TorrentResult> {
    
    if (saveLocation[saveLocation.length-1] != "/")
        saveLocation += "/";

    log(`Torrent: ${torrentPath}`);
    if (!fs.existsSync(torrentPath)) {
        error(`Torrent File Doesn't Exist: `, torrentPath);
        return Promise.reject("Torrent download cancelled, Torrent doesn't exist: " + torrentPath);
    }

    return new Promise<TorrentResult>((resolve, reject) => {

        var metadata = getMetadata(torrentPath);
        var destination = `${saveLocation}${metadata.name}`;
        var dir = `${saveLocation}`;
        if (fs.existsSync(destination)) {
            log("File Already Exists");
            resolve({
                name: metadata.name,
                metadata: metadata,
                destination: destination,
                elapsedTime: 0
            });
            return;
        }

        log("Beginning torrent download, Destination: ", destination, " Dir: ", dir);

        var start = Date.now();
        var timer = Date.now();

        let list = "";
        metadata.files.forEach(element => {
            list += `${element.name} - ${element.size}gb\n`
        });

        // Send Download Start Update
        log(`Starting Download: ${metadata.name} - `, list);
        onUpdate(`Starting Download: ${metadata.name}\n**__Files:__**\n` + list, 0);

        const child = spawn(`aria2c "${torrentPath}"`, [
            `-d ${dir}`, 
            `--seed-time=0`, 
            `--download-result=full`,
            `--summary-interval=10`
        ]);
        
        // since these are streams, you can pipe them elsewhere
        // child.stdout.setEncoding('utf8');
        child.stderr.pipe(process.stdout);

        // Handle Errors
        child.on('error', (chunk) => {

            // data from standard output is here as buffers
            let output = chunk.toString()
            error(`child process error ${output}`);

            reject(`Download Failed: ${metadata.name}`);
        });

        // Finish Download
        child.on('close', (code) => {
            debug(`child process exited with code ${code}`);

            let elapsed = Math.floor((Date.now() - start)/1000);
            resolve({
                name: metadata.name,
                metadata: metadata,
                destination: destination,
                elapsedTime: elapsed
            });
        });

        // Respond to data stream
        child.stdout.on('data', (chunk) => {
            let elapsed = Math.floor((Date.now() - start)/1000);

            let output: string = chunk.toString()
            if (output.empty())
                return;

            output = output.replace(/\r?\n|\r/g, "").trim();

            debug(`${output}`);

            let tick = Math.floor((Date.now() - timer)/1000);
            if (tick > 60) {
                timer = Date.now();
                onUpdate(output, elapsed);
            }
        });
    })
}

// Download the .torrent file associated with the provided magnet URL
export function downloadMagnetFile(saveLocation: string, url: string): Promise<string> {
    
    if (saveLocation[saveLocation.length-1] != "/")
        saveLocation += "/";

    return new Promise<string>((resolve, reject) => {

        var command = `aria2c "${url}"`

        const child = spawn(command, [`-d torrents/`, `--bt-metadata-only=true`, `--bt-save-metadata=true`, `--listen-port=6881`]);
        log("Magnet Download Command: ", command);

        // since these are streams, you can pipe them elsewhere
        // child.stdout.setEncoding('utf8');
        child.stderr.pipe(process.stdout);

        child.on('error', (chunk) => {
            // data from standard output is here as buffers
            let output = chunk.toString()
            reject(output);
        });
        
        // Finish downloading torrent file
        child.on('close', (code) => {
            log(`child process exited with code ${code}`);
        });

        child.stdout.on('data', (chunk) => {

            let output = chunk.toString()
            if (output.empty())
                return;

            debug(`${output}\n`);
            if (output.includes("Saved metadata")) {

                let match = (/(?:torrents\/\/)(.*.torrent).*/g).exec(output);
                log(match);
                let title = match[1].trim();
                
                // Begin the torrent download
                let path = `torrents/${title}`;
                
                // Download finished
                resolve(path);
            }
        });
    });
}

function getMetadata(filepath): torrentMetadata {

    var torrent = fs.readFileSync(filepath);

    var data = Buffer.from(torrent);
    var result = bencode.decode( data )
    // log(result);

    log(`Torrent Metadata: ${result.info.name.toString()}`);

    var size = 0;
    var files = null;

    if (!result.info.files) {
        size = Math.round((result.info.length / 1024 / 1024) * 10) / 10;
        files = [{
            name: result.info.name.toString(),
            size: size
        }]
    } else {
        files = [];

        result.info.files.forEach((file, i) => {
            let l = Math.round((file.length / 1024 / 1024) * 10) / 10;
            let p = file.path.toString();
            let t = `${p}: ${l} MB`

            size += l;

            log(t);

            files[files.length] = {
                name: p,
                size: l
            }
        })
    }
    
    size = Math.round(size * 10) / 10;

    log(`${size.toString().numberWithCommas()} MB`);

    return {
        name: result.info.name.toString(),
        size: size,
        files: files
    }
}
