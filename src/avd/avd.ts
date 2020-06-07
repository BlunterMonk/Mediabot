//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
// AVD: Auto Video Downloader, responsible for managing RSS video downloads
//////////////////////////////////////////

import "../util/string-extension.js";
import { log, error, compareStrings, debug } from "../global.js";
import * as RSS from "../util/rss.js";
import { downloadTorrent, downloadMagnetFile, TorrentResult } from "../util/torrent.js";
import { downloadFile, downloadBulkFiles, downloadOptions, getFileExtension, getFilePath } from "../util/download.js";
import * as fs from "fs";
import { generateThumb } from "../util/thumbs.js";
import * as TVDB from "../db/tvdb.js";
import * as AniDB from "../db/anidb.js";
import { Config } from "../config/config";
import { EpisodeMetadata } from "../db/db.js";

// TODO: add these to config file
const cacheFilename = `rss-cache.json`;
const imageTypes = [".png", ".jpg"];


interface CacheEntry {
    key: string; // Cache key
    seriesId: string; // Verified series ID for the downloaded file
    episodeId: string; // Verified episode ID of the downloaded file
    rssLink: string; // Download URL of the file
    rssTitle: string; // Original title of RSS item
    timestamp: number; // Time of download
}




//////////////////////////////////////////

// return an image with any extension
function resolveImage(dir, name) {
    var file = null;

    for (var i = 0; i < imageTypes.length; i++) {
        var filename = dir + name + imageTypes[i];
        if (fs.existsSync(filename)) {
            file = filename;
            break;
        }
    }

    return file;
}

//////////////////////////////////////////

export function Init() {
    log("Starting RSS Feeds");
    RSS.RSSManager.init();
    RSS.RSSManager.startReading("nyaa", cacheNewAnime);
    // RSS.RSSManager.startReading("tv", cacheNewEpisodes);
    //RSS.RSSManager.startReading("golumpa", downloadNewEpisodes);
    //RSS.RSSManager.startReading("sakura", downloadNewH);
}


function sendNewTitle(title: string) {
}
function sendNewEpisodeMessage(metadata: EpisodeMetadata) {
}


export function cacheNewAnime(targetDir: string, links: RSS.rssLink[]) {
    cacheNew(targetDir, links, AniDB);
}
export function cacheNewEpisodes(targetDir: string, links: RSS.rssLink[]) {
    cacheNew(targetDir, links, TVDB);
}

function cacheNew(targetDir: string, links: RSS.rssLink[], adapter) {

    var precache = {};
    var metas = links.map(m => {
        return retrieveLinkMetadata(m, precache, adapter);
    });

    Promise.all(metas).then(entries => {
        log("Cached Episodes: ", metas.length);

        var cache = {};
        var cacheFile = Config.getCacheDir() + cacheFilename;
        if (fs.existsSync(cacheFile)) {
            cache = JSON.parse(fs.readFileSync(cacheFile).toString());
        }

        entries.forEach(entry => {
            let key = entry.key;
            if (!key) {
                // TODO: download whitelisted titles but don't sort them
                return;
            }

            let series = adapter.getSeriesMetadata(entry.seriesId);
            let episode = series.episodes.find(e => { return e.id == entry.episodeId; });
            let thumb = adapter.getEpisodeThumbnail(entry.seriesId, entry.episodeId);
            let poster = adapter.getSeriesPoster(entry.seriesId);
            let banner = adapter.getSeriesBanner(entry.seriesId);
            
            let ce: any = episode;
            ce.thumb = thumb;
            ce.poster = poster;
            ce.banner = banner;
            ce.timestamp = entry.timestamp;

            debug("Added to cache: ", key, " data: ", ce);
            cache[key] = ce;
        });

        log("Final Cache: ", cache);
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
    })
    .catch(e => {
        error("Error occurred while getting metadata: ", e);
    });
}

function retrieveLinkMetadata(link: RSS.rssLink, cache, adapter): Promise<CacheEntry> {
    let entry = {
        key: null,
        seriesId: null,
        episodeId: null,
        rssLink: (link.magnet) ? link.magnet : link.source,
        rssTitle: link.title,
        timestamp: Math.floor(Date.now() / 1000),
    };

    var info = adapter.resolveName(link.title);
    if (!info) {
        error("Failed to resolve title: ", link.title, " url: ", link.source);
        return Promise.resolve(entry);
    }
    
    log("New Episode from RSS: ", link, ', Info: ', info);

    // add current batch to precache, this will also ensure no duplicates are cached during the same batch
    var key = `${info.title.toLowerCase().replace(/\s/g, "_")}_s${info.season}e${info.episode}`;
    entry.key = key;

    if (!link.whiteListed) {
        return Promise.resolve(entry);
    }
    
    if (cache[key]) {

        debug("Discarding download, already present in cache: ", link);

        let c = cache[key];
        entry.episodeId = c.id;
        entry.seriesId = c.seriesId;

        return Promise.resolve(entry);
    }

    return new Promise<CacheEntry>((resolve, reject) => {
        adapter.cacheSeriesMetadata(info.title)
        .then(id => {
            log("Episode Metadata Found: ", id);
            
            let episode = adapter.getEpisodeMetadata(`${id}`, info.episode, info.season);
            entry.seriesId = episode.seriesId;
            entry.episodeId = episode.id;

            resolve(entry);
        })
        .catch(e => {
            error("Unable to find series information: ", e);
            resolve(entry);
        });
    });
}





function downloadNewEpisodes(targetDir: string, links: RSS.rssLink[]) {

    if (links.length == 0) {
        log("No new torrents");
        return;
    }

    log("Batch of RSS torrents found: ", links);
    downloadBulkAnime(targetDir, links);
}

function downloadBulkAnime(targetDir: string, links: RSS.rssLink[]) {

    // Run the broadcast and metadata on the new episode if it could not be downloaded.
    var _fail = function(link: RSS.rssLink) {
        // sendNewEpisodeMessage(metadata);
    } 

    links.forEach(link => {
        if (!link.whiteListed) {
            log("Discarding file to not download: ", link.title);
            _fail(link);
            return;
        }

        log("Starting Download for: ", link);
        downloadTorrentFromRSS(link)
            .then(result => {

                // log("Successfully Downloaded: ", metadata.name);

                /*
                ApplyAniDBMetadata(result.destination, targetDir)
                    .then(metadata => {
                        log("Got series metadata: ", metadata);
                        metadata.sourceUrl = link.source;
                        sendNewEpisodeMessage(metadata);
                    })
                    .catch(e => {
                        error("Failed to get series metadata: ", e);
                        sendNewTitle(result.name);
                    });
                */
            })
            .catch(e => {
                error("Failed to download torrent: ", e);
                _fail(link);
            });
    });
}


// Download a torrent from a URL
function downloadTorrentFromRSS(link: RSS.rssLink): Promise<TorrentResult> {
    return new Promise<TorrentResult>((resolve, reject) => {

        var pass = function(p) {
            log("Beginning torrent download for file: ", p);

            // Attempt to download torrent
            downloadTorrent(link.destination, p, log)
                .then(resolve)
                .catch(reject);
        }
        
        let name = link.title.slice(0, link.title.lastIndexOf("."));
        // Download .torrent file from RSS feed
        if (link.magnet) {

            downloadMagnetFile("./torrents/" + name, link.magnet)
                .then(pass)
                .catch(e => {
                    error("Failed to download Magnet file: ", e);
                    reject(e);
                })

        } else {

            downloadFile("./torrents/" + name, link.source)
                .then(pass)
                .catch(e => {
                    error("Failed to download .torrent file: ", e);
                    reject(e);
                });
        }
    });
}

        /* TODO: Fix file sorting
        // Get resolved filename and episode number
        var filename = title.replace(/^.*[\\\/]/, '');
        let res = resolveName(filename);
        let name = res.name;
        let episode = res.episode;

        log("Searching AniDB for: " + name);
        let id = getAnimeID(name);
        if (!id) { 
            reject("failed to find ID for: " + name)
            return;
        }

        // Resolve filenames and paths, rename the downloaded file to the proper series name
        // and add the season+episode number.
        let finalName = originalTitle;
        let s =  `S${(season < 10) ? "0" : "" }${season}`;
        finalName += ` - ${s}E${episode}`;
         */

export function ApplyFileMetadata(videoPath) {

    var filename = videoPath.replace(/^.*[\\\/]/, '');
    let targetPath = getFilePath(videoPath);
    let finalName = "";
    let finalPath = "";
    let name = "";
    
    if (!fs.lstatSync(videoPath).isDirectory()) {
        // Get resolved filename and episode number
        let ext = getFileExtension(filename);
        let res = AniDB.resolveName(filename.replace(ext, ""));
        let name = res.title;
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
            name: finalName,
            oldFile: videoPath,
            newFile: finalPath
        }
    }

    return null;
}
export function ApplyAniDBMetadata(videoPath, targetDirectory): Promise<EpisodeMetadata> {
    return new Promise<EpisodeMetadata>((resolve, reject) => {
        log("Attempting to download metadata and rename: ", videoPath);

        /*
        AniDB.getSeriesMetadata()
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
        */

    });
}
