var express = require('express');
var path = require('path');
var npath = path;
var fs = require('fs');

var router = express.Router();
var base;

function index(res, next, errors) {
  fs.readdir(base, function(err, files) {
    if (err) {
      return next(err);
    }
    res.render('index', {files: files, title: "Clay", errors: errors || []});
    //res.send(files);
  })
}

router.route('/')
.get(function(req, res, next) {
  return index(res, next);
})
.post(function(req, res, next) {
  var area = req.body.area || '';
  if (!(/^[A-Za-z]{1,25}$/.test(area))) {
    return index(res, next, [{level: 'error', text: 'Area name must be letters only an upto 25 characters long not: ' + area}]);
  }
  mkdirp(path.join(base, area), function(err) {
    if (err) {
      return index(res, next, [{level: 'error', text: 'Could not create area because: ' + err.toString()}]);
    }
    res.redirect(area);
  });
});

function mkdirp(path, callback) {
  fs.mkdir(path, function (err) {
    if (err) {
      if (err.code === "ENOENT") {
        return mkdirp(npath.dirname(path), function (err) {
          if (err) return callback(err);
          fs.mkdir(path, function (err) {
            if (err && err.code !== "EEXIST") return callback(err);
            return callback();
          });
        });
      }
      if (err.code === "EEXIST") return callback();
      return callback(err);
    }
    callback();
  });
}

router.get('/:area', function(req, res, next) {
  var area = req.params.area;
  var baseUrl = '/'+ area + '/';
  var dir = path.join(base, area);
  fs.readdir(dir, function(err, files) {
    if (err) {
      return next(err);
    }
    files = files.map(function(f) { 
      var name = f.replace(/\.git$/,'');
      return {name: name, url: baseUrl + name };

    });
    res.render('area', {files: files, title: area})
  })
});

router.post('/:area', function(req, res, next) {
  //TODO: create project
});

module.exports = function(path) {
  base = path;
  return router;
};