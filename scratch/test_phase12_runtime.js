const BASE_URL = 'http://localhost:3000/api/v1';

async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function get(url, headers = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function run() {
  console.log('=== PHASE 12 LIVE RUNTIME VERIFICATION ===');

  // 1. Test GET /rides/services
  console.log('\n[1] Testing GET /rides/services...');
  const servicesRes = await get(`${BASE_URL}/rides/services`);
  console.log(`Status: ${servicesRes.status}, Services Count: ${servicesRes.data.length}`);
  if (servicesRes.data.length === 0) {
    throw new Error('No active service types found!');
  }
  const defaultService = servicesRes.data[0];
  console.log(`Default Service: ${defaultService.name} (id: ${defaultService.id}, baseFare: ${defaultService.baseFare})`);

  // 2. Passenger Auth
  console.log('\n[2] Passenger Authentication...');
  const passengerPhone = '+22241112233';
  await post(`${BASE_URL}/auth/send-otp`, { phone: passengerPhone });
  const authRes = await post(`${BASE_URL}/auth/verify-otp`, {
    phone: passengerPhone,
    otp: '1234',
    role: 'PASSENGER'
  });
  const passengerToken = authRes.data.accessToken;
  console.log('Passenger authenticated successfully.');

  // 3. Ride Estimation with Service Type
  console.log('\n[3] Ride Estimation...');
  const estimateRes = await post(`${BASE_URL}/rides/estimate`, {
    pickupLat: 18.0858,
    pickupLng: -15.9785,
    dropoffLat: 18.0800,
    dropoffLng: -15.9700,
    serviceTypeId: defaultService.id
  });
  console.log(`Estimated Fare: ${estimateRes.data.estimatedFare} MRU, Distance: ${estimateRes.data.distanceKm} km`);

  // 4. Idempotent Ride Request
  console.log('\n[4] Request Ride with Idempotency Key...');
  const idempotencyKey = `p12-idem-${Date.now()}`;
  const ridePayload = {
    pickupLat: 18.0858,
    pickupLng: -15.9785,
    dropoffLat: 18.0800,
    dropoffLng: -15.9700,
    pickupName: 'Tevragh Zeina',
    dropoffName: 'Ksar',
    serviceTypeId: defaultService.id
  };

  const req1 = await post(`${BASE_URL}/rides/request`, ridePayload, {
    Authorization: `Bearer ${passengerToken}`,
    'Idempotency-Key': idempotencyKey
  });
  const rideId = req1.data.id;
  console.log(`Ride created: ${rideId}, status: ${req1.data.status}, stateVersion: ${req1.data.stateVersion}`);

  // 4b. Repeat request with same idempotency key
  const req2 = await post(`${BASE_URL}/rides/request`, ridePayload, {
    Authorization: `Bearer ${passengerToken}`,
    'Idempotency-Key': idempotencyKey
  });
  if (req2.data.id !== rideId) {
    throw new Error('Idempotency failed: Returned different ride ID!');
  }
  console.log('Idempotency verification passed: Returned identical ride instance.');

  // 5. Driver Auth & Accept Ride with stateVersion: 1
  console.log('\n[5] Driver Accept Ride...');
  const driverPhone = '+22242223344';
  await post(`${BASE_URL}/auth/send-otp`, { phone: driverPhone });
  const driverAuth = await post(`${BASE_URL}/auth/verify-otp`, {
    phone: driverPhone,
    otp: '1234',
    role: 'DRIVER'
  });
  const driverToken = driverAuth.data.accessToken;

  // Make sure driver is registered in DB as approved captain
  const adminAuth = await post(`${BASE_URL}/auth/verify-otp`, {
    phone: '+22240000000',
    otp: '1234',
    role: 'ADMIN'
  });
  const adminToken = adminAuth.data.accessToken;

  // Ensure driver profile is active
  try {
    await post(`${BASE_URL}/admin/captains`, {
      phone: driverPhone,
      fullName: 'Captain Test Phase 12',
      licenseNumber: 'LIC-P12-01',
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: 2022,
      vehiclePlate: '1234-AA-12',
      serviceTypeId: defaultService.id
    }, {
      Authorization: `Bearer ${adminToken}`
    });
  } catch (err) {
    // Already created
  }

  // Driver accepts ride passing expectedVersion: 1
  const acceptRes = await post(`${BASE_URL}/drivers/rides/${rideId}/accept`, {
    stateVersion: 1
  }, {
    Authorization: `Bearer ${driverToken}`
  });
  console.log(`Ride accepted. New status: ${acceptRes.data.status}, stateVersion: ${acceptRes.data.stateVersion}`);

  // 6. Arrive -> Board -> Start -> Complete
  console.log('\n[6] Advancing Ride Lifecycle...');
  const arriveRes = await post(`${BASE_URL}/drivers/rides/${rideId}/arrive`, {
    stateVersion: acceptRes.data.stateVersion
  }, {
    Authorization: `Bearer ${driverToken}`
  });
  console.log(`Driver arrived: ${arriveRes.data.status}, version: ${arriveRes.data.stateVersion}`);

  const boardRes = await post(`${BASE_URL}/drivers/rides/${rideId}/boarded`, {
    stateVersion: arriveRes.data.stateVersion
  }, {
    Authorization: `Bearer ${driverToken}`
  });
  console.log(`Passenger boarded: ${boardRes.data.status}, version: ${boardRes.data.stateVersion}`);

  const startRes = await post(`${BASE_URL}/drivers/rides/${rideId}/start`, {
    stateVersion: boardRes.data.stateVersion
  }, {
    Authorization: `Bearer ${driverToken}`
  });
  console.log(`Ride started: ${startRes.data.status}, version: ${startRes.data.stateVersion}`);

  const completeRes = await post(`${BASE_URL}/drivers/rides/${rideId}/complete`, {
    stateVersion: startRes.data.stateVersion
  }, {
    Authorization: `Bearer ${driverToken}`
  });
  console.log(`Ride completed: ${completeRes.data.status}, version: ${completeRes.data.stateVersion}, finalFare: ${completeRes.data.finalFare}`);

  // 7. Rate Ride
  console.log('\n[7] Passenger Rating...');
  const rateRes = await post(`${BASE_URL}/rides/${rideId}/rate`, {
    rating: 5,
    comment: 'سائق ممتاز ورحلة رائعة جداً'
  }, {
    Authorization: `Bearer ${passengerToken}`
  });
  console.log(`Rating submitted: score = ${rateRes.data.score}, comment = "${rateRes.data.comment}"`);

  console.log('\n✅ ALL PHASE 12 LIVE RUNTIME CHECKS PASSED PERFECTLY!\n');
}

run().catch((err) => {
  console.error('Test failed with error:', err.data || err.message);
  process.exit(1);
});
