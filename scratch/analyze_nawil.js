const fs = require('fs');

const content = fs.readFileSync('scratch/nawil_bundle.js', 'utf8');

// Find arabic strings
const arabicMatches = content.match(/[\u0600-\u06FF\s]{4,}/g) || [];
const uniqueArabic = [...new Set(arabicMatches.map(s => s.trim()))].filter(s => s.length > 5);

console.log('Total unique Arabic phrases:', uniqueArabic.length);
console.log('\n--- Key Highlights / Sections ---');
console.log(uniqueArabic.slice(0, 40).join(' | '));

// Find keywords like captain, passenger, ride, payment, bankily, masrvi, etc.
const keywords = ['كابتن', 'راكب', 'رحلة', 'بنكيلي', 'السائق', 'الطلب', 'لوحة', 'إدارة', 'تسجيل', 'نقل'];
for (const kw of keywords) {
  const matching = uniqueArabic.filter(s => s.includes(kw));
  console.log(`\nMatches for "${kw}" (${matching.length}):`, matching.slice(0, 5));
}
