const fs = require('fs');

const css = fs.readFileSync('scratch/nawil.css', 'utf8');

const targetClasses = [
  'ride-management-page', 'ride-management-map', 'ride-management-side',
  'ride-map-overlay', 'ride-map-live', 'ride-created-toast', 'map-pick-banner',
  'ride-side-head', 'new-ride-button', 'ride-side-kpis', 'ride-side-section',
  'ride-filter-pills', 'ride-mini-list', 'fare-settings', 'new-ride-modal',
  'new-ride-dialog', 'location-select-row', 'map-pick-button', 'ride-geocode-note',
  'ride-price-preview', 'create-ride-submit', 'review-page', 'review-summary',
  'review-tabs', 'review-table', 'review-head', 'review-row', 'docs-count',
  'review-open', 'review-modal-backdrop', 'review-modal', 'review-modal-head',
  'review-document-list', 'review-document', 'decision-options', 'modal-field',
  'review-modal-footer', 'onboarding-page', 'onboarding-header', 'onboarding-shell',
  'onboarding-steps', 'onboarding-step', 'onboarding-form', 'form-step-count',
  'form-grid', 'document-grid', 'upload-note', 'submission-success', 'panel-kicker'
];

// Find occurrences in css
const extractedRules = [];
for (const cls of targetClasses) {
  let idx = 0;
  while ((idx = css.indexOf('.' + cls, idx)) !== -1) {
    const end = css.indexOf('}', idx);
    if (end !== -1) {
      extractedRules.push(css.substring(idx, end + 1));
      idx = end + 1;
    } else {
      break;
    }
  }
}

console.log(`Extracted ${extractedRules.length} rules.`);
fs.writeFileSync('scratch/nawil_extracted_styles.css', extractedRules.join('\n\n'));
