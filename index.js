const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require("body-parser");
var _ = require("underscore");
const cookieParser = require('cookie-parser');
const socketCookieParser = require('socket.io-cookie-parser');


var server = app.listen(port);
var io = require('socket.io').listen(server);

app.use(bodyParser.urlencoded({extended : true}));
app.use('/static', express.static(__dirname + "/public"))

app.use(cookieParser());
io.use(socketCookieParser());

const mysql = require('mysql');

var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'mysql',
    database : 'vchat_db',
    multipleStatements: true
  });
connection.connect();
  
  
app.get('/login', (req, resp) => {
  if(req.cookies.activeUser) {
    resp.redirect('/');
  } else {
    resp.sendFile(__dirname + "/public/pages/login.html")   
  }
});

// check credentials 

app.post('/checkdetails', (req, res) => {
    connection.query("select *from users where email='"+req.body.email+"' and password='"+req.body.password+"';", (error, results, fields) => {
      if(!error) {
        var activeUser = {}; 
        if(user = results[0]) {                 
          var activeUser = {id:user.id, name:user.name, email:user.email};
          res.cookie('activeUser', activeUser, {expire: 360000 + Date.now()});
          res.send({code:200,data:activeUser});
        } else {
          res.clearCookie('activeUser');
          res.send({code:400,data:activeUser});
        }
      } else {
        res.send({code:500,data:error});
      }
    });
});
var user = null;
app.get('/', (req, resp) => {
  if(req.cookies.activeUser) {
    user = req.cookies.activeUser;
    resp.sendFile(__dirname + "/public/pages/index.html")   
  } else {
    resp.redirect('/login')
  }
});


var sql = "SELECT * FROM users WHERE id IN (?); SELECT * FROM chats WHERE sender_id IN (?) && reciever_id IN (?)";

io.on('connection', function(socket) {

  socket.on('letsChat', function(chatData) {
    var senderId = socket.request.cookies.activeUser.id;
    var recieverId = chatData.dataFor.recieverId;
    var contents = chatData.message;
    var insertQuery = "insert into chats (sender_id,reciever_id,contents) values ('"+senderId+"','"+recieverId+"','"+contents+"')";

    connection.query(insertQuery, function(error, results, fields) {
        if (error) {
          io.emit('letsChat', error);
        }
    });
    var paramData = [
      [recieverId, senderId],
      [senderId, recieverId],
      [senderId, recieverId],
    ];
    connection.query(sql, paramData, function(error, results, fields) {
        if (error) {
          io.emit('letsChat', error);
        }
        userFor_ = _.find(results[0], (result) => { return result.id != senderId});
        io.emit('letsChat', {users:results[0], userFor_:userFor_, chats:results[1]});
    });    
  });

});

// mysql datas
app.get('/getAllUsers', (req, res) => {
  
  connection.query("SELECT * from users where id !='"+req.cookies.activeUser.id+"';", function (error, results, fields) {
    if(!error) {
      res.send({activeUser:req.cookies.activeUser, users:results});
    } else {
      res.send(error);
    }
  });
});

app.get('/getchat/:recieverId',(req, res) => {
  var paramData = [
    [req.cookies.activeUser.id, req.params.recieverId],
    [req.cookies.activeUser.id, req.params.recieverId],
    [req.cookies.activeUser.id, req.params.recieverId],
  ];
  connection.query(sql, paramData, function(error, results, fields) {
        if (error) {
          res.send(error);
        }
        res.send({users:results[0], chats:results[1]});
    });
});
