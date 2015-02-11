var express = require('express');
var join = require('path').join;
//var git = require('git-node');
var modes = require('js-git/lib/modes');
var fsdb = require('git-node-fs/mixins/fs-db');
var createMixin = require('js-git/mixins/create-tree');
var formatsMixin = require('js-git/mixins/formats');
//var async = require('async');
var router = express.Router({ mergeParams: true });

var base;

/*router.param(function(name, fn){
  if (fn instanceof RegExp) {
    return function(req, res, next, val){
      var captures;
      if (captures = fn.exec(String(val))) {
        req.params[name] = captures;
        next();
      } else {
        next('route');
      }
    }
  }
})
*/
function file(area, project, branch, path, done) {
	var base_path;
	if (/^\~/.test(area)) {
		area = area.slice(1);
		base_path = join(base, 'users');
	} else {
		base_path = join(base, 'areas');
	}
	var rootPath = join(base_path, area, project + '.git');
	console.log(rootPath)
	var repo = {};
	var rawPath = path.join('/');

	fsdb(repo, rootPath);
	
	function loadBlob(hash) {
		repo.loadAs('blob', hash, function(err, blob) {
			if (err) return done(err);
			done(null, blob);
		});
	}

	function loadTree(hash) {
		console.log('loading commit: '  + hash);
		repo.loadAs('tree', hash, function(err, tree) {
			var dir;
			if (err) return done(err);
			if ((dir = path.shift()) && tree[dir]) {
				if (tree[dir].mode === modes.tree) {
					return loadTree(tree[dir].hash);
				} else if (path.length === 0) {
					return loadBlob(tree[dir].hash);
				}
				return done(new Error('File not found ' + rawPath));
			} else {
				return done(new Error('File not found ' + rawPath));
			}
		});
	}

	function loadCommit(hash) {
		console.log('loading commit: '  + hash);
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) {
				return next(err);
			}
			last_commit = commit;
			loadTree(commit.tree);
		});
	}

	function loadTag(tag) {
		var ref = 'refs/tags/' + tag;
		repo.readRef(ref, function(err, hash) {
			if (err || hash === undefined) return loadCommit(tag);
			loadCommit(hash);
		});
	}

	function loadBranch(branch) {
		var ref = 'refs/heads/' + branch;
		console.log('loading branch ref: '  + ref);
		repo.readRef(ref, function(err, hash) {
			if (err || hash === undefined) return loadTag(branch);
			loadCommit(hash);
		});
	}

	loadBranch(branch);
}


function history(req, res, next) {
}

function tree(req, res, next) {
	var area = req.params.area;
	var base_path;
	if (/^\~/.test(area)) {
		area = area.slice(1);
		base_path = join(base, 'users');
	} else {
		base_path = join(base, 'areas');
	}
	var project = req.params.project;
	var rootPath = join(base_path, area, project + '.git');
	var repo = {};
	var rawPath = req.params.path || req.params[0] || '/';
	var branch = req.params.branch || req.params.commit || 'master';
	branch = branch.replace(/^~/, ''); //remove leading ~ when we match with branch with command
	var path = rawPath
		.slice(1)
		.split('/')
		.filter(function(p) { return p.length > 0; });
	var last_commit;
	var urlPath = path.join('/');

	fsdb(repo, rootPath);

	var baseUrl = '/' + req.params.area + '/' + project + '/';

	function done(tree) { 
		var treeM = [];
		for (var name in tree) {
			if (/^\./.test(name)) continue;
			if (!tree.hasOwnProperty(name)) continue;
			var stats = tree[name];
			var isDir = stats.mode === modes.tree;
			treeM.push({
				name: name,
				isDir: isDir,
				url: baseUrl + branch + urlPath + '/' + (isDir ? name + '/' : name.replace(/.cube$/,''))
			});
		}
		res.render('tree', {title: area + '/' + project + (urlPath ? '/' + urlPath : ''), tree: treeM, commit: last_commit});
	}

	function loadTree(hash) {
		repo.loadAs('tree', hash, function(err, tree) {
			var dir;
			if (err) {
				return next(err);
			}
			if ((dir = path.shift())) {
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
		});
	}

	function loadCommit(hash) {
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) {
				return next(err);
			}
			if (commit === undefined) return next("Commit not found");
			last_commit = commit;
			loadTree(commit.tree);
		});
	}

	function loadTag(tag) {
		var ref = 'refs/tags/' + tag;
		repo.readRef(ref, function(err, hash) {
			if (err) return next(err);
			if (hash === undefined) return loadCommit(tag);
			loadCommit(hash);
		});
	}

	function loadBranch(branch) {
		var ref = 'refs/heads/' + branch;
		console.log('loading branch ref: '  + ref);
		repo.readRef(ref, function(err, hash) {
			if (err) return next(err);
			if (hash === undefined) return loadTag(branch);
			loadCommit(hash);
		});
	}

	loadBranch(branch);
}

//router.param('branch', /^\w+$/);

router.get('/:branch/*.csv', function(req, res, next) {
	res.send('I am csv for ' + req.params[0]);
});

router.get('/:branch/*.pdf', function(req, res, next) {
	res.send('I am pdf for ' + req.params[0]);
});

router.get('/:branch/*.json', function(req, res, next) {
	res.send('I am json for ' + req.params[0]);
});

router.get('/:branch/*.cube', function(req, res, next) {
  	//return raw file
  	var area = req.params.area;
	var project = req.params.project;
	var commit = req.params.branch || 'master';
	var rawPath = req.params[0] + '.cube';
	var path = rawPath
		.split('/')
		.filter(function(p) { return p.length > 0; });
	commit = commit.replace(/^~/, ''); //remove leading ~ when we match with branch with command
  	file(area, project, commit, path, function(err, blob) {
  		if (err) {
  			return next(err);
  		}
  		res.set('Content-Type', 'application/json');
  		return res.send(blob);
  	});
});

router.get('/:branch/*.xslx', function(req, res, next) {
	res.send('I am xslx for ' + req.params[0]);
});

router.get('/:branch*',function(req, res, next) {
	var ps = req.params;
	req.params.path = req.params[0] || '';
	if (/^$|\/$/.test(ps.path)) {

		//res.send('I am a direcory listing for ' + JSON.stringify(ps));
		tree(req, res, next);
	} else {
		//TODO: make this render a file with the JSON already loaded
		//and the HTML rendered (for SEO and old browsers)
		res.sendfile('edit.html', { root: 'public'});
	}
});

router.get('/:branch/history', function(req, res, next) {
	history(req, res, next);
});

router.post('/:branch*', function(req, res, next) {
	//expect json encoded commit tree
	console.log('save files');
	var body = req.body;
	if (body.length && body.length > 0) {
		var area = req.params.area;
		var base_path;
		if (/^\~/.test(area)) {
			area = area.slice(1);
			base_path = join(base, 'users');
		} else {
			base_path = join(base, 'areas');
		}
		var project = req.params.project;
		var repo = {};
		var rootPath = join(base_path, area, project + '.git');
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
		console.log(ref)
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

router.get('/',function(req, res, next) {
	req.params.branch = 'master';
	req.params.path = ''; //trailing slash needed for directory listing
	tree(req, res, next);
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