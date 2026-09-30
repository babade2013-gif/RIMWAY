const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

function extractToFile(funcName, outputFile) {
  const marker = `function ${funcName}(`;
  const idx = bundle.indexOf(marker);
  if (idx !== -1) {
    // find the matching end of function or next function
    let nextIdx = bundle.indexOf('function ', idx + marker.length);
    if (nextIdx === -1) nextIdx = idx + 25000;
    const code = bundle.substring(idx, nextIdx);
    fs.writeFileSync(outputFile, code);
    console.log(`Saved ${funcName} to ${outputFile} (${code.length} bytes)`);
  } else {
    console.log(`Function ${funcName} not found!`);
  }
}

extractToFile('Hw', 'scratch/nawil_rides.js');
extractToFile('Cw', 'scratch/nawil_captain_review.js');
extractToFile('Ew', 'scratch/nawil_captains.js');
extractToFile('ww', 'scratch/nawil_new_ride.js');
