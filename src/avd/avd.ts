//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
// AVD: Auto Video Downloader, responsible for managing RSS video downloads
//////////////////////////////////////////

import "../util/string-extension.js";
import { log, error, compareStrings } from "../global.js";
import * as RSS from "../util/rss.js";
import { downloadTorrent, downloadMagnetFile, TorrentResult } from "../util/torrent.js";
import { downloadFile, downloadBulkFiles, downloadOptions } from "../util/download.js";
import * as AniDB from "../util/anidb.js";
import * as fs from "fs";
import { generateThumb } from "../util/thumbs.js";

//////////////////////////////////////////

// return an image with any extension
const imageTypes = [".png", ".jpg"];
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
    RSS.RSSManager.startReading("nyaa", downloadNewEpisodes);
    //RSS.RSSManager.startReading("golumpa", downloadNewEpisodes);
    //RSS.RSSManager.startReading("sakura", downloadNewH);
}


function sendNewTitle(title: string) {

}

function sendNewEpisodeMessage(metadata: AniDB.EpisodeMetadata) {

    // Get the series image to send in the embed
    generateThumb(metadata.newFile)
        .then(thumb => {

        })
        .catch(e => {
            error("Failed to create video thumbnail: ", e);

        });
}

function downloadNewEpisodes(targetDir: string, links: downloadOptions[], whiteList: string[]) {

    if (links.length == 0) {
        log("No new torrents");
        return;
    }

    log("Batch of RSS torrents found: ", links);
    downloadBulkAnime(targetDir, links, whiteList)
        .then(metadata => {
            log("Successfully Downloaded: ", metadata.name);
        })
        .catch(e => {
            log("New Episode Not Downloaded: ", e);
        });
}

function downloadBulkAnime(targetDir: string, links: downloadOptions[], whiteList: string[]): Promise<AniDB.EpisodeMetadata> {

    // Run the broadcast and metadata on the new episode if it could not be downloaded.
    var _fail = function(link: downloadOptions) {
        AniDB.GetMetadata(link.title)
            .then(metadata => {
                log("Got series metadata: ", metadata);
                metadata.sourceUrl = link.source;
                sendNewEpisodeMessage(metadata);
            })
            .catch(e => {
                error("Failed to get series metadata: ", e);
                sendNewTitle(link.title);
            });
    } 

    return new Promise<AniDB.EpisodeMetadata>((resolve, reject) => {

        links.forEach(link => {
            const entry = whiteList.find((v, i) => {
                return compareStrings(link.title, v)
            });

            if (!entry) {
                log("Discarding file to not download: ", link.title);
                _fail(link);
                return;
            }

            log("Starting Download for: ", link);
            downloadTorrentFromRSS(link)
                .then(result => {
                    AniDB.ApplyAniDBMetadata(result.destination, targetDir)
                        .then(metadata => {
                            log("Got series metadata: ", metadata);
                            metadata.sourceUrl = link.source;
                            sendNewEpisodeMessage(metadata);
                        })
                        .catch(e => {
                            error("Failed to get series metadata: ", e);
                            sendNewTitle(result.name);
                        });
                })
                .catch(e => {
                    error("Failed to download torrent batch: ", e);
                    _fail(link);
                });
        });
    });
}


function downloadNewH(targetDir: string, links: downloadOptions[], whiteList: string[]) {

    if (links.length == 0) {
        log("No new torrents");
        return;
    }

    log("Batch of RSS torrents found: ", links);
    links.forEach(link => {
        downloadTorrentFromRSS(link)
            .then(result => {
                let metadata = AniDB.ApplyFileMetadata("D:/_h/[SakuraCircle] Princess Memory (DVD 640x480 Hi10P h264 Dual-Audio AC3)")
                log("Downloaded new H: ", result, ", Metadata: ", metadata);
            })
            .catch(e => {
                error("Failed to download torrent batch: ", e);
            });
    });
}


// Download a torrent from a URL
function downloadTorrentFromRSS(link: downloadOptions): Promise<TorrentResult> {
    return new Promise<TorrentResult>((resolve, reject) => {

        var pass = function(p) {
            log("Beginning torrent download for file: ", p);

            // Attempt to download torrent
            downloadTorrent(link.destination, p, log)
                .then(resolve)
                .catch(reject);
        }
        
        // Download .torrent file from RSS feed
        if (link.magnet) {

            downloadMagnetFile("./torrents/" + link.filename, link.magnet)
                .then(pass)
                .catch(e => {
                    error("Failed to download Magnet file: ", e);
                    reject(e);
                })

        } else {

            downloadFile("./torrents/" + link.filename, link.source)
                .then(pass)
                .catch(e => {
                    error("Failed to download .torrent file: ", e);
                    reject(e);
                });
        }
    });
}