var express = require('express');
var join = require('path').join;
//var git = require('git-node');
var modes = require('js-git/lib/modes');
var fsdb = require('git-node-fs/mixins/fs-db');
var createMixin = require('js-git/mixins/create-tree');
var formatsMixin = require('js-git/mixins/formats');
var passport = require('passport');
var access = require('access-check');
//var async = require('async');
var router = express.Router({ mergeParams: true });
var moment = require('moment');

var base;
var users = {};

function file(req, branch, path, next) {
	var repo = openRepo(req);

	var rawPath = path.join('/');
	
	branchOrCommit(repo, branch, function(err, commit) {
		if (err) return next(err);
		loadFile(repo, commit.tree, path, function(err, hash) {
			if (err) return next("File not found: " + rawPath);
			loadBlob(repo, hash, next);
		});
	})
}

function openRepo(req) {
	var area = req.params.area;
	var base_path;
	if (/^\~/.test(area)) {
		area = area.slice(1);
		base_path = join(base, 'users');
	} else {
		base_path = join(base, 'areas');
	}
	
	var rootPath = join(base_path, area, req.params.project + '.git');

	var repo = {};

	fsdb(repo, rootPath);

	return repo;
}

function history(req, branch, limit, next) {
	var repo = openRepo(req);

	limit = limit||20;
	var commits = [];
	var baseUrl = '/' + req.params.area + '/' + req.params.project + '/';

	function traverseHistory(hash) {
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) {
				if (commits.length > 0) return next(null, commits)
				return next(err);
			}
			if (commit === undefined) return next("Commit not found");
			commits.push({
				url: baseUrl + hash + '/',
				hash: hash,
				when: moment(commit.author.date.seconds * 1000, "x"),
				commiter: commit.commiter,
				author: commit.author,
				message: commit.message,
			});
			if (commits.length >= limit) return next(null, commits);
			var parents = commit.parents;
			if (!(parents && parents.length > 0)) return next(null, commits);
			traverseHistory(parents[0]);
		});
	}

	branchOrTag(repo, branch, function(err, hash) {
		if (err) return next(err);
		traverseHistory(hash);
	});
}

function tree(req, res, next) {
	var branch = req.params.branch || req.params.commit || 'master';
	branch = branch.replace(/^~/, ''); //remove leading ~ when we match with branch with command
	
	var repo = openRepo(req);

	var rawPath = req.params.path || req.params[0] || '/';
	var path = rawPath
		.slice(1)
		.split('/')
		.filter(function(p) { return p.length > 0; });
	var urlPath = path.join('/');
	var project = req.params.project;
	var baseUrl = '/' + req.params.area + '/' + project + '/';
	var historyUrl = baseUrl + branch + '/history';

	function done(tree, commit) { 
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
		res.render('tree', {title: req.params.area + '/' + project + (urlPath ? '/' + urlPath : ''), tree: treeM, commit: commit, historyUrl: historyUrl});
	}

	branchOrCommit(repo, branch, function(err, commit) {
		if (err) return next(err);
		loadTree(repo, commit.tree, path, function(err, tree) {
			if (err) return next("Directory not found: " + rawPath);
			done(tree, commit);
		});
	});
}

function loadBlob(repo, hash, next) {
	repo.loadAs('blob', hash, function(err, blob) {
		if (err) return next(err);
		next(null, blob);
	});
}

function loadTree(repo, hash, path, next) {
	repo.loadAs('tree', hash, function(err, tree) {
		var dir;
		if (err) {
			return next(err);
		}
		if ((dir = path.shift())) {
			for (var i = tree.length - 1; i >= 0; i--) {
				if (tree[i].name === dir) {
					if (tree[i].mode === modes.tree) {
						return loadTree(repo, tree[i].hash, path, next);
					}
				}
			}
			return next(new Error('Directory not found '));
		} else {
			next(null, tree);
		}
	});
}

function loadFile(repo, hash, path, next) {
	console.log('loading commit: '  + hash);
	repo.loadAs('tree', hash, function(err, tree) {
		var dir;
		if (err) return next(err);
		if ((dir = path.shift()) && tree[dir]) {
			if (tree[dir].mode === modes.tree) {
				return loadFile(repo, tree[dir].hash, path, next);
			} else if (path.length === 0) {
				return next(null, tree[dir].hash);
			}
			return next(new Error('File not found '));
		} else {
			return next(new Error('File not found '));
		}
	});
}

function branchOrCommit(repo, branch, next) {

	function loadCommit(hash) {
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) return next(err);
			if (commit === undefined) return next("Commit not found");
			next(null, commit);
		});
	}

	branchOrTag(repo, branch, function(err, hash) {
		if (err) return next(err);
		loadCommit(hash);
	});
}

//will return a hash if given a commit
function branchOrTag(repo, branch, next) {

	function loadCommit(hash) {
		repo.loadAs('commit', hash, function(err, commit) {
			if (err) return next(err);
			if (commit === undefined) return next("Commit not found");
			next(null, commit);
		});
	}

	function loadTag(tag) {
		var ref = 'refs/tags/' + tag;
		repo.readRef(ref, function(err, hash) {
			if (err) return next(err);
			if (hash === undefined) return next(null, tag);
			next(null, hash);
		});
	}

	var ref = 'refs/heads/' + branch;
	console.log('loading branch ref: '  + ref);
	repo.readRef(ref, function(err, hash) {
		if (err) return next(err);
		if (hash === undefined) return loadTag(branch);
		next(null, hash);
	});
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
  	file(req, commit, path, function(err, blob) {
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

router.get('/:branch/history/:limit?', function(req, res, next) {
	var branchR = req.params.branch || req.params.commit;
	var branch = branchR || 'master';
	branch = branch.replace(/^~/, ''); //remove leading ~ when we match with branch with command
	
	var area = req.params.area;
	var project = req.params.project;	
	var limit = parseInt(req.params.limit || 20);

	var title = area + '/' + project + (branchR ? '/' + branchR : '')
	history(req, branch, limit+1, function(err, commits) {
		if (err) return next(err);

		var nextCommit = undefined;
		if(commits.length == limit+1) nextCommit = commits.pop();

		res.render('history', {	commits: commits,
								title: title,
								limit: limit,									
								nextCommit: nextCommit,	
								limit:limit,						 
								errors: []})
	});
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



router.post('/:branch*', passport.authenticate('WindowsAuthentication'), function(req, res, next) {
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

		//Test if the user has permissions to update the repo
		access.checkDirectoryPermissions(req.user.id, rootPath.replace(/\\/g,'/'), function(pErr, pOut){
			console.log('Is repo writable: ' + pOut.isWritable);

			if(!pOut.isWritable) { 
				res.send("User doesn't have permission to save"); 
			} else {
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
		        				author: {	name: req.user.id, 
		        							email: req.user.email },
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

			}
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
