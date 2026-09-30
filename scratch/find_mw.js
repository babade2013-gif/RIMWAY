const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

const idx = bundle.indexOf('function mw(');
if (idx !== -1) {
  console.log('Found function mw at', idx);
  console.log(bundle.substring(idx, idx + 2000));
} else {
  // search for mw =
  let i = 0;
  while ((i = bundle.indexOf('mw', i)) !== -1) {
    const snip = bundle.substring(Math.max(0, i - 30), Math.min(bundle.length, i + 80));
    if (snip.includes('maps.googleapis.com')) {
      console.log('Match mw:', snip);
      console.log(bundle.substring(i - 100, i + 1000));
      break;
    }
    i += 2;
  }
}
