
function submitClick(event) {
    event.preventDefault();

    console.log("Event Triggered");

    var data = {};
    data["type"] = document.getElementById("download-form-type-select").value;
    data["url"] = document.getElementById("download-form-url-input").value;

    console.log(JSON.stringify(data));

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status != 200) {
            console.log("Failed to download file");
            return;
        }

        var items = JSON.parse(xhr.response);
        console.log(items);
         
    }.bind(this);
    
    xhr.open('POST', "http://localhost:3000/dl");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));

    return false;
}


window.addEventListener('DOMContentLoaded', (event) => {

    var submitButton = document.getElementById("download-form-submit-button");
    var form = document.getElementById("download-form");
    var typeSelect = document.getElementById("download-form-type-select");

    // typeSelect.addEventListener("change", (event) => {
    // })

    form.addEventListener("submit", submitClick);
});