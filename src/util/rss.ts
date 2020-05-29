//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import * as https from "https";
import { log, error, trace, debug, compareStrings } from "../global.js";
import { downloadOptions } from "./download.js";
import Parser from "rss-parser";

////////////////////////////////////////////////////////////

let parser = new Parser();

export type rssItem = torrentFilter;

type OnUpdate = ((targetDir: string, links: downloadOptions[], whiteList: string[]) => void);
interface torrentFilter {
    filter: string;
    destination: string;
}
interface rssConfig {
    source: string; // RSS feed source URL
	targetDirectory: string; // parent target for sorting shows
    interval: number; // interval to read from RSS stream in seconds
    ignoreList: string[]; // list of tags to ignore
    whiteList: string[]; // list of tags that should be grabbed by the feed but not downloaded
    acceptList: torrentFilter[]; // list of accepted tags
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
        readFeed(this.configuration.source, this.configuration.acceptList, this.configuration.ignoreList, this.configuration.whiteList)
        .then(items => {
            if (items.length == 0) {
                debug("No torrents found from RSS feed");
                return;
            }

            var downloadList: {[key:string]: string} = JSON.parse(fs.readFileSync(`./data/downloads.json`).toString());

            let links: downloadOptions[] = [];
            items.forEach(item => {
                var title = item.title.toLowerCase().replaceAll(" ", "_");
                if (downloadList[title])
                    return;

                let name = item.title.slice(0, item.title.lastIndexOf("."));
                let m = item.content.match(/\"(magnet.*?)\"/g);
                let mag = null;
                if (m && m.length > 0)
                    mag = m[0];
                
                let options = {
                    title: item.title,
                    filename: name,
                    source: item.link,
                    magnet: mag,
                    destination: item.destination
                };
                debug("Downloading: ", options);

                links.push(options);
                downloadList[title] = item.link;
            });

            if (links.length > 0) {
                onUpdate(this.getTargetDirectory(), links, this.configuration.whiteList);
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

async function readFeed(source: string, acceptList: torrentFilter[], ignoreList: string[], whiteList: string[]): Promise<Parser.Item> {

    let feed = await parser.parseURL(source);
    let links : Parser.Item[] = [];
    
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

            if (compareStrings(title, filter)) {
                debug("Adding Item from RSS feed: ", item.title, " url: ", item.link);
                item.destination = acceptList[index].destination
                //for (let i = 0; i < whiteList.length; i++) {
                //    const e = whiteList[i];
                //    if (compareStrings(title, e)) {
                //        item.link = null;
                //        break;
                //    }
                //}

                links.push(item);
                debug("Total Links: ", links.length);
                return;
            }
        }
    });

    return Promise.resolve(links);
}
