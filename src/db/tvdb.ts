//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "../util/string-extension.js";
import TVDB from 'node-tvdb';
import * as fs from "fs";
import * as https from "https";
import { log, error, debug, trace, newTimestamp } from "../global.js";
import { downloadFile, downloadFileIfNotExist, getFileExtension, getFilePath } from "../util/download.js";
import { SearchInfo, EpisodeMetadata, SeriesMetadata } from "./db.js";
import { Config } from "../config/config";

////////////////////////////////////////////////////////////

const key = JSON.parse(fs.readFileSync("./config/api-keys.json").toString()).tvdb;
const tvdb = new TVDB(key);
const imageEndpoint = "https://artworks.thetvdb.com";
const thumbEndpoint = "https://artworks.thetvdb.com/banners/";
const seriesKeysFilename = "./data/tvdb-metadata/keys.json";
const epiReg = new RegExp("S([0-9]+)E([0-9]+)");

export function getMetadataPath() { return `${Config.getCacheDir()}tvdb-metadata/`; };

//////////////////////////////////////////////////
// CACHED DATA

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

// Get cached episode metadata
export function getEpisodeMetadata(seriesID: string, episode: number, season: number): EpisodeMetadata {
    
    let series = getSeriesMetadata(seriesID);
    if (!series || !series.episodes)
        return null;

    for (let index = 0; index < series.episodes.length; index++) {
        const ep = series.episodes[index];
        
        if (ep.season == season && ep.episode == episode) {
            return ep;
        }
    }

    return null;
}

export function getSeriesMetadata(id: string): SeriesMetadata {
    let p = `${getMetadataPath()}${id}/${id}.json`; 
    if (!fs.existsSync(p)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(p).toString());
}

// TODO: Make name resolution modular
// Get the series name, season, and episode number based on the regex provided
// title: full name of the file
export function resolveName(title: string): SearchInfo {

    var m = title.match(epiReg);
    if (!m || m.length < 3) {
        console.log("Failed to resolve name with given configuration");
        return null;
    }
    
    title = title.replace(epiReg, "");

    return {
        title: title.trim(),
        season: parseInt(m[1]),
        episode: parseInt(m[2])
    }
}


//////////////////////////////////////////////////
// DATA LOOKUP AND CACHING

export function getTVDBMetadata(info: SearchInfo): Promise<EpisodeMetadata> {

    log("Searching TVDB For: ", info);
    
    return new Promise<EpisodeMetadata>((resolve, reject) => {
        tvdb.getSeriesByName(info.title)
        .then(r => {

            var series = r[0];
            console.log(series);

            tvdb.getEpisodesBySeriesId(series.id)
            .then(r => {
                var episodes = r;
                series.episodes = episodes;
                // console.log(episodes);

                var current = episodes.find(e => {
                    if (e.airedSeason == info.season && e.airedEpisodeNumber == info.episode) {
                        return e;
                    }
                });

                if (current) {
                    var data: EpisodeMetadata = {
                        id: current.id,
                        date: current.firstAired,
                        name: current.episodeName,
                        thumb: current.filename,
                        season: current.airedSeason,
                        episode: current.airedEpisodeNumber,
                        absEpisode: current.absoluteNumber,
                        overview: current.overview,
                        seriesId: current.seriesId,
                        seriesTitle: info.title
                    };
                    
                    resolve(data);
                }
            })
            .catch(e => {
                console.log("Failed to retrieve series episodes");
                console.error(e);
            })
        })
        .catch(e => {
            console.log("Failed to get series with name: " + info.title);
            console.error(e);
        });
    });
}

// Get the series ID using the title
export function getSeriesID(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        tvdb.getSeriesByName(title)
        .then(s => {
            if (s && s.length > 0) {
                resolve(s[0].id);
            } else {
                reject("No series found");
            }
        })
        .cache(reject);
    });
}

export function cacheSeriesMetadata(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        tvdb.getSeriesByName(title)
        .then(r => {
            var series: SeriesMetadata = r[0];
            cacheMetadata(series).then(resolve).catch(reject);
        })
        .catch(e => {
            console.log("Failed to get series with name: " + title);
            reject(e);
        });
    });
}


function cacheMetadata(series: SeriesMetadata): Promise<string> {
    return new Promise<string>((resolve, reject) => {

        let path = `${getMetadataPath()}${series.id}/`;
        let p = path.slice(0, path.lastIndexOf("/"));
        if (!fs.existsSync(p)) {
            log("Creating directory: ", p);
            fs.mkdirSync(p, { recursive: true });
        }

        // Download series poster
        downloadFileIfNotExist(`${path}poster${getFileExtension(series.poster)}`, imageEndpoint + series.poster)
        .catch(e => {
            error("Failed to download series poster: ", imageEndpoint + series.poster, " error: ", e);
        });

        // Download series banner
        downloadFileIfNotExist(`${path}banner${getFileExtension(series.banner)}`, imageEndpoint + series.banner)
        .catch(e => {
            error("Failed to download series banner: ", imageEndpoint + series.banner, " error: ", e);
        }); 

        series.lastUpdated = newTimestamp();
        tvdb.getEpisodesBySeriesId(series.id)
        .then(episodes => {

            var eps: EpisodeMetadata[] = [];
            episodes.forEach(ep => {

                var data: EpisodeMetadata = {
                    id: ep.id,
                    date: ep.firstAired,
                    name: ep.episodeName,
                    thumb: ep.filename,
                    season: ep.airedSeason,
                    episode: ep.airedEpisodeNumber,
                    absEpisode: ep.absoluteNumber,
                    overview: ep.overview,
                    seriesId: ep.seriesId,
                    seriesTitle: series.seriesName
                };

                eps.push(data);

                // Download episode thumbnail
                if (!ep.filename.empty()) {
                    let ext = getFileExtension(ep.filename);
                    let p = `${path}thumb_${ep.id}${ext}`;
                    let l = thumbEndpoint + ep.filename;
                    downloadFileIfNotExist(p, l)
                    .catch(e => {
                        error("Failed to download episode thumbnail: ", l, " error: ", e);
                    });
                }
            });

            series.episodes = eps;

            // Save series data to file
            fs.writeFileSync(`${path}${series.id}.json`, JSON.stringify(series, null, "\t"));
            resolve(`${series.id}`);
        })
        .catch(e => {
            console.log("Failed to retrieve series episodes");
            console.error(e);

            // Save series data to file
            fs.writeFileSync(`${path}${series.id}.json`, JSON.stringify(series));
            resolve(`${series.id}`);
        });
    });
}


//{"id":7754068,"airedSeason":1,"airedSeasonID":1825844,"airedEpisodeNumber":13,"episodeName":"Episode 13","firstAired":"2020-08-10","guestStars":[],"directors":[],"writers":[],"overview":"","language":{"episodeName":"en","overview":"en"},"productionCode":"T56.10113","showUrl":"","lastUpdated":1590621331,"dvdDiscid":"","dvdSeason":1,"dvdEpisodeNumber":13,"dvdChapter":null,"absoluteNumber":13,"filename":"","seriesId":361868,"lastUpdatedBy":1225605,"airsAfterSeason":null,"airsBeforeSeason":null,"airsBeforeEpisode":null,"imdbId":"tt8722888","contentRating":"TV-14","thumbAuthor":null,"thumbAdded":"","thumbWidth":null,"thumbHeight":null,"siteRating":0,"siteRatingCount":0,"isMovie":0} 