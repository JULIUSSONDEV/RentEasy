const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`RentEasy server running on http://localhost:${PORT}`);
});
