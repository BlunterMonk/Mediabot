//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import "../util/string-extension.js";

////////////////////////////////////////////////////////////

export interface SearchInfo {
    title: string; // series title
    season: number; // episode season
    episode: number; // episode number
};

export interface EpisodeMetadata {
    id: string; // episode ID
    name: string; // episode name
    date: string; // date aired
    thumb: string; // thumbnail filename
    season: number; // season number
    episode: number; // episode number
    overview: string; // Detailed episode overview
    seriesId: string; // ID of series
    seriesTitle: string; // Series Title

    oldFile?: string; // original file location before sorting
    newFile?: string; // new file location after sorting
    sourceUrl?: string;
};

export interface SeriesMetadata {
    // Identifiers
    id: number; // TVDB series ID
    aliases: string[]; // Alternate Series Titles
    seriesName: string; // Series Title
    
    startDate: string; // Date series started airing 
    endDate: string; // Date series has ended
    network: string; // Series network source
    overview: string; // Detailed description of series
    slug: string; // series search keyword
    status: string; // Series airing status

    // image paths
    image: string;
    banner: string;
    poster: string;

    // Added info through caching
    episodes?: EpisodeMetadata[]; // list of episodes
}
