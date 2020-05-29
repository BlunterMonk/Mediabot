declare interface String {
    similarity (s2: string): any;
    toTitleCase (splitter: string): string;
    replaceAll (search: string, replacement: string): string;
    capitalize (): string
    capitalizeWords (splitter: string): string
    limitTo (limit: number): string;
    empty (): boolean;
    indexOfAfter (search: string, start: string): number;
    indexOfAfterIndex (search: string, start: number): number;
    matches (other: string): boolean;
    closestMatchIn (list: string[], threshold: number): string;
    isNumber(): boolean;
    numberWithCommas(): string;
}

declare function log(data: any);
declare function checkString(text: string, keyword: RegExp): boolean;
declare function compareStrings(text: string, search: string): boolean;
declare function escapeString(s: string): string;
