import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { overflow: hidden; }`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
