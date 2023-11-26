import './App.css';
import React, { useState, } from 'react';

import Host from './host';
import Client from './client';

function App() {
  const [host, setHost] = useState(null);

  return (
    <div className="App">
      {!host && <>
        <button onClick={() => setHost('host')}>Host Room</button>
        <button onClick={() => setHost('client')}>Join a Room</button>
      </>}
      {host === 'host' && <Host hosting={true} />}
      {host === 'client' && <Client roomId="test"/>}
    </div>
  );
}

export default App;
