import React, { useReducer, useState, useEffect } from 'react';
import Connection from './connection';

function reducer(state, action) {
    switch (action.type) {
        case 'add_client': {
            return {
                ...state,
                connections: [...state.connections, {
                    id: action.id,
                    connection: action.client
                }]
            }
        }
        default: return;
    }
}

export default function Host({ hosting, roomId }) {
    const [clients, dispatch] = useReducer(reducer, { connections: [] });
    const [chat, setChat] = useState([]);
    const [chatInput, setInput] = useState('');

    function createClientConnection() {
        const client = new Connection(roomId, (state) => {
            if (state === 'connected') dispatch({ type:'add_client', client:client});
        }, null, (msg) => setChat(c=> [...c, msg]), true);
        client.receiveConnection();
    }
    
    useEffect(() => {
        clients.connections.forEach(c => c.connection.send(chat[chat.length-1]))
    }, [chat]);

    function broadcast() {
        setChat(c => [...c, `[Host] ${chatInput}`]);
    }

    useEffect(() => {
        if (hosting) createClientConnection();
    }, [clients.connections, hosting]);

    return (
        <div>
            {hosting && <>
            {clients.connections.map(c => <p>{c.connection.connection_id}</p>)}
            <br/>Chat: {chat.map(c => <p>{c}</p>)}<br/>
            <input type="text" onChange={e => setInput(e.target.value)}/>
            <button onClick={broadcast}>Broadcast as Host</button></>}
        </div>
    );
}