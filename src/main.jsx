import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```
4. Click **Commit changes**

---

**Last step — Rename your existing file**

Your file is currently called `Theatre4u-v3.jsx` but it needs to be called `App.jsx` and it needs to live inside the `src/` folder.

1. Click on `Theatre4u-v3.jsx` in your file list
2. Click the **pencil icon** to edit
3. At the top you'll see the filename in an editable box — clear it and type: `src/App.jsx`
4. Click **Commit changes**

---

**Your file list should now look like this:**
```
📁 src
    📄 App.jsx
    📄 main.jsx
📄 index.html
📄 package.json
📄 vite.config.js
📄 README.md
