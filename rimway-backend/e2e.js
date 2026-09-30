const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function myFetch(url, options = {}) {
  const res = await fetch(BASE_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw { response: { status: res.status, data } };
  }
  return { data };
}

async function runE2E() {
  console.log('--- STARTING E2E RUNTIME VERIFICATION ---');
  let adminToken = '';
  let captainToken = '';
  let captainUserId = '';
  let captainDriverId = '';
  let createdRideId = '';

  // Get a service type
  const serviceType = await prisma.serviceType.findFirst();
  if (!serviceType) {
    console.error('FAIL: No service type found in DB.');
    return;
  }

  // 1. ADMIN LOGIN
  console.log('\\n[1] Admin Login');
  try {
    await myFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: '+22244444444' }) });
    const verifyRes = await myFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: '+22244444444', otp: '1234', role: 'ADMIN' }) });
    adminToken = verifyRes.data.accessToken;
    assert(adminToken, 'Admin Token should be present');
    console.log('PASS: Admin login successful');
  } catch (err) {
    console.error('FAIL: Admin login', err.response?.data || err.message);
    return;
  }

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. CREATE CAPTAIN
  console.log('\\n[2] Create Captain');
  let newCaptainPhone = `+22230${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
  try {
    const res = await myFetch('/admin/captains', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        phone: newCaptainPhone,
        name: 'E2E Test Captain',
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          color: 'White',
          plateNumber: `1234AA-${Date.now()}`,
          serviceTypeId: serviceType.id
        }
      })
    });
    console.log("Create Captain Res:", res.data);
    captainUserId = res.data.user?.id;
    captainDriverId = res.data.driver?.id;
    assert(captainDriverId, 'Driver ID should be created');
    console.log('PASS: Captain created, status:', res.data.driver.status);
  } catch (err) {
    console.error('FAIL: Create captain', err.response?.data || err.message);
  }

  // 3. CAPTAIN DETAILS (PENDING)
  console.log('\\n[3] Get Captain Details');
  try {
    const res = await myFetch(`/admin/captains/${captainDriverId}`, { headers: adminHeaders });
    assert(res.data.status === 'PENDING', 'Status should be PENDING');
    console.log('PASS: Captain details fetched, status PENDING');
  } catch (err) {
    console.error('FAIL: Captain Details', err.response?.data || err.message);
  }

  // 4. APPROVE CAPTAIN
  console.log('\\n[4] Approve Captain');
  try {
    const res = await myFetch(`/admin/captains/${captainDriverId}/approve`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ reason: 'E2E Check' })
    });
    assert(res.data.status === 'APPROVED', 'Status should be APPROVED');
    console.log('PASS: Captain approved');
  } catch (err) {
    console.error('FAIL: Approve Captain', err.response?.data || err.message);
  }

  // 5. CAPTAIN LOGIN
  console.log('\\n[5] Captain Login');
  try {
    await myFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: newCaptainPhone }) });
    const verifyRes = await myFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: newCaptainPhone, otp: '1234', role: 'DRIVER' }) });
    captainToken = verifyRes.data.accessToken;
    assert(captainToken, 'Captain Token should be present');
    console.log('PASS: Captain login successful');
  } catch (err) {
    console.error('FAIL: Captain login', err.response?.data || err.message);
  }

  const captainHeaders = { Authorization: `Bearer ${captainToken}` };

  // 6. CAPTAIN ONLINE & GPS
  console.log('\\n[6] Captain Online & GPS');
  try {
    const statusRes = await myFetch('/drivers/status', { method: 'POST', headers: captainHeaders, body: JSON.stringify({ isOnline: true }) });
    assert(statusRes.data.isOnline === true, 'Captain should be online');
    await myFetch('/drivers/location', { method: 'POST', headers: captainHeaders, body: JSON.stringify({ latitude: 18.0735, longitude: -15.9582 }) });
    console.log('PASS: Captain is online and GPS sent (18.0735, -15.9582)');
  } catch (err) {
    console.error('FAIL: Captain Online/GPS', err.response?.data || err.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // 7. PHONE RIDE CREATION
  console.log('\\n[7] Phone Ride Creation');
  let rideId = null;
  const idempotencyKey = 'E2E-TEST-KEY-' + Date.now();
  const payload = {
    customerName: 'E2E Passenger',
    customerPhone: '+22220111111',
    pickupLat: 18.0735,
    pickupLng: -15.9582,
    pickupName: 'Point A',
    dropoffLat: 18.0800,
    dropoffLng: -15.9600,
    dropoffName: 'Point B',
    serviceTypeId: serviceType.id
  };

  try {
    const res = await myFetch('/admin/rides', {
      method: 'POST',
      headers: { ...adminHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload)
    });
    rideId = res.data.id;
    assert(res.data.status === 'SEARCHING', 'Ride should be SEARCHING');
    console.log('PASS: Phone ride created, ID:', rideId);
  } catch (err) {
    console.error('FAIL: Create Phone Ride', err.response?.data || err.message);
  }

  // 7B. Idempotency Check
  console.log('\\n[7B] Idempotency Check');
  try {
    const res = await myFetch('/admin/rides', {
      method: 'POST',
      headers: { ...adminHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload)
    });
    assert(res.data.id === rideId, 'Should return the exact same ride');
    console.log('PASS: Idempotency check passed (same ride returned)');
  } catch (err) {
    if (err.response?.status === 409) {
      console.error('FAIL: Idempotency returned 409 Conflict. This is a known GAP.');
    } else {
      console.error('FAIL: Idempotency', err.response?.data || err.message);
    }
  }

  await new Promise(r => setTimeout(r, 2000));

  // 8. DISPATCH (CAPTAIN GETS REQUEST)
  console.log('\\n[8] Captain Accept Ride');
  try {
    const acceptRes = await myFetch(`/drivers/rides/${rideId}/accept`, { method: 'POST', headers: captainHeaders });
    assert(acceptRes.data.status === 'DRIVER_ASSIGNED', 'Ride should be DRIVER_ASSIGNED');
    console.log('PASS: Captain accepted the dispatched ride');
  } catch (err) {
    console.error('FAIL: Captain Accept', err.response?.data || err.message);
  }

  // 9. CAPTAIN LIFECYCLE
  console.log('\\n[9] Captain Ride Lifecycle');
  try {
    await myFetch(`/drivers/rides/${rideId}/arrive`, { method: 'POST', headers: captainHeaders });
    console.log('PASS: Captain Arrived');
    await myFetch(`/drivers/rides/${rideId}/boarded`, { method: 'POST', headers: captainHeaders });
    console.log('PASS: Passenger Boarded');
    await myFetch(`/drivers/rides/${rideId}/start`, { method: 'POST', headers: captainHeaders });
    console.log('PASS: Ride Started (No OTP required)');
    await myFetch(`/drivers/rides/${rideId}/complete`, { method: 'POST', headers: captainHeaders });
    console.log('PASS: Ride Completed');
  } catch (err) {
    console.error('FAIL: Ride Lifecycle', err.response?.data || err.message);
  }

  // 10. DUPLICATE COMPLETION
  console.log('\\n[10] Duplicate Completion Protection');
  try {
    await myFetch(`/drivers/rides/${rideId}/complete`, { method: 'POST', headers: captainHeaders });
    console.error('FAIL: Duplicate completion succeeded but should have failed!');
  } catch (err) {
    console.log('PASS: Duplicate completion prevented (' + (err.response?.data?.message || err.message) + ')');
  }

  // 11. WALLET VERIFICATION
  console.log('\\n[11] Wallet Verification');
  try {
    const txRes = await myFetch(`/admin/captains/${captainDriverId}/wallet/transactions`, { headers: adminHeaders });
    assert(txRes.data.data.length > 0, 'Should have transactions');
    console.log('PASS: Wallet has transactions (Count: ' + txRes.data.data.length + ')');
    const capRes = await myFetch(`/admin/captains/${captainDriverId}`, { headers: adminHeaders });
    console.log('PASS: Captain wallet balance is now: ' + capRes.data.walletBalance);
  } catch (err) {
    console.error('FAIL: Wallet check', err.response?.data || err.message);
  }

  // 12. SUSPEND / REACTIVATE
  console.log('\\n[12] Suspend / Reactivate Captain');
  try {
    const suspendRes = await myFetch(`/admin/captains/${captainDriverId}/suspend`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ reason: 'E2E Suspend' })
    });
    assert(suspendRes.data.status === 'SUSPENDED', 'Status should be SUSPENDED');
    console.log('PASS: Captain suspended');

    const reactivateRes = await myFetch(`/admin/captains/${captainDriverId}/reactivate`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ reason: 'E2E Reactivate' })
    });
    assert(reactivateRes.data.status === 'APPROVED', 'Status should be APPROVED');
    console.log('PASS: Captain reactivated');
  } catch (err) {
    console.error('FAIL: Suspend/Reactivate', err.response?.data || err.message);
  }

  // 13. ADMIN CANCEL
  console.log('\\n[13] Admin Cancel Ride');
  try {
    // Create new ride for cancel
    const cancelPayload = {
      ...payload,
      customerName: 'Cancel Me'
    };
    const res = await myFetch('/admin/rides', {
      method: 'POST',
      headers: { ...adminHeaders, 'Idempotency-Key': 'E2E-TEST-KEY-CANCEL-' + Date.now() },
      body: JSON.stringify(cancelPayload)
    });
    const cancelRideId = res.data.id;
    const cancelStateVersion = res.data.stateVersion;

    const cancelRes = await myFetch(`/admin/rides/${cancelRideId}/cancel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'Admin override test', stateVersion: cancelStateVersion })
    });
    console.log("Cancel Res:", cancelRes.data);
    assert(cancelRes.data.status === 'CANCELLED', 'Ride should be CANCELLED');
    console.log('PASS: Admin cancelled the ride successfully');
  } catch (err) {
    console.error('FAIL: Admin Cancel', err.response?.data || err.message);
  }
}

runE2E();
