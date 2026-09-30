const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const idx = bundle.indexOf(marker);
  if (idx !== -1) {
    console.log(`\n================== FUNCTION ${name} (pos ${idx}) ==================`);
    console.log(bundle.substring(idx, idx + 8000));
  } else {
    console.log(`Function ${name} not found`);
  }
}

extractFunction('Hw'); // Rides Management
extractFunction('Cw'); // Captain Review & Approval
extractFunction('Ew'); // Captains Management
extractFunction('_w'); // Captain Onboarding
