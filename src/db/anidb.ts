//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "../util/string-extension.js";
import * as fs from "fs";
import * as https from "https";
import { log, error, debug, warn, trace, newTimestamp } from "../global.js";
import { downloadFile, downloadFileIfNotExist, getFileExtension, getFilePath } from "../util/download.js";
import { SearchInfo, EpisodeMetadata, SeriesMetadata } from "./db.js";
import { Config } from "../config/config";
import * as AniDB from "../anidbjs/anidb";

////////////////////////////////////////////////////////////

const key = JSON.parse(fs.readFileSync("./config/api-keys.json").toString()).tvdb;
const client = new AniDB.AniDB({ client: "myclient", version: 1 }, {});
const imageEndpoint = "https://cdn-us.anidb.net/images/main/";
const filenameCleanup = "[\/\\\:\*\?\"\<\>\|]";
const seriesKeysFilename = "./data/anime-metadata/keys.json";
var titleDump: string = null;
var titleList: string[] = null;

export function getMetadataPath() { return `${Config.getCacheDir()}anidb-metadata/`; };

////////////////////////////////////////////////////////////
// PARSING


// TODO: Make name resolution modular
export function resolveName(title: string): SearchInfo {

    let name:string = title;
    name = name.replace(/_/g, " ");
    debug("Resolving Name: " + name);
    name = name.replace(/\[.*?\]/g, "");
    debug("Resolving Name: " + name);
    name = name.replace(/\(.*?\)/g, "");
    debug("Resolving Name: " + name);
    name = name.trim();

    log("Attempting to decipher episode: ", title);

    let season = null;
    if (/\sS2|\sS3|\sS4|\sS5/im.test(name)) {
        debug("Found season in title");
        for (let index = 2; index <= 5; index++) {
            const element = `\\sS${index}`;
            debug("Element: ", element);
            let search = new RegExp(element, "im");
            if (search.test(name)) {
                season = index;
                debug("Found Season: ", season);
                name = name.replace(search, "");
                debug("Resolving Name: " + name);
                break;
            }
        }
    }

    let episode = "01";
    let match = name.match(/(?:.(?!-\s))([0-9]+)/im);
    if (match && match[1]) {
        log("Got episode from title: ", match[1]);
        episode = match[1];
    } else {
        log("Could not decipher episode number");
    }
    
    name = name.replace(/-(?:.(?!-))+$/im, "");
    debug("Resolving Name: " + name);
    // name = name.replace(/[\/\\\:\*\?\"\<\>\|]/g, "");
    name = name.trim();
    debug("Resolving Name: " + name);

    return {
        title: name,
        season: (season) ? season : 1,
        episode: parseInt(episode)
    }
}

function maskName(name: string): string {

    let masked = "";
    for (let index = 0; index < name.length; index++) {
        const element = name[index];
        masked += element + "\\s*";
    }

    return masked;
}
 
// getAnimeID - search the dump of titles for the correct title ID
function getAnimeID(name: string): string {
    if (titleDump == null) {
        titleDump = fs.readFileSync("./anime-titles.dat").toString();
        titleList = titleDump.split("\n");
    }

    name = name.replace(/[\/\\\:\*\?\"\<\>\|]/g, "");
    // name = name.replace(/\s/g, ".*");
    let masked = maskName(name);
    let search = new RegExp("^(.*?)(\\|.*)\\|" + masked, "im");
    let match = titleDump.match(search);
    log("Result From Dump: " + search);
    if (!match) {
        debug("Could not find: ", name, ", Searching Title List");

        let similarTitles = [];
        titleList.forEach((cachedTitle, ind) => {
            let id = cachedTitle.slice(0, cachedTitle.indexOf("|"));
            let m = cachedTitle.match(/\|(?:.(?!\|))+$/i);
            if (!m || m.length == 0)
                return;

            let c = m[0];
            c = c.slice(1, c.length);
            let s = c.similarity(name);
            // debug(`Cached Title [${id}]: ${m}, similarity: ${s}`);
            if (s > 0.5) {
                debug("similar title: ", c, " ratio: ", s);
                similarTitles.push({
                    id: id,
                    name: c,
                    similarity: s,
                });
            }
        });

        if (similarTitles.length == 0)
            return null;

        similarTitles.sort((a,b) => b.similarity - a.similarity);
        log("Best Match: ", similarTitles[0], ", similar titles: ", similarTitles);

        return similarTitles[0].id;
    }

    return match[1];
}

// Decide if the series metadata should be recached
function shouldCache(series: SeriesMetadata): boolean {

    let t0 = series.lastUpdated;
    let t1 = newTimestamp();

    if (!t0) 
        return true;
        
    if (t1 > t0) { 
        // it's sooner than one week ago
        let diff = t1 - t0;
        let days = Math.floor(diff / 86400); // 86400 = seconds per day
        let hours = Math.floor((diff - days * 86400) / 3600); // 3600 = seconds per hour
        let totalHours = Math.floor(diff / 3600); 
        debug(`Series last cached ${days} day(s) and ${hours} hour(s) ago`);
        return (totalHours >= Config.getCacheTimer())
    }
    
    return false;
}

//////////////////////////////////////////////////
// CACHED DATA

// Get cached series metadata
export function getSeriesMetadata(id: string): SeriesMetadata {
    let p = `${getMetadataPath()}${id}/${id}.json`; 
    if (!fs.existsSync(p)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(p).toString());
}

// Get cached episode metadata
export function getEpisodeMetadata(seriesID: string, episode: number, season: number): EpisodeMetadata {
    
    let series = getSeriesMetadata(seriesID);
    if (!series || !series.episodes)
        return null;

    // Make sure season is set
    if (!season) {
        season = 1;
    } 

    for (let index = 0; index < series.episodes.length; index++) {
        const ep = series.episodes[index];
        
        if (ep.season == season && ep.episode == episode) {
            return ep;
        }
    }

    // Try finding the episode with absolute number
    for (let index = 0; index < series.episodes.length; index++) {
        const ep = series.episodes[index];
        
        if (ep.season <= season && ep.absEpisode == episode) {
            warn("Returning episode with Absolute Number: ", episode, " Metadata: ", ep);
            return ep;
        }
    }

    return null;
}

export function getEpisodeThumbnail(seriesId: string, episodeId: string): string {
    return `${getMetadataPath()}${seriesId}/thumb_${episodeId}.jpg`;
    let p = `${getMetadataPath()}${seriesId}/thumb_${episodeId}.jpg`;
    if (!fs.existsSync(p))
        return null;

    return p;
}
export function getSeriesPoster(seriesId: string): string {
    return `${getMetadataPath()}${seriesId}/poster.jpg`;
    let p = `${getMetadataPath()}${seriesId}/poster.jpg`;
    if (!fs.existsSync(p))
        return null;

    return p;
}
export function getSeriesBanner(seriesId: string): string {
    return `${getMetadataPath()}${seriesId}/banner.jpg`;
    let p = `${getMetadataPath()}${seriesId}/banner.jpg`;
    if (!fs.existsSync(p))
        return null;

    return p;
}

//////////////////////////////////////////////////




export function cacheSeriesMetadata(title: string): Promise<string> {

    var id = getAnimeID(title);
    if (!id || id.empty()) {
        return Promise.reject("Unable to find ID for title: " + title)
    }

    var info = load(id);
    if (info && !shouldCache(info)) {
        log("Recaching saved file");
        return Promise.resolve(`${info.id}`);
    }

    return new Promise<string>((resolve, reject) => {setTimeout(() => {

        client.anime(id)
        .then(info => {
            debug("Downloaded Anime info from AniDB: ", info.id);

            saveRaw(info);
            cacheMetadata(info)
            .then(resolve)
            .catch(reject);
        })
        .catch(reject);

    }, 3000);});
}

function cacheMetadata(series: AniDB.seriesMetadata): Promise<string> {

    var id = series.id;
    var seriesPath = getMetadataPath() + `${id}/`;
    var path = seriesPath + `${id}.json`;

    // create series path if it doesn't exist
    if (!fs.existsSync(seriesPath))
        fs.mkdirSync(seriesPath, {recursive:true});

    // download main series poster
    // saveImage(series.id, series.picture, "poster");
    
    return new Promise<string>((resolve, reject) => {
        debug("Searching for series season");

        getOriginalSeries(series)
        .then(({original, prequels, sequels}) => {
            
            let time = newTimestamp();
            let season = Object.keys(prequels).length + 1;

            // Get main title
            let originalTitle = getEnglishTitle(original.titles);
            let title = getEnglishTitle(series.titles)
 
            debug("Original Title: " + originalTitle);
            debug("Series Title: " + title);
            debug("Series Season: " + season);

            let episodes: EpisodeMetadata[] = [];
            let absEp = 0;

            // Add episodes from previous seasons
            let preKeys = Object.keys(prequels).sort(); // This is not fullproof and may fail but it's probably ok
            preKeys.forEach((pk, ind) => {
                var e: EpisodeMetadata[] = getEpisodes(prequels[pk], originalTitle, (ind+1), absEp);
                absEp = absEp + e.length;
                episodes = episodes.concat(e);
            });

            // Add current season episodes
            let current = getEpisodes(series, originalTitle, season, absEp);
            absEp = absEp + current.length;
            episodes = episodes.concat(current);

            // Add episodes from sequels
            let seqKeys = Object.keys(sequels).sort();
            seqKeys.forEach((sk, ind) => {
                var e: EpisodeMetadata[] = getEpisodes(sequels[sk], originalTitle, season + (ind+1), absEp);
                absEp = absEp + e.length;
                episodes = episodes.concat(e);
            });

            // Get english title and convert titles to aliases
            var aliases: string[] = original.titles.map(t => {
                return t.title;
            });

            // Populate series metadata
            var metadata: SeriesMetadata = {
                id: original.id,
                lastUpdated: time,
                aliases: aliases,
                seriesName: originalTitle,
                startDate: series.startDate,
                endDate: series.endDate,
                network: "",
                overview: series.description,
                slug: "", // maybe put original title here
                status: "", // TODO: parse end date to see if it's still airing
                image: "",
                banner: "",
                poster: series.picture,
                episodes: episodes
            };

            // save series information
            var data = JSON.stringify(metadata, null, "\t");
            fs.writeFileSync(path, data);

            resolve(`${metadata.id}`);
        })
        .catch(e => {
            error("Failed to get proper season for title: ", series.id, " error:", e);
            reject(e);
        });
        
        // save english series name to keys list
        // if (en && fs.existsSync(seriesKeysFilename)) {
        //     let keys = JSON.parse(fs.readFileSync(seriesKeysFilename).toString());;
        //     keys[id] = en;
        //     fs.writeFileSync(seriesKeysFilename, JSON.stringify(keys, null, "\t"));
        // } 
    });
}



////////////////////////////////////////////////////////////
// ANIDB INFO PARSING
// these helper functions are used to get data from AniDB and parse it into 
// data used by the application.

type listMetadata = {[key: string]: AniDB.seriesMetadata};
type sresolve = (output: getSiblingsOutput) => void;
interface getSiblingsOutput {
    final: AniDB.seriesMetadata;
    list: listMetadata;
}
interface getOriginalSeriesOutput {
    original: AniDB.seriesMetadata;
    prequels: listMetadata;
    sequels?: listMetadata;
}


// Search through the titles to find the main english title
function getEnglishTitle(titles: AniDB.rawTitles[]): string {

    var main = null;
    for (let index = 0; index < titles.length; index++) {
        const element = titles[index];

        if (element.language == "en" && element.type == "official") {
            return element.title;
        }
        if (element.type == "main") {
            main = element.title;
        }
    }

    log("Could not get official title");

    return main;
}

// Find the original series and all prequels/sequels associated with it
function getOriginalSeries(info: AniDB.seriesMetadata): Promise<getOriginalSeriesOutput> {

    if (info.related && info.related.length == 0)
        return Promise.resolve({original:info, prequels: {}, sequels: {}});

    return new Promise(async (resolve, reject) => {
        log("Begin search for prequels: ", info.id);

        getSiblings(info, "Prequel", {}, (o1) => {
        
            log("Begin search for sequels: ", info.id);
            getSiblings(info, "Sequel", {}, (o2) => {
                resolve({
                    original: o1.final,
                    prequels: o1.list,
                    sequels: o2.list
                })
            }, reject); 
        }, reject);
    });
}

// Recursively search through the related series to find all prequels/sequels
function getSiblings(info: AniDB.seriesMetadata, type: string, parsedList: listMetadata, superResolve: sresolve, superReject) {
    log(`Searchig for related series for: ${type}, from: ${info.id}`);

    new Promise<getSiblingsOutput>(async (resolve, reject) => {
        // Look for the next series in the chain 
        var series = null;
        for (let index = 0; index < info.related.length; index++) {
            const s = info.related[index];
            if (s.type == type) {
                series = s;
                break;
            }
        }

        // No more prequels found, end the loop
        if (series == null) {
            log(`no ${type} series found`);
            resolve({final:info, list:parsedList});
            return;
        }

        // Get information for related series
        let seriesId = `${series.id}`;
        getAnimeInfo(seriesId)
        .then(seriesInfo => {
            let seriesInfoId = `${seriesInfo.id}`;
            debug("Got Series Info: ", seriesInfoId);

            if (!parsedList[seriesInfoId]) {
                debug(`Found Series ${type}: ${info.id}`);
                parsedList[seriesInfoId] = seriesInfo;
    
                getSiblings(seriesInfo, type, parsedList, superResolve, superReject);
            }
        })
        .catch(e => {
            superReject(e);
        });
    })
    .then(res => {
        // log(`Finishing searching for ${type}'s`);
        // log(res.list);
        superResolve(res);
    })
    .catch(e => {
        error("Get Anime Siblings Failed: ", e);
    });
}

// Parse the episodes from the AniDB metadata into EpisodeMetadata
function getEpisodes(series: AniDB.seriesMetadata, title: string, season: number, abs: number): EpisodeMetadata[] {
    return series.episodes.map(ep => {
        let n = ep.titles.find(t => {
            return t.language == "en";
        });

        return {
            id: `${ep.id}`,
            name: n.title,
            date: ep.airDate,
            thumb: null, // AniDB does not store thumbnails
            season: season, // season number
            episode: parseInt(ep.episodeNumber),
            absEpisode: abs + parseInt(ep.episodeNumber), 
            overview: ep.summary,
            seriesId: `${series.id}`,
            seriesTitle: title
        };
    }); 
}

// Used to get raw data
function getAnimeInfo(id: string): Promise<AniDB.seriesMetadata> {
    
    var info = loadRaw(id);
    if (info) {
        return Promise.resolve(info);
    }
    
    return new Promise<AniDB.seriesMetadata>((resolve, reject) => {
        // Request metadata from AniDB with a delay to stagger requests
        setTimeout(() => {
            client.anime(id)
            .then(info => {
                saveRaw(info);
                resolve(info);
            })
            .catch(reject);
        }, 3000);
    });
}

// save the raw series metadata to disk
function saveRaw(series: AniDB.seriesMetadata) {
    var id = series.id;
    var seriesPath = getMetadataPath() + `${id}/`;
    var path = seriesPath + `${id}.raw.json`;

    debug("Saving raw AniDB info to: ", path);

    // create series path if it doesn't exist
    if (!fs.existsSync(seriesPath))
        fs.mkdirSync(seriesPath, {recursive:true});
                
    // save series information
    var data = JSON.stringify(series, null, "\t");
    fs.writeFileSync(path, data);
}

// return cached metadata if it exists
function load(id: string): SeriesMetadata {
    var seriesPath = getMetadataPath() + `${id}/`;
    var path = seriesPath + `${id}.json`;
    
    if (fs.existsSync(path)) {
        debug("Loading raw AniDB info from: ", path);

        var dump = fs.readFileSync(path).toString();
        return JSON.parse(dump);
    }

    return null;
}

// return cached metadata if it exists
function loadRaw(id: string): AniDB.seriesMetadata {
    var seriesPath = getMetadataPath() + `${id}/`;
    var path = seriesPath + `${id}.raw.json`;
    
    if (fs.existsSync(path)) {
        debug("Loading raw AniDB info from: ", path);

        var dump = fs.readFileSync(path).toString();
        return JSON.parse(dump);
    }

    return null;
}

function saveImage(seriesId: number, path: string, name: string) {
    
    if (!path || path.empty()) {
        log("No series poster found for: ", seriesId);
        return;
    }

    var seriesPath = getMetadataPath() + `${seriesId}/`;
    var path = seriesPath + `${seriesId}.json`;

    var ext = getFileExtension(path);
    downloadFileIfNotExist(seriesPath + `poster${ext}`, imageEndpoint + path)
    .then(p => log(`Successfully downloaded series ${name}: ` + p))
    .catch(e => log(`Failed to download series ${name}: `, e));
}