var express = require('express');
var path = require('path');
var router = express.Router({ mergeParams: true });

function tree(req, res) {
	return res.send(req.params);
}

router.get('/', function(req, res) {
  req.params.commit = 'master';
  req.params[0] = '';
  return tree(req, res);
});

router.get('/tree/:commit*', function(req, res) { //* is req.params[0]
  return tree(req, res);
});

router.get('/edit/:commit*', function(req, res) { //* is req.params[0]
  if (req.is('json')) {
  	//return raw file
  }
  //TODO: edit model file.
  //unless we are asking for js in which case send the raw
  return res.sendfile('index.html', { root: 'public'});
});

router.post('/edit/:commit*', function(req, res) {
	//expect json encoded commit tree
});

module.exports = router;