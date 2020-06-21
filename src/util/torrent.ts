//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import { log, error, debug, trace } from "../global.js";
import spawn = require('cross-spawn'); 
import { downloadFile } from "./download.js";
import { v1 as uuidv1 } from 'uuid';

const bencode = require(`bencode`);
const outputRegex = /\[#(.*?)\s([.0-9]+[mbgGMBiI]+)\/([.0-9]+[mbgGMBiI]+)\(([0-9]+)%\)\sCN:[0-9]+\sSD:[.0-9]+\sDL:[.0-9]+[mbgGMBiI]+\sETA:([0-9mhs]+)\]/;
const allocRegex = /\[FileAlloc:#([a-z0-9A-Z]+)\s.*?\]/g;

type OnUpdate = ((progress: torrentProgress[], elapsed: number) => void);
type TrackerUpdate = ((progress: TrackerList) => void);
export interface TorrentResult {
    name: string;
    metadata: any;
    destination: string;
    elapsedTime: number;
}
export interface TrackerList {
    [key: string]: torrentTracking;
}

interface torrentMetadata {
    name: string;
    size: number;
    files: {name: string, size: number}[];
    torrentFilename: string; // path to the .torrent filename 
}
interface torrentProgress {
    id: string; // ID of the download
    current: string; // Current amount of data downloaded
    total: string; // Total size of the download
    progress: string; // Percentage of the download completed 
    eta: string; // Time remaining for the downlaod
}
interface torrentTracking {
    progress: number; // percentile value of the downloads progress
    status: string; // Status of the downlod: (active, complete, failed)
    metadata: torrentMetadata; // Torrent file metadata
}


//////////////////////////////////////////
// TRACKER

class tracker {
    torrents: TrackerList;
    private updateMethod: TrackerUpdate;
    constructor() {
        this.torrents = {};
    }

    get(id: string): torrentTracking {
        return this.torrents[id];
    }

    onUpdate() {
        if (this.updateMethod)
            this.updateMethod(this.torrents);
    }
    setUpdateMethod(onUpdate: TrackerUpdate) {
        this.updateMethod = onUpdate;
    }
    
    findIDWithName(name: string): string {
        return Object.keys(this.torrents).find(key => {
            return (this.torrents[key].metadata.name == name);
        });
    }
    
    add(id: string, metadata: torrentMetadata): boolean {
        if (this.torrents[id])
            return false;

        this.torrents[id] = {
            progress: 0,
            status: "ACTIVE",
            metadata: metadata
        };
        return true;
    }
    addMetadata(id: string, metadata: torrentMetadata): boolean {
        if (!this.torrents[id])
            return false;

        this.torrents[id].metadata = metadata;
        return true;
    }
    update(id: string, progress: number): boolean {
        if (!this.torrents[id])
            return false;
        
        this.torrents[id].progress = progress;
        return true;
    }
    complete(id: string): boolean {
        if (!this.torrents[id])
            return false;

        this.torrents[id].progress = 100;
        this.torrents[id].status = "COMPLETE";
        return true;
    }
    fail(id: string): boolean {
        if (!this.torrents[id])
            return false;

        this.torrents[id].status = "FAILED";
        return true;
    }
    remove(id: string): boolean {
        if (!this.torrents[id])
            return false;

        delete this.torrents[id];
        return true;
    }
    removeAll() {
        this.torrents = {};
    }
}
const Tracker = new tracker();

export function setTrackerUpdateMethod(onUpdate: TrackerUpdate) {
    Tracker.setUpdateMethod(onUpdate);
}

// Track a new torrent download
function trackTorrent(id: string, metadata: torrentMetadata) {
    // Add torrent to tracker
    if (!Tracker.add(id, metadata)) {
        Tracker.addMetadata(id, metadata);
        log("Added Metadata to existing Tracker: ", id, " metadata: ", metadata);
    } else {
        log("Now Tracking: ", id, " metadata: ", metadata);
    }
}

// Update all tracked torrents
function updateTorrents(progress: torrentProgress[]) {

    // If no progress is made do nothing
    if (progress.length == 0)
        return;
    
    // Get the highest value of progress to record
    progress.forEach(prog => {
        let id = prog.id;

        Tracker.add(id, null);

        let pr = parseInt(prog.progress);
        let cr = Tracker.get(id);
        if (!Number.isNaN(pr) && pr > cr.progress) {
            debug("Tracker Updated: ", id, " progress: ", cr.progress, "% -> ", pr, "%");
            Tracker.update(id, pr);
        }
    });

    Tracker.onUpdate();
}

// Mark a torrent as completed
function completeTorrent(name: string) {
    let id = Tracker.findIDWithName(name);
    if (!id) {
        error("Could not find tracked download with name: ", name);
        return;
    }

    log("Tracker Completed: ", id);
    
    Tracker.complete(id);
    Tracker.onUpdate();
}

// Mark a torrent as failed
function failTorrent(name: string) {
    let id = Tracker.findIDWithName(name);
    if (!id) {
        error("Could not find tracked download with name: ", name);
        return;
    }

    log("Tracker Failed: ", id);

    Tracker.fail(id);
    Tracker.onUpdate();
}


//////////////////////////////////////////
// DOWNLOAD TORRENTS

// download the torrent 
export function downloadTorrent(saveLocation: string, torrentPath: string, updateInterval: number, onUpdate: OnUpdate): Promise<TorrentResult> {
    
    debug(`Download Torrent: ${torrentPath} SaveLocation: ${saveLocation}`);
    if (saveLocation[saveLocation.length-1] != "/")
        saveLocation += "/";

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
        log(`Starting Download: ${torrentPath}, metadata: `, metadata);

        const child = spawn(`aria2c "${torrentPath}"`, [
            `-d "${dir}"`,
            `--seed-time=0`,
            `--download-result=full`,
            `--summary-interval=${updateInterval}`
        ], {
            shell: true
        });
        
        // since these are streams, you can pipe them elsewhere
        // child.stdout.setEncoding('utf8');
        // child.stderr.pipe(process.stdout);

        // Handle Errors
        child.on('error', (chunk) => {

            // data from standard output is here as buffers
            let output = chunk.toString()
            error(`child process error ${output}`);

            failTorrent(metadata.name);
            reject(`Download Failed: ${metadata.name}`);
        });

        // Finish Download
        child.on('close', (code) => {
            debug(`child process exited with code ${code}`);

            completeTorrent(metadata.name);

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

            // trace(output);
            let rg = new RegExp(allocRegex, "g");
            let m = rg.exec(output);
            if (m && m[1]) {
                let id = m[1];
                trackTorrent(id, metadata);
            }

            // cleanup output 
            output = output.replace(/[^\]]+(?![^\[]*\])/g, "");
            output = output.replace(/\r?\n|\r/g, "").trim();

            let tick = Math.floor((Date.now() - timer)/1000);
            if (tick > updateInterval) {
                var prog = getProgress(output);

                timer = Date.now();
                if (onUpdate != null)
                    onUpdate(prog, elapsed);

                updateTorrents(prog);
            }
        });
    })
}

// Download the .torrent file associated with the provided magnet URL
export function downloadMagnetFile(saveLocation: string, url: string): Promise<string> {
       
    if (saveLocation[saveLocation.length-1] != "/")
        saveLocation += "/";
    
    debug(`Download Magnet: ${url} SaveLocation: ${saveLocation}`);
    return new Promise<string>((resolve, reject) => {

        var command = `aria2c "${url}"`

        // debug("Magnet Download Command: ", command);
        const child = spawn(command, [
            `-d "${saveLocation}"`,
            `--bt-metadata-only=true`,
            `--bt-save-metadata=true`,
            `--listen-port=6881`
        ], {
            shell: true
        });

        //aria2c -d /Users/dahmitristephenson/Projects/javascript/Mediabot/downloads/ --bt-metadata-only=true --bt-save-metadata=true --listen-port=6881 "magnet:?xt=urn:btih:8D0C9E7727F4A25A7E50BA8DCDF249F5ABDEF070&dn=Rick+and+Morty+S04E01+1080p+WEBRip+x264-TBS%5BTGx%5D&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.pirateparty.gr%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.tiny-vps.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fipv4.tracker.harry.lu%3A80%2Fannounce&tr=udp%3A%2F%2Fretracker.lanta-net.ru%3A2710%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.cyberia.is%3A6969%2Fannounce&tr=udp%3A%2F%2Fipv6.tracker.harry.lu%3A80%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2Ftracker.open-internet.nl%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.si%3A1337%2Fannounce&tr=udp%3A%2F%2Fdenis.stalker.upeer.me%3A6969%2Fannounce&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce"

        // since these are streams, you can pipe them elsewhere
        // child.stdout.setEncoding('utf8');
        // child.stderr.pipe(process.stdout);

        child.on('error', (chunk) => {
            // data from standard output is here as buffers
            let output = chunk.toString()
            console.log(output);
            reject(output);
        });
        
        // Finish downloading torrent file
        child.on('close', (code) => {
            log(`child process exited with code ${code}`);
        });

        child.stdout.on('data', (chunk) => {

            let output = chunk.toString()
            console.log(output);
            if (output.empty())
                return;

            if (output.includes("[ERROR]") || output.includes("[NOTICE]")) {
                var o = output.replace(/\r?\n|\r/g, "").trim();
                trace(`${o}`);
            }
            if (output.includes("Saved metadata")) {

                let match = (/(?:Saved metadata as.*\/\/)(.*.torrent).*/g).exec(output);
                log(match);
                let title = match[1].trim();
                
                // Begin the torrent download
                let path = `${saveLocation}${title}`;
                
                // Download finished
                resolve(path);
            }
        });
    });
}

export function downloadTorrentFile(saveLocation: string, url: string): Promise<string> {
    if (url.startsWith("http")) {
        var uuid = uuidv1();
        return downloadFile(`${saveLocation}${uuid}.torrent`, url);
    } else {
        return downloadMagnetFile(saveLocation, url);
    }
}

/////////////////////////////////////////
// HELPER

export function getMetadata(filepath): torrentMetadata {

    var torrent = fs.readFileSync(filepath);

    var data = Buffer.from(torrent);
    var result = bencode.decode( data )
    // log(result);

    // log(`Torrent Metadata: ${result.info.name.toString()}`);

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

            // log(t);

            files[files.length] = {
                name: p,
                size: l
            }
        })
    }
    
    size = Math.round(size * 10) / 10;

    // log(`${size.toString().numberWithCommas()} MB`);

    return {
        name: result.info.name.toString(),
        size: size,
        files: files,
        torrentFilename: filepath
    }
}

// Convert Output text from download into a progress object
function getProgress(output: string): torrentProgress[] {

    var prog = [];

    var rg = new RegExp(outputRegex, "g");
    var match = rg.exec(output);
    while(match) {
        var update = {
            id: match[1],
            current: match[2],
            total: match[3],
            progress: match[4],
            eta: match[5]
        }
    
        prog.push(update);
    
        match = rg.exec(output); 
    }

    return prog;
}