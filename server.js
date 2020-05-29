
const express = require('express');
const app = express();

var io = require('socket.io')
({
  path: '/webrtc'
})

app.use(express.static(__dirname+'/build'))
app.get('/', function(req, res){
    //res.sendFile(__dirname+'/build/index.html')
    res.send("hello")
})

const port = process.env.port || 4000;
const server = app.listen(port, function(){
    console.log('server listening to port : 4000')
})

io.listen(server);

const connectedPeers = new Map();

const peers = io.of('/webrtcPeer');

peers.on('connection', function(socket){
    console.log('socket connection established', socket.id)
    connectedPeers.set(socket.id, socket);
    peers.emit('peer-joined', Object.keys(peers.clients().sockets));

    socket.on('disconnect', function(){
        console.log('client disconnected', socket.id)
        connectedPeers.delete(socket.id);
    })

    socket.on('signal', function({from, to, payload}){
        console.log(from, to, payload);
        socket.to(to).emit('signal', {from, to, payload});
    })

    socket.on('candidate', function(data){
        //console.log(data.from, data.payload.type, data.to);
        socket.to(data.to).emit('candidate', data.from, data.payload);
    })
})
