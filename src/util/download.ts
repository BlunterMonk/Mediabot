//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import { log, error } from "../global.js";

////////////////////////////////////////////////////////////

export interface downloadOptions {
    title: string; // title from rss feed entry
    filename: string; // destination file name 
    source: string; // source URL of the file 
    magnet?: string; // if present, uses the magnet link to download the file
    destination: string; // destination file path
}

// Returns file extension including .
export function getFileExtension(path: string): string {
    return path.substring(path.lastIndexOf("."), path.length);
}
export function getFilePath(filename: string): string {
    let last = filename.lastIndexOf("\\");
    if (last < 0)
        last = filename.lastIndexOf("/");
    return filename.slice(0, last + 1);
}
export function getFilename(path: string): string {
    return path.replace(/^.*[\\\/]/, '');
}

export function downloadFile(path, link): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        
        var file = null;
        var source = link.slice(0, 5) === 'https' ? https : http;
        source.get(link, function(response) {
            if (response.statusCode !== 200) {
                log("page not found");
                reject(Error("page not found"));
                return;
            }

            file = fs.createWriteStream(path);
            file.on('error', function(e) {
                error(`Error while downloading file: ${path}, " from: ", ${link}`, " error: ", e.message);
                reject(`Failed to download file: ${link}, error: ${e.message}`);
            });

            file.on('finish', function() {
                log(`file downloaded: ${path}`);
                resolve(path);
            });
            return response.pipe(file);
        });
    });
}
export function downloadFileWithProxy(path, link): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        
        var file = null;
        var options = {
            host: "197.245.217.85",
            port: 8080,
            path: link,
            headers: {
              Host: link
            }
        };
        var source = link.slice(0, 5) === 'https' ? https : http;
        source.get(options, function(response) {
            if (response.statusCode !== 200) {
                log("page not found");
                reject(Error("page not found"));
                return;
            }

            file = fs.createWriteStream(path);
            file.on('error', function(e) {
                error(`Error while downloading file: ${path}, " from: ", ${link}`, " error: ", e.message);
                reject(`Failed to download file: ${link}, error: ${e.message}`);
            });

            file.on('finish', function() {
                log(`file downloaded: ${path}`);
                resolve(path);
            });
            return response.pipe(file);
        });
    });
}

export function downloadFileIfNotExist(path, link): Promise<string> {
    
    if (fs.existsSync(path))
        return Promise.resolve(path);

    let p = path.slice(0, path.lastIndexOf("/"));
    if (!fs.existsSync(p)) {
        log("Creating directory: ", p);
        fs.mkdirSync(p, { recursive: true });
    }

    return downloadFile(path, link);
}

export async function downloadBulkFiles(path: string, bulk: downloadOptions[]): Promise<string[]> {
    if (path[path.length-1] != "/")
        path = path + "/";

    let downloads: Promise<string>[] = await bulk.map(options => {
        return new Promise<string>((resolve, reject) => {
            downloadFile(path, options.source)
            .then(resolve)
            .catch(e => {
                error("Failed to download file: ", e);
                resolve(null);
            });
        });
    });

    return Promise.all(downloads);
}