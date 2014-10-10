var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var passport = require('passport');

//Config
function userEmail(user) {
    return user.id + '@uss.co.uk';
}

var base = process.env.DATAPATH || path.join(__dirname, 'app_data');

var area_root = process.env.AREAORORG || 'areas'; //organisations
//END Config

var base_users = path.join(base, 'users');
var base_areas = path.join(base, 'areas');

//create data dir if missing
function mkdirSafe(dirname) {
    try {
        fs.mkdirSync(dirname);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
}

mkdirSafe(base);
mkdirSafe(base_areas);
mkdirSafe(base_users);


//data
var tungus = require('tungus');
var mongoose = require('mongoose')
var Schema = mongoose.Schema;


mongoose.connect('tingodb://'+base+'/database', function (err) {
  // if we failed to connect, abort
  if (err) throw err;

  // we connected ok
  //createData();
});

var users = {};

//TODO: move into another file
var npath = path;
var modes = require('js-git/lib/modes');
var fsdb = require('git-node-fs/mixins/fs-db');
var createMixin = require('js-git/mixins/create-tree');
var formatsMixin = require('js-git/mixins/formats');
function createRepo(gitpath, username, email, entries, next) {
  var repo = {};
  fsdb(repo, gitpath);
  createMixin(repo);
  formatsMixin(repo);
  repo.init(null, function(err) {
    if (err) return next(err);
    repo.createTree(entries, function(err, tree) {
      if (err) {
        return next(err);
      }
      repo.saveAs("commit", {
            tree: tree,
            author: { name: username, 
                  email: email },
            message: "Created " + username
        }, function(err, hash) {
            if (err) {
              return next(err);
            }
            //push branch forward to this commit
            repo.updateRef('refs/heads/master', hash, function(err) {
              if (err) return next(err);
              next(null, hash);
            });
        });
    });
  });
}

var WindowsAuthentication = require('passport-windowsauth');
passport.use(new WindowsAuthentication(function(profile, done) {
    var user = users[profile.id];
    if (!user) {
        profile.email = userEmail(profile);
        user =  profile;
        var repoPath = path.join(base_users, profile.id, 'welcome.git');
        if (!fs.existsSync(repoPath)) {
            //create repo for user if it doesn't exist
            //TODO: add Learn/Answers/Getting+Started.cube.
            createRepo(repoPath, profile.name, profile.email, [
            { mode: modes.blob,
               content: '{"cells":[{"key":0,"level":1,"text":"Readme\\n","type":"header"},{"key":2,"spans":[{"type":"text","text":"Welcome to your new Cube project.\\n"}],"type":"p"},{"key":3,"lang":"cube","text":"1 + 2 + 3\\n","tokens":[],"sexpr":[["Plus",["Plus",["Number",1],["Number",2]],["Number",3]]],"type":"code"}],"namespace":"Readme","name":"Readme","seed":4,"modified":false,"_dirty":false}',
               path: 'Readme.cube' },
            { mode: modes.blob,
               content: '{"_default":"read","' + profile.id + '":"admin"}',
               path: '.permssions' }
            ], function(err, hash) {
                if (err) return done(err);
                done(null, user);
            });
        } else {
            done(null, user);
        }
    }
  }
));
//try catch (use non windows login stuff)

passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
});

passport.deserializeUser(function(user, done) {
    done(null, JSON.parse(user));
});

var project = require('./routes/project')(base);
var area = require('./routes/area')(base);

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(require('stylus').middleware(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname,'public')));

app.get('/profile', passport.authenticate('WindowsAuthentication'),
  function (req, res){
    res.json(req.user);
});

app.get('/login', function(req, res, next) {
  passport.authenticate('WindowsAuthentication', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) { return res.render('login',{}); } //show login form if not windows authenticated
    req.login(user, function(err) {
      if (err) { return next(err); }
      return res.redirect('/~' + user.name);
    });
  })(req, res, next);
});

//TODO: app.post('/login', function()) //authenticate locally
//TODO: authenticate/register with Google/Twitter/Facebook

app.use('/:area/:project', project);
app.use('/', area);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
	console.log('Server listening on port' + server.address().port); 
});

module.exports = app;