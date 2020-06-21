//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
// AVD: Auto Video Downloader, responsible for managing RSS video downloads
//////////////////////////////////////////

import "../util/string-extension.js";
import { log, error, compareStrings, debug, newTimestamp } from "../global.js";
import * as RSS from "../util/rss.js";
import { downloadTorrent, downloadMagnetFile, TorrentResult, downloadTorrentFile } from "../util/torrent.js";
import { downloadFile, downloadBulkFiles, downloadOptions, getFileExtension, getFilePath } from "../util/download.js";
import * as fs from "fs";
import { generateThumb } from "../util/thumbs.js";
import * as TVDB from "../db/tvdb.js";
import * as AniDB from "../db/anidb.js";
import { Config } from "../config/config";
import { EpisodeMetadata } from "../db/db.js";

// TODO: add these to config file
const cacheFilename = `episode-cache.json`;
const imageTypes = [".png", ".jpg"];


interface CacheEntry {
    key: string; // Cache key
    seriesId: string; // Verified series ID for the downloaded file
    episodeId: string; // Verified episode ID of the downloaded file
    rssLink: string; // Download URL of the file
    rssTitle: string; // Original title of RSS item
    timestamp: number; // Time of download
    whiteListed: boolean; // Should this entry be downloaded
}
interface EpisodeCache {
    [key: string]: EpisodeMetadata
}



//////////////////////////////////////////

export function GetCache(): EpisodeCache {
    if (!fs.existsSync(Config.getCacheDir() + "/" + cacheFilename)) {
        error("Episode Cache Not Found!");
        return null;
    }
    
    return JSON.parse(fs.readFileSync(cacheFilename).toString());
}

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
    RSS.RSSManager.startAll(cacheNewAnime, cacheNewEpisodes);
    // RSS.RSSManager.startReading("nyaa", cacheNewAnime);
    // RSS.RSSManager.startReading("tv", cacheNewEpisodes);
    //RSS.RSSManager.startReading("golumpa", downloadNewEpisodes);
    //RSS.RSSManager.startReading("sakura", downloadNewH);
}


function sendNewTitle(title: string) {
}
function sendNewEpisodeMessage(metadata: EpisodeMetadata) {
}


export function cacheNewAnime(mediaType: string, links: RSS.rssLink[]) {
    cacheNew(mediaType, links, AniDB);
}
export function cacheNewEpisodes(mediaType: string, links: RSS.rssLink[]) {
    cacheNew(mediaType, links, TVDB);
}

function cacheNew(mediaType: string, links: RSS.rssLink[], adapter) {

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
            if (!key || !entry.whiteListed) {
                // TODO: download whitelisted titles but don't sort them
                return;
            }

            let series = adapter.getSeriesMetadata(entry.seriesId);
            let episode = series.episodes.find(e => { return e.id == entry.episodeId; });
            let thumb: string = adapter.getEpisodeThumbnail(entry.seriesId, entry.episodeId);
            let poster = adapter.getSeriesPoster(entry.seriesId);
            let banner = adapter.getSeriesBanner(entry.seriesId);
                        
            let ce: any = episode;
            ce.thumb = thumb.slice(thumb.indexOf("/data/"), thumb.length);
            ce.poster = poster.slice(poster.indexOf("/data/"), poster.length);
            ce.banner = banner.slice(banner.indexOf("/data/"), banner.length);
            ce.timestamp = entry.timestamp;

            debug("Added to cache: ", key, " data: ", ce);

            cache[key] = ce;

            log("Downloading Episode: ", key);

            // Begin torrent download for this episode
            downloadTorrentWithURL(entry, episode)
            .then(output => {
                let file = ApplyMetadata(Config.getMediaDir(), mediaType, episode, output.result);
                if (file) {
                    log("Successfully sorted episode: ", file);
                }

                if (!fs.existsSync(thumb)) {   
                    genThumb(output.entry, file, adapter.getMetadataPath() + output.entry.seriesId + "/");
                }
            })
            .catch(e => {
                error("Failed to download episode: ", e);
            });
        });

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
        timestamp: newTimestamp(),
        whiteListed: false
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
    entry.whiteListed = link.whiteListed;

    if (!link.whiteListed) {
        debug("Discarding episode metadata, series not white listed");
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

export function genThumb(entry: CacheEntry, videoFile: string, metaPath: string) {
    log("Generating Thumbnail From: ", videoFile, " In: ", metaPath);

    generateThumb(videoFile, metaPath, entry.episodeId)
    .then(thumb => {
        log("Successfully Generated Thumbnail: ", thumb);
    })
    .catch(error);
}

// Download a torrent from a URL
interface downloadTorrentWithURLOutput {
    result: TorrentResult;
    entry: CacheEntry;
    metadata: EpisodeMetadata;
}
function downloadTorrentWithURL(entry: CacheEntry, metadata: EpisodeMetadata): Promise<downloadTorrentWithURLOutput> {
    return new Promise<downloadTorrentWithURLOutput>((resolve, reject) => {

        // Download .torrent file from RSS feed
        downloadTorrentFile(Config.getDownloadDir(), entry.rssLink)
        .then(path => {
            log("Downloaded torrent file: ", path);

            downloadTorrent(Config.getDownloadDir(), path, 1, null)
            .then(r => {
                log("Successfully downloaded torrent: ", r);
                resolve({
                    result: r,
                    entry: entry,
                    metadata: metadata
                });
            })
            .catch(e => {
                reject("Failed to download torrent: " + e);
            });
        })
        .catch(e => {
            reject("Failed to download .torrent file: " + e);
        });
    });
}

// Sort file based on the episode metadata
function ApplyMetadata(mediaDir: string, type: string, metadata: EpisodeMetadata, result: TorrentResult): string {
    type = type.toLowerCase();
    
    log("Attempting to download metadata and rename: ", result);

    let series = metadata.seriesTitle.replace(/[\/\?\<\>\\\:\*\|\”]/g, "");
    let original = result.destination;
    let targetPath = mediaDir + type + "/" + series + "/";
    if (!fs.existsSync(targetPath))
        fs.mkdirSync(targetPath, {recursive:true});

    log("Video Directory: ", original);
    log("Target Directory: ", targetPath);
    
    let ext = getFileExtension(result.destination);
    let e = (metadata.episode < 10) ? `E0${metadata.episode}` : `E${metadata.episode}`;
    let s = (metadata.season < 10) ? `S0${metadata.season}` : `S${metadata.season}`;
    let filename = targetPath + `${series} - ${s}${e}${ext}`;

    log("Moving: ", result.destination, " To: ", filename);

    if (fs.existsSync(original)) {
        if (!fs.existsSync(targetPath))
            fs.mkdirSync(targetPath);

        fs.renameSync(original, filename);

        return filename;
    } 
    
    return null;
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