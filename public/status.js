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

function displayStatus() {
    if (!!window.EventSource) {
        var source = new EventSource('/stats')
    
        source.addEventListener('message', function(e) {
          document.getElementById('data').innerHTML = e.data;
          console.log(e.data);
        }, false)
    
        source.addEventListener('open', function(e) {
          document.getElementById('state').innerHTML = "Connected"
        }, false)
    
        source.addEventListener('error', function(e) {
            const id_state = document.getElementById('state')
            if (e.eventPhase == EventSource.CLOSED)
                source.close()
            if (e.target.readyState == EventSource.CLOSED) {
                id_state.innerHTML = "Disconnected"
            } else if (e.target.readyState == EventSource.CONNECTING) {
                id_state.innerHTML = "Connecting..."
            }
        }, false)

    } else {
        console.log("Your browser doesn't support SSE")
    }
}

const fileStatusTemp = `
<div class="file-preview-frame">
    <div class="file-preview-id" id="progress-{fileid}">#{fileid}</div>
    <div class="file-preview-progress">
        <div class="progress">
            <div id="progressbar-{fileid}" class="progress-bar" role="progressbar" style="width: {progress}%;" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
            </div>
        </div>
        <span id="progresstext-{fileid}" class="file-preview-progress-text">
            {filename}
        </span>
    </div>
    <div class="file-preview-upload-percent" id="progresspercent-{fileid}">{progress}%</div>
</div>`;

class Status {
    constructor(element, document) {
        this.$element  = $(element);
        this.$document = $(document);
        this.$parent   = element.parent();
    }

    _log(msg) {
        window.console.log(msg);
    }
    Init() {
        console.log("Status Page Init, beginning stream");
        this.startStream();
    }

    startStream() {
        var self = this;
        if (!!window.EventSource) {
            var source = new EventSource('/stats')
        
            source.addEventListener('message', function(e) {
                let data = JSON.parse(e.data);
                console.log(data);
                
                let html = "";
                let keys = Object.keys(data);
                keys.forEach(key => {
                    var p = data[key];
                    var stat = fileStatusTemp.setTokens({
                        "fileid": key,
                        "filename": (p.metadata) ? p.metadata.name : "",
                        "progress": p.progress
                    });
                    html += stat + "\n";
                });
                self.$element.html(html);
            }, false)
        
            source.addEventListener('open', function(e) {
              document.getElementById('state').innerHTML = "Connected"
            }, false)
        
            source.addEventListener('error', function(e) {
                const id_state = document.getElementById('state')
                if (e.eventPhase == EventSource.CLOSED)
                    source.close()
                if (e.target.readyState == EventSource.CLOSED) {
                    id_state.innerHTML = "Disconnected"
                } else if (e.target.readyState == EventSource.CONNECTING) {
                    id_state.innerHTML = "Connecting..."
                }
            }, false)
    
        } else {
            console.log("Your browser doesn't support SSE")
        }     
    }
    
}

$(document).ready(function () {
    var $input = $('.file-preview-container');
    var status = new Status($input, document);
    status.Init();
});