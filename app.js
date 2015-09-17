var config = require('./config.js');

var masterToken = config.masterToken;
var targetUser = config.targetUser; // Chris Atkins

var foursqconfig = {
  'secrets' : {
    'clientId' : config.foursquare.clientId,
    'clientSecret' : config.foursquare.clientSecret,
    'redirectUrl' : config.foursquare.redirectUrl
  }
};

var express = require('express');
var routes = require('./routes');
// var user = require('./routes/user');
var http = require('http');
var https = require('https');
var path = require('path');
var foursquare = require('node-foursquare')(foursqconfig);
var app = express();
var mongo = require('mongodb');

app.configure(function(){
  app.set('port', process.env.PORT || process.env.VCAP_APP_PORT || 5000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/atkins_army';

app.get('/', routes.index);
app.get('/login', function(req, res) {
  res.writeHead(303, { 'location': foursquare.getAuthClientRedirectUrl() });
  res.end();
});
app.get('/callback/:service', function (req, res) {
  if (req.params.service == "foursquare") {
    foursquare.getAccessToken({
      code: req.query.code
    }, function (error, accessToken) {
      if (error) {
        res.send('An error was thrown: ' + error.message);
      }
      else {
        mongo.Db.connect(mongoUri, function (err, db) {
          db.collection('tokens', function(err, collection) {
            collection.insert(accessToken, {safe:true}, function(err, result) {
              res.send("token: " + accessToken);
              // db.close();
            });
          });
        });
        // db.collection('tokens', function(err, collection) {
        //   collection.insert(accessToken, {safe:true}, function(err, result) {
        //     res.send("token: " + accessToken);
        //     db.close();
        //   });
        // });
      }
    });
  }
});
app.get('/tokens', function(req, res) {
  res.send("tokens list here");
});

function moveArmy() {
  console.log("Moving the army!");
}

function checkTarget() {
  foursquare.Users.getUser(targetUser, masterToken, function(err, results) {
    var latest_checkin = results.user.checkins.items[0];
    mongo.Db.connect(mongoUri, function (err, db) {
      db.collection('checkins', function(err, collection) {
        collection.findOne({id: latest_checkin.id}, function(err, result) {
          if (result) {
            console.log("no new checkins!");
          } else {
            console.log("new checkin at: " + latest_checkin.venue.name);
            collection.insert(latest_checkin, {safe:true}, function(err, result) {
              if (!err) {
                moveArmy();
              }
            });
          }
        });
      });
    });
    // db.collection('checkins', function(err, collection) {
    //   collection.findOne({id: latest_checkin.id}, function(err, result) {
    //     if (result) {
    //       console.log("no new checkins!");
    //       db.close();
    //     } else {
    //       console.log("new checkin at: " + latest_checkin.venue.name);
    //       collection.insert(latest_checkin, {safe:true}, function(err, result) {
    //         if (!err) {
    //           moveArmy();
    //         }
    //         db.close();
    //       });
    //     }
    //   });
    // });
  });
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Foursquare Shadow awaiting orders...");
  setInterval(checkTarget, 300000);
  checkTarget();
});
