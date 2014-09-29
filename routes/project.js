var express = require('express');
var join = require('path').join;
var git = require('git-node');
var modes = require('js-git/lib/modes');
var fsdb = require('git-node-fs/mixins/fs-db');
var createMixin = require('js-git/mixins/create-tree');
var formatsMixin = require('js-git/mixins/formats');
//var async = require('async');
var router = express.Router({ mergeParams: true });

var base;

function file(area, project, hash, path, done) {
	var repo = git.repo(join(base, area, project + '.git'));
	var rawPath = path.join('/');
	
	function loadBlob(hash) {
		repo.loadAs('blob', hash, function(err, blob) {
			if (err) {
				return done(err);
			}
			done(null, blob);
		});
	}

	function loadTree(hash) {
		repo.loadAs('tree', hash, function(err, tree) {
			var dir;
			if (err) {
				return done(err);
			}
			if ((dir = path.pop())) {
				for (var i = tree.length - 1; i >= 0; i--) {
					if (tree[i].name === dir) {
						if (tree[i].mode === modes.tree) {
							return loadTree(tree[i].hash);
						} else if (path.length === 0) {
							return loadBlob(tree[i].hash);
						}
					}
				}
				return done(new Error('File not found ' + rawPath));
			} else {
				return done(new Error('File not found ' + rawPath));
			}
		});
	}

	repo.loadAs('commit', hash, function(err, commit) {
		if (err) {
			return done(err);
		}
		loadTree(commit.tree);
	});
}

function tree(req, res, next) {
	var area = req.params.area;
	var project = req.params.project;
	var repo = git.repo(join(base, area, project + '.git'));
	var rawPath = req.params[0];
	var commit = req.params.commit || 'master';
	var path = rawPath
		.slice(1)
		.split('/')
		.filter(function(p) { return p.length > 0; });
	var last_commit;
	//var files = [];
	//var outstanding = 0;
	//var broken = false;

	path.reverse();

	//function done() { if (!broken) res.send({files:files, path:path}); }
	var baseUrl = '/' + area + '/' + project;

	function done(tree) { 
		tree = tree.map(function(p) {
			var isDir = p.mode === modes.tree;
			return {
				name: p.name,
				isDir: isDir,
				url: baseUrl + (isDir ? '/tree/' : '/edit/') + commit + rawPath + '/' + p.name 
			}
		});

		res.render('tree', {title: area + '/' + project + rawPath, tree: tree, commit: last_commit});
		//res.send({tree: tree, commit: last_commit}); 

	}

	function loadTree(hash) {
		//if (broken) return;
		//outstanding++;
		repo.loadAs('tree', hash, function(err, tree) {
			var dir;
			if (err) {
				//broken = true;
				return next(err);
			}
			//Array.prototype.push.apply(files, tree)
			//files = tree;
			if ((dir = path.pop())) {
				for (var i = tree.length - 1; i >= 0; i--) {
					if (tree[i].name === dir) {
						if (tree[i].mode === modes.tree) {
							return loadTree(tree[i].hash);
						}
					}
				}
				return next(new Error('Directory not found ' + rawPath));
			} else {
				done(tree);
			}
			//
			//outstanding--;
			//if (outstanding <= 0) done();
		});
	}

	function loadCommit(hash) {
		//if (broken) return;
		//outstanding++;
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) {
				//broken = true;
				return next(err);
			}
			last_commit = commit;
			loadTree(commit.tree);
			//if (commit.parents) {
			//	commit.parents.forEach(loadCommit);
			//}
			//outstanding--;
			//if (outstanding <= 0) done();
		});
	}

	loadCommit(commit);
}

router.get('/', function(req, res, next) {
  req.params.commit = 'master';
  req.params[0] = '';
  return tree(req, res, next);
});

router.get('/tree/:commit*', function(req, res, next) { //* is req.params[0]
  return tree(req, res, next);
});


router.get('/log/:branch*', function(req, res, next) {
	//history of commits
});

router.get('/edit/:commit*', function(req, res, next) { //* is req.params[0]
  if (req.xhr) {
  	//return raw file
  	var area = req.params.area;
	var project = req.params.project;
	var commit = req.params.commit || 'master';
	var rawPath = req.params[0];
	var path = rawPath
		.slice(1)
		.split('/')
		.filter(function(p) { return p.length > 0; });

	path.reverse();
  	file(area, project, commit, path, function(err, blob) {
  		if (err) {
  			return next(err);
  		}
  		res.set('Content-Type', 'application/json');
  		return res.send(blob);
  	});
  	return;
  }
  //TODO: edit model file.
  //unless we are asking for js in which case send the raw
  return res.sendfile('edit.html', { root: 'public'});
});

router.post('/edit/:branch*', function(req, res, next) {
	//expect json encoded commit tree
	console.log('save files');
	var body = req.body;
	if (body.length && body.length > 0) {
		var area = req.params.area;
		var project = req.params.project;
		var repo = {};
		var rootPath = join(base, area, project + '.git');
		//console.log(repo.rootPath);
		var rawPath = req.params[0];
		var branch = req.params.branch || 'master';
		var ref = 'refs/heads/' + branch;
		var path = rawPath
			.slice(1)
			.split('/')
			.filter(function(p) { return p.length > 0; });

		fsdb(repo, rootPath);
		createMixin(repo);
		formatsMixin(repo);

		repo.readRef(ref, function(err, head) {
			if (err) return next(err);
			console.log('head:' + head);
			repo.loadAs('commit', head, function(err, commit) {
				if (err) return next(err);
				console.log(commit);
				var entries = body.map(function(file) {
					return { mode: modes.blob,
							 content: JSON.stringify(file),
							 path: file.name + '.cube' };
				});
				entries.base = commit.tree;
				repo.createTree(entries, function(err, tree) {
					if (err) {
						console.log(err);
						return next(err);
					}
					console.log(tree);
					repo.saveAs("commit", {
        				tree: tree,
        				parent: head, //we lose history if we don't set this
        				author: { name: "Unknown Author", 
        						  email: "ims@uss.co.uk" },
        				message: "Auto commit"
      				}, function(err, hash) {
      					if (err) {
      						console.log(err);
      						return next(err);
      					}
      					console.log('newhead:' + hash);
      					//push branch forward to this commit
      					repo.updateRef(ref, hash, function(err) {
      						if (err) return next(err);
      						res.send('Saved files');
      					});
      				});
				});
			});
		});
	} else {
		res.send('No files to save');
	}
	
});

function parallelEach(list, fn, callback) {
  var left = list.length + 1;
  var done = false;
  list.forEach(function (obj) {
    fn(obj, check);
  });
  check();
  function check(err) {
    if (done) return;
    if (err) {
      done = true;
      return callback(err);
    }
    if (--left) return;
    done = true;
    callback();
  }
}



module.exports = function(path) {
  base = path;
  return router;
};