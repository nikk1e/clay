function fetchFile(path, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var data = httpRequest.responseText;
                if (callback) callback(data);
            }
        }
    };
    httpRequest.open('GET', path);
    httpRequest.send();
};

function fetchJSONFile(path, callback) {
	fetchFile(path, function(raw) {
		var data = JSON.parse(raw);
		if (callback) callback(data);
	})
}
