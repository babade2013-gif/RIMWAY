const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

// Let's find the components in Home.tsx
// Regex to find occurrences of `client/src/pages/Home.tsx`
const matches = [];
let regex = /data-loc="client\/src\/pages\/Home\.tsx:(\d+)"/g;
let match;
while ((match = regex.exec(bundle)) !== null) {
  matches.push({ line: parseInt(match[1]), index: match.index });
}

console.log('Total data-loc matches in Home.tsx:', matches.length);
if (matches.length > 0) {
  console.log('Line range in Home.tsx:', matches[0].line, 'to', matches[matches.length - 1].line);
}

// Let's extract the main views/tabs:
// 1. Rides management (r === 'rides')
// 2. Captains management (r === 'captains')
// 3. Captain onboarding (r === 'captain-onboarding')
// 4. Captain review (r === 'captain-review')
// 5. New ride modal / panel

function extractAround(snippet, len = 2500) {
  const pos = bundle.indexOf(snippet);
  if (pos !== -1) {
    console.log(`\n=================== SNIPPET FOR "${snippet}" (pos: ${pos}) ===================`);
    console.log(bundle.substring(Math.max(0, pos - 200), Math.min(bundle.length, pos + len)));
  } else {
    console.log(`Snippet "${snippet}" not found`);
  }
}

extractAround('r==="rides"');
extractAround('r==="captain-review"');
extractAround('r==="captain-onboarding"');
extractAround('إنشاء رحلة يدوية', 3000);
