const fs = require('fs');

let appTest = fs.readFileSync('src/App.test.tsx', 'utf8');
if (!appTest.includes('@testing-library/jest-dom')) {
  fs.writeFileSync('src/App.test.tsx', "import '@testing-library/jest-dom';\n" + appTest);
}

let adminMap = fs.readFileSync('src/services/map/AdminRideMap.tsx', 'utf8');
adminMap = adminMap.replace('import React, { useState }', 'import React');
fs.writeFileSync('src/services/map/AdminRideMap.tsx', adminMap);

let viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
if (!viteConfig.includes('/// <reference types="vitest" />')) {
  fs.writeFileSync('vite.config.ts', '/// <reference types="vitest" />\n' + viteConfig);
}

let routingService = fs.readFileSync('src/services/map/routingService.ts', 'utf8');
routingService = routingService.replace(/origin: RideLocation, destination: RideLocation/g, '_origin: RideLocation, _destination: RideLocation');
fs.writeFileSync('src/services/map/routingService.ts', routingService);

let placesService = fs.readFileSync('src/services/map/placesService.ts', 'utf8');
placesService = placesService.replace(/query: string/g, '_query: string').replace(/placeId: string/g, '_placeId: string');
fs.writeFileSync('src/services/map/placesService.ts', placesService);
