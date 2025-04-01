import React, { useState } from 'react';

function App() {
  const [message, setMessage] = useState('');

  const getMessageFromBackend = async () => {
    try {
      const response = await fetch('http://localhost:3001');
      const text = await response.text();
      setMessage(text);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>React + Node Basic Skeleton</h1>
      <button onClick={getMessageFromBackend}>
        Get Backend Message
      </button>
      <p>{message}</p>
    </div>
  );
}

export default App;
