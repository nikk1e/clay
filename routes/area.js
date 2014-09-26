var express = require('express');
var path = require('path');
var fs = require('fs');

var router = express.Router();
var base;

router.get('/', function(req, res, next) {
  fs.readdir(base, function(err, files) {
    if (err) {
      return next(err);
    }
    res.render('index', {files: files, title: "Clay"})
    //res.send(files);
  })
});


router.post('/', function(req, res, next) {
  //TODO: create area
});

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