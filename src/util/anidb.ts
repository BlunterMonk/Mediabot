//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import * as https from "https";
import { log, error, debug, trace } from "../global.js";
import { downloadFile, downloadFileIfNotExist, getFileExtension, getFilePath } from "./download.js";
const AniDb = require("anidbjs");

////////////////////////////////////////////////////////////

const key = JSON.parse(fs.readFileSync("./api-keys.json").toString()).tvdb;
const TVDB = require('node-tvdb');
const tvdb = new TVDB(key);
const client = new AniDb({ client: "myclient", version: 1 });
const imageEndpoint = "https://cdn-us.anidb.net/images/main/";
const filenameCleanup = "[\/\\\:\*\?\"\<\>\|]";
const tvdbImageEndpoint = "https://www.thetvdb.com/banners/";
const seriesKeysFilename = "./data/anime-metadata/keys.json";
const metadataPath = "./data/anime-metadata/";
var titleDump: string = null;
var titleList: string[] = null;


export interface EpisodeMetadata {
    id: string;
    name: string;
    season: number;
    originalTitle: string;
    seriesTitle: string;
    oldFile?: string;
    newFile?: string;
    sourceUrl?: string;
};

////////////////////////////////////////////////////////////

function getEnglishTitle(seriesInfo): string {

    var main = null;
    for (let index = 0; index < seriesInfo.titles.length; index++) {
        const element = seriesInfo.titles[index];
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

function getNameAndEpisode(title): {name: string, episode: string, season?: number} {

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
        name: name,
        episode: episode,
        season: season
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
function getAnimeID(name: string) {
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

////////////////////////////////////////////////////////////

function queryImagesFromTVDB(title, seriesID) {

    tvdb.getSeriesByName(title)
        .then(response => { 
            /* process data */ 
            let series = response[0];
            if (!series)
                return;

            debug("Found series on TVDB: ", series);

            let id = series.id;
            debug("Series ID: " + id);

            let seriesPath = metadataPath + `${seriesID}/`;
            if (!fs.existsSync(seriesPath)) {
                fs.mkdirSync(seriesPath, {recursive: true});
            }

            // save TVDB series info
            fs.writeFileSync(seriesPath + id + ".json", JSON.stringify(series, null, "\t"));

            // Download series banners
            if (series.banner != "") {
                downloadFileIfNotExist(seriesPath + seriesID + "-banner.png", tvdbImageEndpoint + series.banner)
                .then(p => trace("Successfully downloaded series banner: ", p))
                .catch(e => error("Failed to download series banner: ", e));
            }

            // Download all series posters
            tvdb.getSeriesImages(id, "poster")
            .then(images => {
                trace(images);
                    
                images.forEach((img, ind) => {
                    let ext = getFileExtension(img.fileName);
                    let path = seriesPath + `${seriesID}-poster-${ind}${ext}`;

                    downloadFileIfNotExist(path, tvdbImageEndpoint + img.fileName)
                    .then(p => trace("Successfully downloaded series poster: ", p))
                    .catch(e => error("Failed to download series poster: ", e));
                });
            })
        })
        .catch(e => { 
            /* handle error */ 
            error("Failed to get series info: ", e);
        });
}


function getAnimeSiblings(info, type, parsedList, superResolve, superReject) {
    log(`Searchig for related series for: ${type}, from: ${info.id}`);

    new Promise(async (resolve, reject) => {
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
            log("no prequel series found");
            resolve({original:info, list:parsedList});
            return;
        }

        // Get information for related series
        getAnimeInfo(series.id)
        .then(i => {
            var seriesInfo: any = i;
            log("Got Series Info: ", seriesInfo.id);

            if (!parsedList[seriesInfo.id]) {
                log(`Found Series ${type}: ${info.id}`);
                parsedList[series.id] = type;
    
                getAnimeSiblings(seriesInfo, type, parsedList, superResolve, superReject);
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

function getAnimeSeason(info): Promise<{original:any, list:any}> {

    if (info.related && info.related.length == 0)
        return Promise.resolve({original:info, list: {}});

    return new Promise(async (resolve, reject) => {
        log("Begin search for prequels: ", info.id);

        getAnimeSiblings(info, "Prequel", {}, resolve, reject);
    });
}

function getAnimeInfo(id): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        var seriesPath = metadataPath + `${id}/`;
        var path = seriesPath + `${id}.json`;

        // return cached metadata if it exists
        if (fs.existsSync(path)) {
            var dump = fs.readFileSync(path).toString();
            resolve(JSON.parse(dump));
            return;
        }

        // Request metadata from AniDB with a delay to stagger requests
        setTimeout(() => {
            client.anime(id)
            .then(res => {
                cacheAnimeMetadata(res);
                resolve(res);
            })
            .catch(err => {
                reject(err);
            });
        }, 3000);
    });
}
function cacheAnimeMetadata(res) {
    var id = res.id;
    var seriesPath = metadataPath + `${id}/`;
    var path = seriesPath + `${id}.json`;

    // create series path if it doesn't exist
    if (!fs.existsSync(seriesPath))
        fs.mkdirSync(seriesPath, {recursive:true});

    // save series information
    var data = JSON.stringify(res, null, "\t");
    if (!fs.existsSync(path))
        fs.writeFileSync(path, data);

    // save english series name to keys list
    if (fs.existsSync(seriesKeysFilename)) {
        let keys = JSON.parse(fs.readFileSync(seriesKeysFilename).toString());;
        let enName = getEnglishTitle(res);
        if (enName)
            keys[id] = enName;
        fs.writeFileSync(seriesKeysFilename, JSON.stringify(keys, null, "\t"));
    } 

    // download main series poster
    var img = res.picture;
    if (img && img != "") {
        var ext = getFileExtension(img);
        downloadFileIfNotExist(seriesPath + `${id}-poster${ext}`, imageEndpoint + img)
        .then(p => log("Successfully downloaded series poster: " + p))
        .catch(e => log("Failed to download series poster: ", e));
    } else {
        log("No series poster found for: ", id);
    }
}

export function ApplyFileMetadata(videoPath) {

    var filename = videoPath.replace(/^.*[\\\/]/, '');
    let targetPath = getFilePath(videoPath);
    let finalName = "";
    let finalPath = "";
    let name = "";
    
    if (!fs.lstatSync(videoPath).isDirectory()) {
        // Get resolved filename and episode number
        let ext = getFileExtension(filename);
        let res = getNameAndEpisode(filename.replace(ext, ""));
        let name = res.name;
        let episode = res.episode;
        
        finalName = `${name} - E${episode}`;
        finalPath = targetPath + finalName + ext;
    } else {
        let name = filename;
        name = name.replace(/_/g, " ");
        name = name.replace(/\[.*?\]/g, "");
        name = name.replace(/\(.*?\)/g, "");
        name = name.trim();
    
        finalName = name;
        finalPath = targetPath + finalName;
    }

    log("Final File Path: " + finalPath);

    if (fs.existsSync(videoPath)) {
        fs.renameSync(videoPath, finalPath);

        return {
            id: "",
            oldFile: videoPath,
            newFile: finalPath,
            name: finalName,
            season: 0,
            originalTitle: name,
            seriesTitle: name
        }
    }

    return null;
}
export function ApplyAniDBMetadata(videoPath, targetDirectory): Promise<EpisodeMetadata> {
    return new Promise<EpisodeMetadata>((resolve, reject) => {
        log("Attempting to download metadata and rename: ", videoPath);

        GetAniDBMetadata(videoPath, targetDirectory)
        .then(metadata => {
            let targetPath = getFilePath(metadata.newFile);
            log("Video Directory: ", videoPath);
            log("Target Directory: ", targetDirectory);
            log("Target PAth: ", targetPath);

            if (fs.existsSync(videoPath)) {
                if (!fs.existsSync(targetPath))
                    fs.mkdirSync(targetPath);

                fs.renameSync(videoPath, metadata.newFile);

                resolve(metadata);
            }
        })
        .catch(e => {
            reject(e);
        });
    });
}
export function GetAniDBMetadata(videoPath, targetDirectory): Promise<EpisodeMetadata> {
    return new Promise<EpisodeMetadata>((resolve, reject) => {

        var filename = videoPath.replace(/^.*[\\\/]/, '');
        let ext = getFileExtension(filename);

        // Get resolved filename and episode number
        let res = getNameAndEpisode(filename.replace(ext, ""));
        let name = res.name;
        let episode = res.episode;

        log("Searching AniDB for: " + name);
        let id = getAnimeID(name);
        if (!id) { 
            // if the name cannot be found in the data dump
            // rename te file in the same path and resolve
            error("failed to find ID for: " + name);

            let finalName = `${name} - E${episode}`;
            debug("Final File Name: " + finalName);

            let targetPath = targetDirectory + `\\${name}`;//getFilePath(videoPath);
            let finalPath = targetPath + "\\" + finalName + ext;
            debug("Final File Path: " + finalPath);

            resolve({
                id: id,
                oldFile: videoPath,
                newFile: finalPath,
                name: finalName,
                season: 0,
                originalTitle: name,
                seriesTitle: name
            })

            return;
        }

        getAnimeInfo(id)
        .then(seriesInfo => {
            getAnimeSeason(seriesInfo)
            .then(({original, list}) => {

                let season = Object.keys(list).length + 1;
                if (season == 1 && res.season != null) {
                    season = res.season;
                    debug("Using Season from Title: ", res.season);
                }
                let originalTitle = getEnglishTitle(original).replace(/[\/\\\:\*\?\"\<\>\|\.]/g, "");
                let seriesTitle = getEnglishTitle(seriesInfo).replace(/[\/\\\:\*\?\"\<\>\|\.]/g, "");
                
                debug("Original Title: " + originalTitle);
                debug("Series Title: " + seriesTitle);
                debug("Series Season: " + season);
                debug("Episode: " + episode);

                // TODO: finish parsing information for proper file name
                // get episode number from torrent file name
                // apply season number to file and use original series name
                // any file that get a proper file name from aniDB can be put directly into the "TV" folder
                // any file that fails validation put "_episodes"

                // Download series images from TVDB
                queryImagesFromTVDB(originalTitle, id);

                // Resolve filenames and paths, rename the downloaded file to the proper series name
                // and add the season+episode number.
                let finalName = originalTitle;
                let s =  `S${(season < 10) ? "0" : "" }${season}`;
                finalName += ` - ${s}E${episode}`;
                debug("Final File Name: " + finalName);

                let targetPath = targetDirectory + originalTitle + "\\";
                let finalPath = targetPath + finalName + ext;
                debug("Final File Path: " + finalPath);

                resolve({
                    id: id,
                    oldFile: videoPath,
                    newFile: finalPath,
                    name: finalName,
                    season: season,
                    originalTitle: originalTitle,
                    seriesTitle: seriesTitle
                });
            })
            .catch(e => {
                error("Failed to get anime season: ", e);
                error(e);
                reject(e);
            });
        })
        .catch(e => {
            error("Failed to get anime info: ", e);
            error(e);
            reject(e);
        });
    });
}
export function GetMetadata(title): Promise<EpisodeMetadata> {
    return new Promise<EpisodeMetadata>((resolve, reject) => {

        // Get resolved filename and episode number
        var filename = title.replace(/^.*[\\\/]/, '');
        let res = getNameAndEpisode(filename);
        let name = res.name;
        let episode = res.episode;

        log("Searching AniDB for: " + name);
        let id = getAnimeID(name);
        if (!id) { 
            reject("failed to find ID for: " + name)
            return;
        }

        getAnimeInfo(id)
        .then(seriesInfo => {
            getAnimeSeason(seriesInfo)
            .then(({original, list}) => {

                let season = Object.keys(list).length + 1;
                if (season == 1 && res.season != null) {
                    season = res.season;
                    debug("Using Season from Title: ", res.season);
                }
                let originalTitle = getEnglishTitle(original).replace(/[\/\\\:\*\?\"\<\>\|\.]/g, "");
                let seriesTitle = getEnglishTitle(seriesInfo).replace(/[\/\\\:\*\?\"\<\>\|\.]/g, "");
                
                debug("Original Title: " + originalTitle);
                debug("Series Title: " + seriesTitle);
                debug("Series Season: " + season);
                debug("Episode: " + episode);

                // TODO: finish parsing information for proper file name
                // get episode number from torrent file name
                // apply season number to file and use original series name
                // any file that get a proper file name from aniDB can be put directly into the "TV" folder
                // any file that fails validation put "_episodes"

                // Download series images from TVDB
                queryImagesFromTVDB(originalTitle, id);

                // Resolve filenames and paths, rename the downloaded file to the proper series name
                // and add the season+episode number.
                let finalName = originalTitle;
                let s =  `S${(season < 10) ? "0" : "" }${season}`;
                finalName += ` - ${s}E${episode}`;

                resolve({
                    id: id,
                    name: finalName,
                    season: season,
                    originalTitle: originalTitle,
                    seriesTitle: seriesTitle
                });
            })
            .catch(e => {
                error("Failed to get anime season: ", e);
                error(e);
                reject(e);
            });
        })
        .catch(e => {
            error("Failed to get anime info: ", e);
            error(e);
            reject(e);
        });
    });
}