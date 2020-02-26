const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const app = express();

app.set('port', (process.env.PORT || 8080));

app.get('/main.js', (req, res) => {
  res.sendFile(path.resolve('.', 'dist', 'main.js'));
});
app.use(express.static('public'));


const httpsServer = https.createServer({
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/certificate.pem')
  // passphrase: 'YOUR PASSPHRASE HERE'
}, app);

httpsServer.listen(8080, () => { console.log('Listening!') });
