//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////


import { log } from "../global.js";
import * as fs from 'fs';
import "../util/string-extension.js";

const filename = './config/config.json';

export class config {
    configuration: any;
    serverSettings: any;
    constructor() {
        this.init();
    }

    init() {
        var data = fs.readFileSync(filename);
        this.configuration = JSON.parse(data.toString());
    }
    save() {
        var newData = JSON.stringify(this.configuration, null, "\t");
        fs.writeFileSync(filename, newData);
    }
    
    reload() {
        var data = fs.readFileSync(filename);
        this.configuration = JSON.parse(data.toString());
    }

    alias() {
        return this.configuration.unitAliases;
    }
    filetypes() {
        return this.configuration.filetypes;
    }

    // COMMAND ALIASES
    getCommandAlias(name: string) {
        name = name.toLowerCase();
        if (!this.configuration.commandAliases || !this.configuration.commandAliases[name])
            return null;
            
        return this.configuration.commandAliases[name];
    }
    setCommandAlias(name: string, command: string) {
        name = name.toLowerCase().replaceAll(" ", "_");

        this.configuration.commandAliases[name] = command;
        this.save();
        return true;
    }

    // SHORTCUTS
    getShortcut(name: string) {
        name = name.toLowerCase();
        if (!this.configuration.shortcuts || !this.configuration.shortcuts[name])
            return null;
            
        return this.configuration.shortcuts[name];
    }
    setShortcut(name: string, command: string) {
        name = name.toLowerCase();

        if (!this.configuration[`shortcuts`]) {
            this.configuration[`shortcuts`] = {}
        }

        this.configuration.shortcuts[name] = command;
        this.save();
        return true;
    }

    getEmbedTemplate() {
        return this.configuration.embed;
    }

    getDownloadLocation(): string {
        return this.configuration.drive;
    }

};

export const Config = new config();