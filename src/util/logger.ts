//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import * as fs from "fs";
import * as winston from "winston";

const { combine, timestamp, metadata, json, printf } = winston.format;
const configFile = './config/config.json';
 
export const defaultFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
});
export const jsonWithTimestamp = combine(
    timestamp(),
    json()
); 

class Logger {
    logger: winston.Logger;
    constructor() {
        let config = JSON.parse(fs.readFileSync(configFile).toString());
    
        this.init(config.name, config.logLevel);
    }

    init(name: string, level: string) {
        var options = {
            level: level,
            // format: winston.format.json(),
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
                defaultFormat
            ),
            exitOnError: false,
            transports: [
                //
                // - Write to all logs with level `info` and below to `combined.log` 
                // - Write all logs error (and below) to `error.log`.
                //
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        defaultFormat
                    )
                }),
                new winston.transports.File({ filename: `./log/${name}.err.log`, level: 'error' }),
                new winston.transports.File({ filename: `./log/${name}.out.log` })
            ],
        }

        this.logger = winston.createLogger(options);
    }

    info(data: string) {
        this.logger.info(data);
    }
    debug(data: string) {
        this.logger.debug(data);
    }
    warn(data: string) {
        this.logger.warn(data);
    }
    silly(data: string) {
        this.logger.silly(data);
    }
    error(data: string) {
        this.logger.error(data);
    }
    trace(data: string) {
        this.silly(data);
    }
}

export const logger: Logger = new Logger();
