import React, { Component } from 'react';

import io from 'socket.io-client'

class App extends Component {
  constructor(props) {
    super(props)

    // https://reactjs.org/docs/refs-and-the-dom.html
    this.localVideoref = React.createRef()
    this.remoteVideorefs = [];

    this.socket = null
    this.candidates = []
    this.connectedPeers = new Map();

    this.state = {
      receivingCall: false,
      inCall: false,
      remoteVideoStreams: []
    }
  }

  componentDidMount() {

    this.socket = io(
      '/webrtcPeer',
      {
        path: '/webrtc',
        query: {}
      }
    )

    const pc_config = {
      "iceServers": [
        // {
        //   urls: 'stun:[STUN_IP]:[PORT]',
        //   'credentials': '[YOR CREDENTIALS]',
        //   'username': '[USERNAME]'
        // },
        {
          urls : 'stun:stun.l.google.com:19302'
        }
      ]
    }

    this.socket.on('connection-success', success => {
      console.log(success)
    })

    this.socket.on('peer-joined', (peers)=>{
      console.log('new peer joined')
      peers.forEach(peer=>{
        if(!this.connectedPeers[peer] && peer!==this.socket.id){
          const newPeer = new RTCPeerConnection(pc_config);

          newPeer.onicecandidate = (e) => {
            if (e.candidate) {
              this.sendToPeer(peer, 'candidate', e.candidate)
            }
          }

          newPeer.oniceconnectionstatechange = (e) => {
            console.log(e)
          }

          newPeer.onaddstream = (e) => {
            console.log('addstream event')
            const videoStreams = this.state.remoteVideoStreams;
            videoStreams.push({id: peer, video: React.createRef()});
            this.setState({remoteVideoStreams: videoStreams});
            videoStreams[videoStreams.length-1].video.current.srcObject = e.stream;
            this.setState({remoteVideoStreams: videoStreams});
          }

          this.connectedPeers.set(peer, newPeer);
        }
      })
    })

    this.socket.on('signal', ({from, to, payload}) => {
      this.connectedPeers.get(from).setRemoteDescription(payload)
      console.log(from, to, payload)
      if(payload.type==='offer')
      this.setState({
        receivingCall: true,
        callerID: from
      });
    })

    this.socket.on('candidate', (id, candidate) => {
      this.connectedPeers.get(id).addIceCandidate(new RTCIceCandidate(candidate))
    })
  }

    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)

  sendToPeer = (id, messageType, payload) => {
    this.socket.emit(messageType, {
      to: id,
      from: this.socket.id,
      payload
    })
  }
/*
  mediaConstraint = {
    audio: true,
    video: {
      width: "320",
      height: "240",
    }
  }
  */

  basicConstraint = {
    audio: true,
    video: true
  }

  /* ACTION METHODS FROM THE BUTTONS ON SCREEN */

  createOffer = () => {
    console.log('Offer')
    navigator.mediaDevices.getUserMedia(this.basicConstraint)
      .then((stream) => {
        this.localVideoref.current.srcObject = stream;
        this.connectedPeers.forEach((peer, id) => stream.getTracks().forEach(track =>peer.addTrack(track, stream)));
      })
      .then(()=>{
        for( const [peerID, peer] of this.connectedPeers.entries()) {
          peer
            .createOffer()
            .then(sdp => {
              // console.log(JSON.stringify(sdp))
              // set offer sdp as local description
              return peer.setLocalDescription(sdp)
            })
            .then(()=>this.sendToPeer(peerID, 'signal', peer.localDescription))
        }
      })
      .catch(e => console.log('getUserMedia Error: ', e))
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer
  // creates an SDP answer to an offer received from remote peer
  createAnswer = (id) => {
    console.log('Answer')
    const peer = this.connectedPeers.get(id);
    
    navigator.mediaDevices.getUserMedia(this.basicConstraint)
    .then((stream) => {
      
      this.localVideoref.current.srcObject = stream;
      stream.getTracks().forEach(track =>peer.addTrack(track, stream))
    })
    .then(()=>peer.createAnswer())
    .then(sdp => {
      // set answer sdp as local description
      return peer.setLocalDescription(sdp)
    })
    .then(()=>this.sendToPeer(id, 'signal', peer.localDescription))
    .catch(e => console.log('getUserMedia Error: ', e))
  }

  render() {
    let callPanel = null;
    if(this.state.receivingCall===false && this.state.inCall===false)
      callPanel = <button onClick={this.createOffer}>Offer</button>
    else if(this.state.receivingCall)
      callPanel = <button id={this.state.callerID} onClick={()=>this.createAnswer(this.state.callerID)}>Answer</button>

    return (
      <div>
        <video
          style={{
            width: 350,
            height: 350,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.localVideoref }
          autoPlay
          muted>
        </video>
        <h3>streams: {this.state.remoteVideoStreams.length}</h3>
        {
          
          callPanel
          
        }
        <hr />
        {/*
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.remoteVideoref }
          autoPlay>
        </video>
       
        <textarea style={{ width: 450, height:40 }} ref={ref => { this.textref = ref }} />
          */
          this.state.remoteVideoStreams.map((item, index) => 
          <div>
            <label htmlFor={item.id}>{item.id}</label>
            <video 
              ref={item.video} 
              key={index} 
              id={item.id} 
              style={{
              width: 350,
              height: 350,
              margin: 5,
              backgroundColor: 'black'
              }}
              autoPlay
            />
          </div>
          )
          //this.state.remoteVideoStreams.map((item, index) => console.log(item.id))
        }
      </div>
    )
  }
}

export default App;