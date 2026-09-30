const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

const pos = 492000;
console.log(bundle.substring(pos, pos + 10000));
