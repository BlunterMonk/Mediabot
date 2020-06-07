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

};

export const Config = new config();