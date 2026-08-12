import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Ignore specific chrome extension exceptions from popping up on React Developer overlay
window.addEventListener('error', (e) => {
  const isExtensionError = e.message?.includes('M_ID') || 
                           e.filename?.includes('chrome-extension') || 
                           e.error?.stack?.includes('chrome-extension');
  if (isExtensionError) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);
window.addEventListener('unhandledrejection', (e) => {
  const reasonMsg = e.reason?.message || '';
  const reasonStack = e.reason?.stack || '';
  if (reasonMsg.includes('M_ID') || reasonStack.includes('chrome-extension')) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
