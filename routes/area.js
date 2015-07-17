var express = require('express');
var path = require('path');
var npath = path;
var fs = require('fs');
var modes = require('js-git/lib/modes');
var fsdb = require('git-node-fs/mixins/fs-db');
var createMixin = require('js-git/mixins/create-tree');
var formatsMixin = require('js-git/mixins/formats');
var passport = require('passport');

var router = express.Router();
var base;

function index(res, next, errors) {
  fs.readdir(path.join(base, 'areas'), function(err, files) {
    if (err) {
      return next(err);
    }
    res.render('index', {files: files, title: "Qube", errors: errors || []});
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
  mkdirp(path.join(base, 'areas', area), function(err) {
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

router.route('/:area')
.get(function(req, res, next) {
  var area = req.params.area;
  var base_path;
  if (/^\~/.test(area)) {
    area = area.slice(1);
    base_path = path.join(base, 'users');
  } else {
    base_path = path.join(base, 'areas');
  }
  var baseUrl = '/'+ req.params.area + '/';
  var dir = path.join(base_path, area);
  fs.readdir(dir, function(err, files) {
    if (err) {
      return next(err);
    }
    files = files.map(function(f) { 
      var name = f.replace(/\.git$/,'');
      return {name: name, url: baseUrl + name };

    });
    res.render('area', {files: files, title: area, errors: []})
  })
})
.post(passport.authenticate('WindowsAuthentication'), function(req, res, next) {
  var area = req.params.area;
  var base_path;
  if (/^\~/.test(area)) {
    area = area.slice(1);
    base_path = path.join(base, 'users');
  } else {
    base_path = path.join(base, 'areas');
  }
  var baseUrl = '/'+ area + '/';
  var dir = path.join(base_path, area);
  var name = req.body.name;
  var gitpath = path.join(dir, name + '.git');
  console.log('Repo Path: ' + gitpath);
  var repo = {};
  fsdb(repo, gitpath);
  createMixin(repo);
  formatsMixin(repo);
  repo.init(null, function(err) {
    if (err) return next(err);
    var entries = [{ mode: modes.blob,
               content: '{"cells":[{"key":0,"level":1,"text":"Readme\\n","type":"header"},{"key":2,"spans":[{"type":"text","text":"Welcome to your new Cube project.\\n"}],"type":"p"},{"key":3,"lang":"cube","text":"1 + 2 + 3\\n","tokens":[],"sexpr":[["Plus",["Plus",["Number",1],["Number",2]],["Number",3]]],"type":"code"}],"namespace":"Readme","name":"Readme","seed":4,"modified":false,"_dirty":false}',
               path: 'Readme.cube' }];
    repo.createTree(entries, function(err, tree) {
      if (err) {
        console.log(err);
        return next(err);
      }
      console.log(tree);

      repo.saveAs("commit", {
            tree: tree,
            author: { name: req.user.name, 
                  email: req.user.email },
            message: "Created " + name
          }, function(err, hash) {
            if (err) {
              console.log(err);
              return next(err);
            }
            console.log('newhead:' + hash);
            //push branch forward to this commit
            repo.updateRef('refs/heads/master', hash, function(err) {
              if (err) return next(err);
              res.redirect(baseUrl + name)
            });
          });
    });
  });
});

module.exports = function(path) {
  base = path;
  return router;
};