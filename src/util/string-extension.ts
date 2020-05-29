//////////////////////////////////////////
// Author: Dahmitri Stephenson
// Discord: Jimoori#2006
// Jimbot: Discord Bot
//////////////////////////////////////////

import { log } from "../global.js";

////////////////////////////////////////////////////////////

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

String.prototype.similarity = function (s2: string) {
    var s1 = this;
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (
        (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
    );
}
    
String.prototype.toTitleCase = function (splitter: string) {
    if (!splitter) {
        splitter = " ";
    }
    return this.toLowerCase().split(splitter).map(function(word) {
        if (word.length > 3 || (word.charAt(0) != "o" && word.charAt(0) != "f" && word.charAt(0) != "t"))
            return (word.charAt(0).toUpperCase() + word.slice(1));
        else 
            return word;
    }).join(splitter);
    /*
    return this
        .toLowerCase()
        .split(splitter)
        .map(s => s.charAt(0).toUpperCase() + s.substring(1))
        .join(splitter);
        */
}
    
String.prototype.capitalizeWords = function (splitter: string) {
    if (!splitter) {
        splitter = " ";
    }
    return this.split(splitter).map(function(word) {
        if (word.length > 3 || (word.charAt(0) != "o" && word.charAt(0) != "f" && word.charAt(0) != "t"))
            return (word.charAt(0).toUpperCase() + word.slice(1));
        else 
            return word;
    }).join(splitter);
    /*
    return this
        .toLowerCase()
        .split(splitter)
        .map(s => s.charAt(0).toUpperCase() + s.substring(1))
        .join(splitter);
        */
}
String.prototype.replaceAll = function (search: string, replacement: string): string {
    var target = this;
    return target.replace(new RegExp(search, "g"), replacement);
};
String.prototype.capitalize = function (): string {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
String.prototype.limitTo = function (limit: number): string {
    if (this.length <= limit) {
        return this;
    }
    return this.substring(0, limit) + "...";
};
String.prototype.empty = function (): boolean {
    return this.length === 0 || !/\S/.test(this);
};
String.prototype.indexOfAfter = function (search: string, start: string): number {
    var string = this;
    var preIndex = string.indexOf(start);
    return preIndex + string.substring(preIndex).indexOf(search);
};
String.prototype.indexOfAfterIndex = function (search: string, start: number): number {
    return start + this.substring(start).indexOf(search);
};
String.prototype.matches = function (other) {
    return this === other;
};
String.prototype.closestMatchIn = function (list: string[], threshold: number): string {

    var search = this.toLowerCase();
    var count = list.length;
    var similar = [];

    for (var i = 0; i < count; i++) {

        var txt = list[i].toLowerCase();
        var match = txt.similarity(search);
        log(`Comparing: ${search} -vs- ${txt}, match: ${match}`);
        if (match >= threshold) {
            similar[similar.length] = {
                txt: list[i],
                similarity: match
            };
        }

        if (txt === search) {
            return list[i];
        }
    }

    log("Similar Matches");
    log(similar);
    if (similar.length > 0) {
        var highest = similar.sort((a, b) => {
            return b.similarity - a.similarity;
        })[0];

        // log("Highest");
        // log(highest);

        return highest.txt;
    }

    return "";
}
String.prototype.isNumber = function(): boolean {
    return /^\d+$/.test(this);
}
String.prototype.numberWithCommas = function(): string {
    return this.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

module.exports = String;