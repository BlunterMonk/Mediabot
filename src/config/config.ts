//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////


import { log } from "../global.js";
import * as fs from 'fs';
import "../util/string-extension.js";

const filename = './config/config.json';

interface configuration {
    name: string; // App name
    logLevel: string; // App log level (error, warn, debug, info, silly)
    downloadDir: string; // Directory where files should be stored before sorting
    mediaDir: string; // Root folder of media folder where downloads will be sorted into
    cacheDir: string; // Location to store cached video metadata and images
    cacheLimit: number; // Amount of episodes that should remain in the RSS cache
    cacheTimer: number; // Total number of hours before a series should be recached
}
export class config {
    configuration: configuration;
    serverSettings: any;
    constructor() {
        this.init();
    }

    init() {
        var data = fs.readFileSync(filename);
        this.configuration = JSON.parse(data.toString());
    }
    save() {
        var newData = JSON.stringify(this.configuration, null, "\t");
        fs.writeFileSync(filename, newData);
    }
    reload() {
        var data = fs.readFileSync(filename);
        this.configuration = JSON.parse(data.toString());
    }

    getMediaDir(): string {
        return this.configuration.mediaDir;
    }
    getCacheDir(): string {
        return this.configuration.cacheDir;
    }
    getDownloadDir(): string {
        return this.configuration.downloadDir;
    }

    // Time in hours when a series should be recached
    getCacheTimer(): number {
        return this.configuration.cacheTimer;
    }

};

export const Config = new config();