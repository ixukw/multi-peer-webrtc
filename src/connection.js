import * as Ably from 'ably';
import { v4 as uuid } from 'uuid';

export default function Connection(room, setConState, ablyConnection, onMessage, isHost) {
    const iceServers = { urls: "stun:stun.l.google.com:19302" };
    const channelName = room;
    const ably = ablyConnection ? ablyConnection : new Ably.Realtime.Promise(process.env.REACT_APP_ABLY_SECRET_KEY);

    let channel;
    let pc; 
    
    let connection_id = uuid();
    let dc;

    // Connect to signaling server
    async function connectSignaling() {
        if (ably.connection === 'connected') return;
        await ably.connection.once('connected').catch(handleError);
        
        channel = ably.channels.get(channelName);
        log('Connected to Ably!');
    }

    function dcInit() {
        dc.onopen = () => {};
        dc.onmessage = e => {
            log(e.data);
            onMessage(e.data);
        }
        dc.onclose = () => log("datachannel closed");
    }
    async function handleNegotiation() {
        log("negotation needed");
        try {
            const offer = await pc.createOffer();
            if (pc.signalingState !== 'stable') return;
            await pc.setLocalDescription(offer);
            await channel.publish(`offer-${connection_id}`, {
                description: offer,
                id: connection_id
            });
        } catch (err) { handleError(err) };
    }
    async function createConnection() {
        pc = new RTCPeerConnection({ iceServers: [iceServers] });

        // event handlers
        pc.onicecandidate = async (e) => {
            if (e.candidate) {
                log("sending ice");
                await channel.publish(`offer-ice-${connection_id}`, { fromHost: isHost, candidate: e.candidate });
            }
        };
        pc.oniceconnectionstatechange = () => {
            log('iceConnectionState: ' + pc.iceConnectionState);
            setConState(pc.iceConnectionState);
            switch (pc.iceConnectionState) {
                case 'completed':
                case 'connected':
                    onMessage(`${connection_id} joined.`);
                    break;
                case 'closed': break;
                case 'failed': break;
                case 'disconnected':
                    onMessage(`${connection_id} disconnected.`);
                    closeConnection();
                    break;
                default: break;
            }
        };
        pc.onicegatheringstatechange = () => {

        };
        pc.onconnectionstatechange = () => {
        //    log(pc.connectionState);
        //    setConState(pc.connectionState);
        };
        pc.onnegotiationneeded = handleNegotiation;
        
        

        // Fires when remote peer adds data channel to pc 
        pc.ondatachannel = (event) => {
            dcInit(dc = event.channel);
        };

        await connectSignaling();

        // receive ice candidates from remote peer
        channel.subscribe(`offer-ice-${connection_id}`, async (msg) => {
            if (msg.data.fromHost === isHost) return;
            log("recv ice");
            await pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate)).catch(handleError);
        });
    }

    async function receiveConnection() {
        if (!pc) await createConnection();

        // on receiving an offer, create a new pc and return answer
        channel.subscribe('offer', handleReceiveOffer);
    }

    async function handleReceiveOffer(msg) {
        log('recv offer');
        const desc = new RTCSessionDescription(msg.data.description);

        if (pc.signalingState !== 'stable') {
            log('offer received but signal state not stable, rollback');
            await Promise.all([
                pc.setLocalDescription({type: 'rollback'}),
                pc.setRemoteDescription(desc)
            ]);
            return;
        } else {
            await pc.setRemoteDescription(desc);
        }

        await pc.setLocalDescription(await pc.createAnswer());
        await channel.publish(`answer-${msg.data.id}`, { answer: pc.localDescription, id: connection_id });

        //id = msg.data.id;
        
        channel.subscribe(`offer-${connection_id}`, handleReceiveOffer);
        try {
            channel.unsubscribe('offer')
        } catch(err) { console.log(err) };
    }

    async function offerConnection() {
        await createConnection();

        // create and send offer
        dcInit(dc = pc.createDataChannel('chat'));
        const desc = await pc.createOffer();
        pc.setLocalDescription(desc);
        await channel.publish('offer', {
            description: desc,
            id: connection_id
        });
        log('sent offer');

        // receive answer
        channel.subscribe(`answer-${connection_id}`, handleAnswer);
    }

    async function handleAnswer(msg) {
        if (pc.signalingState === "have-local-offer") {
            log('got answer');
            const ans = new RTCSessionDescription(msg.data.answer);
            await pc.setRemoteDescription(ans).catch(handleError);
        }
        // change the client ID to be server given id
        channel.unsubscribe(`answer-${connection_id}`)
        channel.subscribe(`answer-${msg.data.id}`, handleAnswer);
        connection_id = msg.data.id;
    }

    function closeConnection() {
        if (pc) {
            pc.onicecandidate = null;
            pc.oniceconnectionstatechange = null;
            pc.onsignalingstatechange = null;
            pc.onicegatheringstatechange = null;
            pc.onnegotiationneeded = null;
            pc.ondatachannel = null;

            pc.close();
            pc = null;

            channel.detach();
            ably.close();
            setConState(null);
        }
    }

    function send(msg) {
        if (!dc) { log("dc is null"); return; }
        dc.send(msg);
    }

    function log(msg) {
        var time = new Date();
        console.trace(`[${time.toLocaleTimeString()}] ${msg}`);
    }
    function handleError(err) {
        console.trace(err);
    }

    return { receiveConnection, offerConnection, closeConnection, send, connection_id, dc };
}