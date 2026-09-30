const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

// Search for the main render switch where `r ===` is evaluated
const pos = bundle.indexOf('r==="overview"');
if (pos !== -1) {
  console.log('Found r==="overview" at pos:', pos);
  console.log(bundle.substring(pos - 100, pos + 4000));
} else {
  // Let's search for the main content area in Home.tsx
  const posMain = bundle.indexOf('main-content');
  if (posMain !== -1) {
    console.log('Found main-content at pos:', posMain);
    console.log(bundle.substring(posMain - 100, posMain + 4000));
  }
}
