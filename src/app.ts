import * as http from "http";
import * as fs from "fs";
import { log, error, debug, trace } from "./global.js";

log("Mediabot Started");

http.createServer(function(request, response) {
    fs.readFile("./public/index.html", function(err, data){
        if (err) {
            log(err);
            return;
        }

        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(data);
        response.end();
    });
}).listen(3000);