const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3000/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: "hola" })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
