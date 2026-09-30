const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

const idx = bundle.indexOf('function bf(');
if (idx !== -1) {
  console.log('Found function bf at', idx);
  console.log(bundle.substring(idx, idx + 4000));
} else {
  // search for bf =
  console.log('Searching for other declarations of bf...');
  let i = 0;
  while ((i = bundle.indexOf('bf', i)) !== -1) {
    const snip = bundle.substring(Math.max(0, i - 50), Math.min(bundle.length, i + 100));
    if (snip.includes('initialCenter') || snip.includes('initialZoom')) {
      console.log('Match:', snip);
      const start = Math.max(0, i - 200);
      console.log(bundle.substring(start, start + 3000));
      break;
    }
    i += 2;
  }
}
