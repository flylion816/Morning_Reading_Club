const bcrypt = require('bcrypt');

async function hash() {
  const hashed = await bcrypt.hash('admin123456', 10);
  console.log(hashed);
}

hash();
