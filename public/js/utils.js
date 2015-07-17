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

function saveFiles(path, data, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var data = httpRequest.responseText;
                return callback(null, data);
            } else {
                return callback('Could not save files');
            }
        }
    };
    httpRequest.open('POST', path);
    httpRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    httpRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    httpRequest.send(data);
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

//JSONP get function that cleans up after itself
(function(base) {

    var JSONp = {};

    var scripts = {};

    var sym = 0;

    function removeScript(name) {
        var head = document.getElementsByTagName("head")[0];
        var script = scripts[name];
        if (script) head.removeChild(script);
        delete JSONp[name];
    }

    JSONp.get = function(url, data, options) {
        var callback_name = 'callback_' + (sym++);
        var on_success = options.onSuccess || function(){};
        var on_timeout = options.onTimeout || function(){};
        var on_error = options.onError || function(){};
        var timeout = options.timeout || 30; // sec

        data = data || {};
        data['callback'] = 'JSONp.' + callback_name;

        var query = [];
        for (var key in data) {
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
        }
        var src = url + '?' + query.join('&');

        var timeout_trigger = window.setTimeout(function(){
            removeScript(callback_name);
            on_timeout();
        }, timeout * 1000);

        JSONp[callback_name] = function(data){
            window.clearTimeout(timeout_trigger);
            removeScript(callback_name);
            on_success(data);
        };

        var error_procedure = function(data) {
            window.clearTimeout(timeout_trigger);
            removeScript(callback_name);
            on_error();
        };

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = src;
        script.onerror = error_procedure;       

        document.getElementsByTagName('head')[0].appendChild(script);
    };

    base.JSONp = JSONp;
}(this || (typeof window !== 'undefined' ? window : global)))