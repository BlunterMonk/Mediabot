//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "./string-extension.js";
import * as https from "https";
const Danbooru = require("danbooru");
const booru = new Danbooru();

const minsim = 80;
const MASK = 8589938016;
const API = "bffc8b115d84e25337a8cea7dd431002e9a263dd";
const URL = `https://saucenao.com/search.php`;
const PIXIV_INDEX = 5;
const DANBOORU_INDEX = 9;

interface BooruPost {
    id: number;
    created_at: string;
    source: string;
    pixiv_id: number;
    
    image_width: number;
    image_height: number;
    file_size: number;

    tag_string: string;
    tag_count_general: number;
    tag_count_artist: number;
    tag_count_character: number;
    tag_count_copyright: number;

    tag_string_general: string;
    tag_string_character: string;
    tag_string_copyright: string;
    tag_string_artist: string;

    file_url: string;
    large_file_url: string;
}

export function searchSource(imgurl: string): Promise<any> {
    var url = `${URL}?api_key=${API}&url=${imgurl}&output_type=2`;
    //&numres=1&minsim=${minsim}!&dbmask=${MASK}&api_key=${API}`;

    return new Promise<any>((resolve, reject) => {
        https.get(url, function(res) {
            
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on('end', function() {
                
                let data = JSON.parse(body);
                parseResults(data.results)
                .then(parsed => {
                    resolve(parsed);
                })
                .catch(reject);
            });
        }).on('error', function(e) {
            reject(e.message);
        });
    });
}

export function parseResults(result: any): Promise<any> {
    
    return new Promise<any>(async (resolve, reject) => {
        var parsed = {
            characters: null,
            creator: null,
            danbooru_id: null,
            gelbooru_id: null,
            pixiv_id: null,
            material: null,
            title: null,
            member_name: null,
            booru: null,
            source: null,
            urls: []
        };

        // list of source indeces that have been claimed.
        // this is to prevent multiple matches from the same database.
        let claimed: any = [];

        for (let index = 0; index < result.length; index++) {
            const source = result[index];
            const header = source.header;
            const data = source.data;

            if (parseFloat(header.similarity) > 85 && !claimed.includes(header.index_id)) {

                parsed.pixiv_id    = (!parsed.pixiv_id && data.pixiv_id) ? data.pixiv_id : parsed.pixiv_id;
                parsed.danbooru_id = (!parsed.danbooru_id && data.danbooru_id) ? data.danbooru_id : parsed.danbooru_id;
                parsed.gelbooru_id = (!parsed.gelbooru_id && data.gelbooru_id) ? data.gelbooru_id : parsed.gelbooru_id;
                parsed.creator     = (!parsed.creator && data.creator) ? data.creator : parsed.creator;
                parsed.material    = (!parsed.material && data.material) ? data.material : parsed.material;
                parsed.characters  = (!parsed.characters && data.characters) ? data.characters : parsed.characters;
                parsed.title       = (!parsed.title && data.title) ? data.title : parsed.title;
                parsed.member_name = (!parsed.member_name && data.member_name) ? data.member_name : parsed.member_name;
                parsed.source      = (!parsed.source && data.source) ? data.source : parsed.source;
                parsed.urls        = parsed.urls.concat(data.ext_urls);

                // Retrieve Danbooru data
                if (header.index_id == DANBOORU_INDEX && data.danbooru_id) {
                    var p = JSON.stringify(await booru.posts(data.danbooru_id));
                    var post: BooruPost = JSON.parse(p);
                    parsed.booru = post;
                }
                if (parsed.source && parsed.source.includes("twitter")) {
                    parsed.urls.push(parsed.source);   
                }

                claimed.push(header.index_id);
            }
        }

        resolve(parsed);
    });
}