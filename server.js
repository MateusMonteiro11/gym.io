const express = require('express');
const app = express();

app.set('view engine', 'ejs');
app.set('views', './views/pages');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('home');
});

app.listen(3000, () => {
  console.log('Servidor rodando');
});