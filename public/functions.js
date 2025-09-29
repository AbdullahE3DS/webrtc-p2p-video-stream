const ws = new WebSocket(`wss://${location.host}`);

const streamBtn = document.getElementById('stream-btn');
const playBtn = document.getElementById('play-btn');

const optionsContainer = document.getElementById('options-container');
const inputContainer = document.getElementById('input-container');
const videoContainer = document.getElementById('video-container');

const videoInput = document.getElementById('video-input');

const streamerVideo = document.getElementById('streamer-video');

const stopStreamBtn = document.getElementById('stop-stream-btn');
const muteAudioBtn = document.getElementById('mute-audio-btn');

let pc = null;
let stream = null;

let nRetry = 0;
let config = null;

const configs = [
    {},
    {iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]},
    {iceServers: [{ urls: 'stun:stun.l.google.com:19302' },]},
];


function createPeerConnection(){
    pc = new RTCPeerConnection(configs[2]);

    pc.addEventListener('icecandidate', ({candidate}) => {
        if(candidate){
            ws.send(JSON.stringify({type: 'candidate', candidate}));
        }
    });

    pc.addEventListener('connectionstatechange', () => {
        console.log(`pc.connectionState: ${pc.connectionState}`);
        switch(pc.connectionState){
            case 'connected':
                console.log("CONNECTED");
                break;

            case 'completed':
                console.log("COMPLETED");
                break;

            case 'failed':
                console.log("FAILED")
                break;

            case 'disconnected':
                console.log("DISCONNECTED");
                break;
            default:
                break;
        }
    })

    pc.addEventListener('iceconnectionstatechange', async () => {
        console.log(`pc.icestate: ${pc.iceConnectionState}`);
        switch(pc.iceConnectionState){
            case 'connected':
                const stats = await pc.getStats();
                for(const report of stats.values()){
                    console.table(report);
                    // if(report.type === 'candidate-pair' && report.selected){
                    //     console.log(stats.get(report.localCandidateID));
                    //     console.log(`remote id: ${stats.get(report.remoteCandidateId)}`);
                    // }
                }
                console.log("ICE CONNECTED");

                break;
            case 'disconnected':
                console.log("ICE DISCONNECTED");
                break;

            case 'failed':
                console.log("ICE FAILED")
                makeOffer();
                break;

            default:
                break;
        }
    });
}

async function sendStream(offer){
    if(!pc){
        createPeerConnection();
    }

    stream.getTracks().forEach(track => {
        console.log("**** TRACK ADDED *****");
        pc.addTrack(track, stream);
    });

    pc.addTransceiver('video', { direction: 'sendonly' });
    pc.addTransceiver('audio', { direction: 'sendonly' });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer({restartIce: true});
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({type: 'answer', answer}));
}

// retry with STUN/TURN if HOST/STUN fails
async function makeOffer(){
    nRetry++;
    console.log(`nRetry: ${nRetry}`);
    const config = nRetry > 2 ? configs[2] : configs[nRetry];


    console.log(`config: ${config}`);
    console.table(config);

    pc.setConfiguration(config);
    const offer = await pc.createOffer({restartIce: true});
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({type: 'offer', offer}));
}

async function playerRenegotiate(){
    const config = nRetry > 2 ? configs[2] : configs[nRetry];
    nRetry++;
    pc.setConfiguration(config);
    try {
        const offer = pc.createOffer({restartIce: true});
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({type: 'offer', offer}));
    } catch(c) {
        console.log("RENEGOTIATION FAILED");
    }
}

async function requestStream(){
    createPeerConnection();

    const remoteStream = new MediaStream();
    streamerVideo.srcObject = remoteStream;

    pc.addEventListener('track', (event) => {
        ws.send(JSON.stringify({type: 'track'}));
        console.log(">>> TRACK RECEIVED <<<<");
        remoteStream.addTrack(event.track);
    });

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({type: 'offer', offer}));
    } catch(e) {
        console.log('FAILED TO OFFER')
    }
}

function stopStream(){
    // stopStreamerStream();
    // stopPlayerStream();
}


ws.addEventListener('message', async (message) =>{
    const data = JSON.parse(message.data instanceof Blob ? await message.data.text() : message.data);

    if(!pc){
        createPeerConnection();
    }

    switch (data.type) {
        case 'candidate':
            if(data.candidate){
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
            
        case 'offer':
            console.log("OFFER RECEIVED")
            if(stream){
                console.log('SENDING STREAM')
                sendStream(data.offer);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer({restartIce: true});
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({type: 'answer', answer}));
            }
            break;
    
        case 'answer':
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;

        case 'bye':
            closePeerConnection();
            break;

        case 'track':
            console.log('>>> TRACK RECEIVED <<<');
            break;

        default:
            console.log("ERROR! DATA TYPE IS NOT UNDERSTOOD");
            break;
    }
});


streamBtn.addEventListener('click', () => {
    optionsContainer.style.display = "none";
    inputContainer.style.display = "block";
    videoContainer.style.display = "none";
    streamerVideo.style.display = 'none';
});

playBtn.addEventListener('click', () => {
    optionsContainer.style.display = "none";
    inputContainer.style.display = "none";
    videoContainer.style.display = "flex";
    streamerVideo.style.display = 'block';

    requestStream();
});

videoInput.addEventListener('change', async () => {
    optionsContainer.style.display = "none";
    inputContainer.style.display = "none";
    videoContainer.style.display = "flex";
    streamerVideo.style.display = "block";

    const file = videoInput.files[0];
    if(file){
        const url = URL.createObjectURL(file);
        streamerVideo.src = url;
    }

    await streamerVideo.play();
    if(streamerVideo.mozCaptureStream){
        stream = streamerVideo.mozCaptureStream();
    } else {
        stream = streamerVideo.captureStream();
    }

});

stopStreamBtn.addEventListener('click', () => {
    optionsContainer.style.display = "block";
    inputContainer.style.display = "none";
    videoContainer.style.display = "none";
    streamerVideo.style.display = "none";
    playerVideo.style.display = "none";

    ws.send(JSON.stringify({type: 'bye'}));
    stopStream();
});

muteAudioBtn.addEventListener('click', () => {
    streamerVideo.muted = !streamerVideo.muted;
    muteAudioBtn.classList.toggle('muted');
});

document.addEventListener('keydown', (event) =>{
    if(event.key.toLowerCase() === 'f'){
        toggleFS();
    }
});


function toggleFS(){
    if(!document.fullscreenElement){
        if(streamerVideo.style.display === 'block'){
            streamerVideo.requestFullscreen();
        } else if(playerVideo.style.display === 'block') {
            playerVideo.requestFullscreen();
        }
    } else {
        if(document.exitFullscreen){
            document.exitFullscreen();
        } else if(document.mozCancelFullscreen) {
            document.mozCancelFullscreen();
        }
    }
}

window.addEventListener('beforeunload', () => {
    console.log("closing peer connection...");
    closePeerConnection();
});

function closePeerConnection(){
    ws.send(JSON.stringify({type: 'bye'}));
    if(!pc){
        return;
    }

    if(pc.signalingState === 'closed'){
        pc = null;
        return;
    }

    pc.getSenders().forEach(sender => {
        if(sender.track){
            sender.track.stop();
        }
    });

    pc.getReceivers().forEach(receiver => {
        if(receiver.track){
            receiver.track.stop();
        }
    });

    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;

    pc.close();
    pc = null;

    console.log("peer closed");
    console.log("peer: ", pc);
}
