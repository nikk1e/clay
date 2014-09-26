function fetchFile(path, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var data = httpRequest.responseText;
                return callback(null, data);
            } else {
                return callback('Could not find file');
            }
        }
    };
    httpRequest.open('GET', path);
    httpRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    httpRequest.send();
}

function fetchJSONFile(path, callback) {
	fetchFile(path, function(err, raw) {
        if (err) {
            return callback(err);
        }
        try {
            var data = JSON.parse(raw);
            callback(null, data);
        } catch (er) {
            callback(er);
        }
		
	});
}
