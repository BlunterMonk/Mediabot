//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import * as https from "https";
import { log, error, trace, debug, compareStrings } from "../global.js";
import Parser from "rss-parser";

const cacheFile = `./data/downloads.json`;
////////////////////////////////////////////////////////////

let parser = new Parser();

type OnUpdate = ((targetDir: string, links: rssLink[]) => void);
interface torrentFilter {
    filter: string; // Regex match performed on the raw titles found in the feed
    replace?: string; // Regex replace performed on the titles before returned
    destination: string; // Download location for matched titles
}
interface rssConfig {
    source: string; // RSS feed source URL
    enabled: boolean; // Should the RSS feed be active on startup
	targetDirectory: string; // parent target for sorting shows
    interval: number; // interval to read from RSS stream in seconds
    ignoreList: string[]; // list of tags to ignore
    whiteList: string[]; // list of tags that should be grabbed by the feed but not downloaded
    acceptList: torrentFilter[]; // list of accepted tags
}
interface rssItem {
    link: string; // Download link
    title: string; // RSS Item title
    content: string; // RSS Item content
    destination: string; // Item download location
}
export interface rssLink {
    title: string; // title from rss feed entry
    source: string; // source URL of the file 
    magnet?: string; // if present, uses the magnet link to download the file
    destination: string; // destination file path
    whiteListed: boolean; // This file should be downloaded
}
export class RSSFeed {
    // downloadList: {[key:string]: string}; // list of items already claimed from the RSS field
    filename: string;
    configuration: rssConfig;
    readerInterval: any;
    constructor(filename: string) {
        this.filename = filename;
        this.reload();
    }
    startReading(onUpdate: OnUpdate) {
        if (!this.configuration.enabled) {
            debug("RSS Feed Disabled: ", this.filename);
            return;
        }

        this.stopReading();

        this.updateFeed(onUpdate);
        this.readerInterval = setInterval(() => {
            this.updateFeed(onUpdate);
        }, this.configuration.interval * 1000);
    }
    stopReading() {
        if (!this.readerInterval)
            return;

        clearInterval(this.readerInterval);
    }
    reload() {
        this.configuration = JSON.parse(fs.readFileSync(this.filename).toString());
    }
    save() {
        fs.writeFileSync(this.filename, JSON.stringify(this.configuration, null, "\t"));
    }

    getSettings(): rssConfig {
        return this.configuration;
    }
    getTargetDirectory(): string {
        return this.configuration.targetDirectory;
    }

    updateFeed(onUpdate: OnUpdate) {
        readFeed(this.configuration.source, this.configuration.acceptList, this.configuration.ignoreList)
        .then(items => {
            if (items.length == 0) {
                debug("No torrents found from RSS feed");
                return;
            }

            var downloadList: {[key:string]: string} = JSON.parse(fs.readFileSync(cacheFile).toString());

            let links: rssLink[] = [];
            items.forEach(item => {
                var title = item.title.toLowerCase().replaceAll(" ", "_");
                if (downloadList[title])
                    return;

                let m = item.content.match(/\"(magnet.*?)\"/g);
                let mag = null;
                if (m && m.length > 0)
                    mag = m[0];

                const entry = this.configuration.whiteList.find((v, i) => {
                    return compareStrings(item.title, v)
                });
    
                let options = {
                    title: item.title,
                    source: item.link,
                    magnet: mag,
                    destination: item.destination,
                    whiteListed: (entry != null)
                };

                links.push(options);
                downloadList[title] = (mag) ? mag : item.link;
            });

            if (links.length > 0) {
                onUpdate(this.getTargetDirectory(), links);
            }

            fs.writeFileSync(`./data/downloads.json`, JSON.stringify(downloadList, null, "\t"));
        })
        .catch(e => {
            error("Failed to get RSS links: ", e);
        });
    }

    addIgnore(tag: string) {
        this.configuration.ignoreList.push(tag);
        this.save();
    }
    removeIgnore(tag: string): boolean {
        for( var i = 0; i < this.configuration.ignoreList.length; i++){ 
            if (this.configuration.ignoreList[i] === tag) {
                this.configuration.ignoreList.splice(i, 1);
                this.save();
                return true;
            }
        }

        return false;
    }
    addAccept(tag: string, destination: string) {
        this.configuration.acceptList.push({
            filter: tag,
            destination: destination
        });
        this.save();
    }
    removeAccept(tag: string): boolean {
        for( var i = 0; i < this.configuration.acceptList.length; i++){ 
            if (this.configuration.acceptList[i].filter === tag) {
                this.configuration.acceptList.splice(i, 1); 
                this.save();
                return true;
            }
        }

        return false;
    }
    addShow(tag: string) {
        this.configuration.whiteList.push(tag);
        this.save();
    }
    removeShow(tag: string): boolean {
        for( var i = 0; i < this.configuration.whiteList.length; i++){ 
            if (this.configuration.whiteList[i] === tag) {
                this.configuration.whiteList.splice(i, 1);
                this.save();
                return true;
            }
        }

        return false;
    }
}

class rssManager {
    rssFeeds: {[key: string]: RSSFeed};
    constructor() {
        this.rssFeeds = {};
    }

    init() {
        let files = fs.readdirSync("./data/feeds/");
        files.forEach(file => {

            if (!fs.existsSync("./data/feeds/" + file)) {
                error("Failed to start RSS Feed, file does not exist: ", file);
                return;
            }
            
            let name = file.slice(0, file.indexOf("."))
            let feed = new RSSFeed("./data/feeds/" + file);
            this.rssFeeds[name] = feed;
        });
    }
    startReading(feed: string, onUpdate: OnUpdate) {
        if (!this.rssFeeds[feed])
            return;

        this.rssFeeds[feed].startReading(onUpdate);
    }

    updateFeeds() {
        // Object.keys(this.rssFeeds).forEach((v, i) => {
        //     this.rssFeeds[v].updateFeed();
        // });
    }

    getSettings(feed: string): rssConfig {
        return this.rssFeeds[feed].getSettings();
    }
    getTargetDirectory(feed: string): string {
        return this.rssFeeds[feed].getTargetDirectory();
    }
    addIgnore(feed: string, tag: string) {
        this.rssFeeds[feed].addIgnore(tag);
    }
    removeIgnore(feed: string, tag: string): boolean {
        return this.rssFeeds[feed].removeIgnore(tag);
    }
    addAccept(feed: string, tag: string, destination: string) {
        this.rssFeeds[feed].addAccept(tag, destination);
    }
    removeAccept(feed: string, tag: string): boolean {
        return this.rssFeeds[feed].removeAccept(tag);
    }
    addShow(feed: string, tag: string) {
        this.rssFeeds[feed].addShow(tag);
    }
    removeShow(feed: string, tag: string): boolean {
        return this.rssFeeds[feed].removeShow(tag);
    }
}

export const RSSManager = new rssManager();

async function readFeed(source: string, acceptList: torrentFilter[], ignoreList: string[]): Promise<rssItem[]> {

    let feed = await parser.parseURL(source);
    let links : rssItem[] = [];
    
    console.log("Found Items: " + feed.items.length);

    await feed.items.forEach(item => {
        for (let index = 0; index < ignoreList.length; index++) {
            const filter = ignoreList[index];
            const title = item.title.toLowerCase();
            
            if (compareStrings(title, filter)) {
                trace("Filter Removed: " + item.title);
                return;
            }
        }

        for (let index = 0; index < acceptList.length; index++) {
            const filter = acceptList[index].filter;
            const title = item.title.toLowerCase();

            debug("Compare: ", title, " <-> ", filter);
            if (compareStrings(title, filter)) {
                debug("Adding Item from RSS feed: ", item.title, " url: ", item.link);
                if (acceptList[index].replace) {
                    let o = item.title;
                    let n = item.title.replace(new RegExp(acceptList[index].replace), "");
                    debug("Item Title changed: ", o, " -> ", n);
                    item.title = n;
                }
                //for (let i = 0; i < whiteList.length; i++) {
                //    const e = whiteList[i];
                //    if (compareStrings(title, e)) {
                //        item.link = null;
                //        break;
                //    }
                //}

                links.push({
                    link: item.link,
                    title: item.title,
                    content: item.content,
                    destination: acceptList[index].destination
                });
                debug("Total Links: ", links.length);
                return;
            }
        }
    });

    return Promise.resolve(links);
}
