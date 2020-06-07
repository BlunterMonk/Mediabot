String.prototype.setTokens = function (replacePairs) {
    var str = this.toString(), key, re;
    for (key in replacePairs) {
        if (replacePairs.hasOwnProperty(key)) {
            re = new RegExp('\{' + key + '\}', 'g');
            str = str.replace(re, replacePairs[key]);
        }
    }
    return str;
};


const rssItemLandscapeTemp = `
<div class="feed-item row">
    <div class="feed-item-thumb">
        <img src="{thumb}" width="100%" height="auto" />
    </div>
    <div class="feed-item-info">
        <div class="feed-item-title">
            <h4>{seriesTitle} - S{season}E{episode}</h4>
        </div>
        <div class="feed-item-episode-title">
            <h4>{episodeTitle}</h4>
        </div>
        <div class="feed-item-text">
            {overview}
        </div>
    </div>
</div>`

class Feed {
    constructor(element, document) {
        this.$element  = $(element);
        this.$document = $(document);
        this.$parent   = element.parent();

        if (!(this.$element.attr('type') === 'file')) {
            this._log('The input "type" must be set to "file" for initializing the "bootstrap-fileinput" plugin.');
            return;
        }
    }

    _log(msg) {
        window.console.log(msg);
    }
    Init() {
        // this.$element.html("<p>Loaded</p>");

        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status != 200) {
                this._log("Failed to get RSS information");
                return;
            }

            var items = JSON.parse(xhr.response);
            this._log("Loaded RSS Data");
            this._log(items);

            let html = "";
            let keys = Object.keys(items);
            keys.sort((a, b) => {
                let ad = new Date(a.date).valueOf() / 1000;
                let bd = new Date(b.date).valueOf() / 1000;

                if (b.timestamp === a.timestamp) {
                    return bd > ad;
                }

                return b.timestamp > a.timestamp
            });
            keys.forEach(key => {
                let ep = items[key];
                let i = rssItemLandscapeTemp.setTokens({
                    "seriesTitle": ep.seriesTitle,
                    "episodeTitle": ep.name,
                    "overview": ep.overview,
                    "episode": (parseInt(ep.episode) < 10) ? `0${ep.episode}` : ep.episode,
                    "season": (parseInt(ep.season) < 10) ? `0${ep.season}` : ep.season,
                    "thumb": ep.thumb
                });

                html += i + "<br />\n";
            });
            
            this.$element.html(html);
        }.bind(this);
        
        xhr.open('GET', "http://192.168.99.102:3000/rss");
        xhr.send(null);
    }
}

/**
 * Convert automatically file inputs with class 'file' into a bootstrap fileinput control.
 */
$(document).ready(function () {
    var $input = $('.feed');
    var feed = new Feed($input, document);
    feed.Init();
});