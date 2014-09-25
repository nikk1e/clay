var express = require('express');
var join = require('path').join;
var git = require('git-node');
var modes = require('js-git/lib/modes');
//var async = require('async');
var router = express.Router({ mergeParams: true });

var base;

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

		res.render('tree', {title: rawPath, tree: tree, commit: last_commit});
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


router.get('/commits/:branch*', function(req, res, next) {
	//history of commits
});

router.get('/edit/:commit*', function(req, res) { //* is req.params[0]
  if (req.is('json')) {
  	//return raw file
  }
  //TODO: edit model file.
  //unless we are asking for js in which case send the raw
  return res.sendfile('index.html', { root: 'public'});
});

router.post('/edit/:commit*', function(req, res, next) {
	//expect json encoded commit tree
});

module.exports = function(path) {
  base = path;
  return router;
};