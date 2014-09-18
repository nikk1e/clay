express = require('express');
app = module.exports = express();

app.use(express.static(__dirname));

app.listen(3000, function() { console.log('Server listening on port 3000'); });