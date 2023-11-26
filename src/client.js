import React, { useState, useEffect } from 'react';

import Connection from './connection';

export default function Client({ roomId }) {
    const [connection, setConnection] = useState(null);
    const [connectionState, setConnectionState] = useState(null);
    const [inputVal, setInput] = useState('');
    const [chat, setChat] = useState([]);

    function tryConnection() {
        let c = new Connection(roomId, (state) => setConnectionState(state), null, (msg) => {setChat(c => [...c, msg])}, false);
        c.offerConnection();
        setConnection(c);
        console.log('init should only occur once');
    }
    useEffect(() => {
        tryConnection();
    }, []);

    useEffect(() => {
        if (connectionState === 'failed') {
            alert('connection failed, retrying');
            tryConnection();
        }
    }, [connectionState]);

    function submit() {
        if (connection && inputVal) {
            connection.send(`[${connection.connection_id}] ${inputVal}`);
            //setChat(c => [...c, inputVal]);
        }
    }

    function disconnect() {
        connection.closeConnection();
        setChat(c => [...c, "You disconnected."]);
    }
    return (
        <div>
            {connectionState === 'connected' &&
            <div>
                Chat:
                {chat.map(c => <p>{c}</p>)}
                <input type="text" onChange={e => setInput(e.target.value)} />
                <button onClick={submit}>Send</button>
                <button onClick={disconnect}>Leave</button>
            </div>}
            {connectionState === 'checking' && <p>Connecting... </p>}
            {(connectionState === 'failed' || connectionState === 'disconnected' || !connectionState) && <div><button onClick={tryConnection}>Reconnect</button></div>}
        </div>
    )
}