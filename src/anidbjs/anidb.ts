import got from 'got';
import util from 'util';
const parseString = util.promisify(require('xml2js').parseString);
import { Mapper } from './mappings';
import { HttpError } from './errors/httpError';

export class AniDB {
  queryParams: any;
  opts: any;
  /**
   * Creates a new AniDB client instance
   *
   * @param {Object} credentials - AniDB HTTP API credentials
   * @param {string} credentials.client - The client string
   * @param {string} credentials.version - The version number
   * @param {Object} options - Library specific options, such as timeout and proxy
   * @param {string} options.baseUrl - AniDB HTTP API base URL
   * @param {string} options.timeout - Request timeout in milliseconds
   * @param {string} options.agent - An HTTP(s) agent
   * @param {Object} options.headers - Additional HTTP headers
   */
  constructor(credentials, options) {
    if (credentials.client === undefined || credentials.version === undefined) {
      throw new Error(
        'A client string and a version number have to be passed to the AniDB constructor.',
      );
    }

    const defaultOptions = {
      baseUrl: 'http://api.anidb.net:9001/httpapi',
      timeout: 5000,
      headers: {
        'user-agent': 'anidbjs/2.4.0',
      },
    };

    this.opts = got.mergeOptions(got.defaults.options, { ...defaultOptions, ...options });
    this.queryParams = {
      client: credentials.client,
      clientver: credentials.version,
      protover: 1,
    };
  }

  /**
   * Set new opts
   *
   * @param {object} proxy Got options object
   */
  set options(opts) {
    this.opts = got.mergeOptions(this.options, opts);
  }

  /**
   * The request function, sends a GET request to AniDB
   * @param {object} params - URL query parameters
   * @returns {object} XML response string
   */
  async request(params) {
    const errors = {
      500: '<error code="500">banned</error>',
      404: '<error>Anime not found</error>',
      302: '<error code="302">client version missing or invalid</error>',
      998: '<error>aid Missing or Invalid</error>',
    };

    try {
      const res = await got(
        '/',
        got.mergeOptions(this.opts, {
          query: {
            ...this.queryParams,
            ...params,
          },
        }),
      );

      for (const e in errors) {
        if (res.body.match(errors[e])) {
          throw new HttpError('AniDB returned an error.', e);
        }
      }

      return res.body;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Get an anime by ID
   *
   * @param {number} id The anime ID
   */
  async anime(id) {
    const params = {
      request: 'anime',
      aid: id,
    };

    try {
      return Mapper.mapAnime(
        await parseString(await this.request(params), {
          explicitRoot: false,
          explicitArray: false,
        }),
      );
    } catch (err) {
      throw err;
    }
  }

  /**
   * Random recommendation request, returns 10 random anime
   */
  async randomRecommendation() {
    const params = {
      request: 'randomrecommendation',
    };

    try {
      return (await parseString(await this.request(params), {
        explicitRoot: false,
        explicitArray: false,
      })).recommendation.map(val => Mapper.mapAnime(val.anime));
    } catch (err) {
      throw err;
    }
  }
}

export interface seriesMetadata {
  id: number;
  ageRestricted: boolean;
  type: string;
  episodeCount: number;
  startDate: string;
  endDate: string;
  picture: string;
  description: string;
  url: string;

  titles: rawTitles[];
  characters: Character[];
  episodes: Episode[];

  // unused
  ratings: {permanent:any,temporary:any,review:any}
  similar: any[];
  related: any[];
  recommendations: any[];
  creators: any[];
  resources: any[];
  tags: any[];
}

export interface Episode {
  id: number;
  updatedAt: string;
  episodeNumber: string;
  type: number;
  length: number;
  airDate: string;
  rating: number;
  votes: number;
  titles: rawTitles[],
  summary: string;
}

export interface Character {
  id: number;
  type: string;
  updatedAt: string;
  rating: any;
  votes: any;
  name: string;
  gender: string;
  characterType: {"id": number,"name": string};
  picture: string;
  seiyuu: {"id": number,"picture":string,"name":string}[]
}

export interface rawTitles {
  title:string;
  language:string;
  type:string
}
