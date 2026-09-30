const fs = require('fs');

function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content));
}

// Fix AdminRideMap.tsx
replaceFile('src/services/map/AdminRideMap.tsx', content => {
  let c = content.replace(/import React, \{ useCallback, useState \} from 'react';/g, "import { useCallback, useState } from 'react';");
  c = c.replace(/const \[map, setMap\] = useState<google\.maps\.Map \| null>\(null\);/g, '');
  c = c.replace(/const onLoad = useCallback\(function callback\(map: google\.maps\.Map\) \{\n    setMap\(map\);\n  \}, \[\]\);/g, "const onLoad = useCallback(function callback(_map: google.maps.Map) {}, []);");
  c = c.replace(/const onUnmount = useCallback\(function callback\(map: google\.maps\.Map\) \{\n    setMap\(null\);\n  \}, \[\]\);/g, "const onUnmount = useCallback(function callback(_map: google.maps.Map) {}, []);");
  c = c.replace(/as google\.maps\.DirectionsResult/g, "as unknown as google.maps.DirectionsResult");
  c = c.replace(/strokePattern: \{[\s\S]*?\}/g, "");
  return c;
});

// Fix CreatePhoneRide.tsx
replaceFile('src/pages/Rides/CreatePhoneRide.tsx', content => {
  let c = content.replace(/const \[captainLocation, setCaptainLocation\]/g, "const [captainLocation, _setCaptainLocation]");
  c = c.replace(/pickupToDropoffRoute\.distanceKm/g, "(pickupToDropoffRoute.distanceKm || 0)");
  c = c.replace(/captainToPickupRoute\.distanceKm/g, "(captainToPickupRoute.distanceKm || 0)");
  return c;
});

// Fix placesService.ts
replaceFile('src/services/map/placesService.ts', content => {
  let c = content.replace(/_query/g, "query");
  c = c.replace(/_placeId/g, "placeId");
  return c;
});

// Fix routingService.ts
replaceFile('src/services/map/routingService.ts', content => {
  let c = content.replace(/_origin/g, "origin");
  c = c.replace(/_destination/g, "destination");
  return c;
});

// Fix LocationSearchInput.tsx
replaceFile('src/services/map/LocationSearchInput.tsx', content => {
  return content.replace(/import React, \{ useState/g, "import { useState");
});

// Fix types.ts
replaceFile('src/services/map/types.ts', content => {
  let c = content;
  if (!c.includes('distanceKm?: number;')) {
    c = c.replace(/export interface RouteInfo \{/, "export interface RouteInfo {\n  distanceKm?: number;\n  durationMin?: number;");
  }
  return c;
});
