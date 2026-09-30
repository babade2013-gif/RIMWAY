const fs = require('fs');

const bundle = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

// Find sections related to Rides Management
console.log('--- SEARCHING RIDES MANAGEMENT ---');
const rideKeywords = ['إدارة الرحلات', 'رحلة جديدة', 'إنشاء رحلة', 'تفاصيل الرحلة', 'حالة الرحلة', 'سجل الرحلات'];
for (const kw of rideKeywords) {
  let idx = 0;
  while ((idx = bundle.indexOf(kw, idx)) !== -1) {
    const start = Math.max(0, idx - 400);
    const end = Math.min(bundle.length, idx + 800);
    console.log(`\n=== FOUND KW "${kw}" at position ${idx} ===`);
    console.log(bundle.substring(start, end));
    idx += kw.length + 100;
    if (idx > 500000) break;
  }
}
