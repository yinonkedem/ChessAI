const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/', (req, res) => {
  res.send('Hello from Node backend!');
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
