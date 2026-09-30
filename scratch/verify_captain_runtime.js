const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function request(endpoint, options = {}) {
  const url = new URL(endpoint, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function createMultipartFormData(boundary, fields, files) {
  const buffers = [];
  
  for (const [key, val] of Object.entries(fields)) {
    buffers.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  for (const file of files) {
    buffers.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.mime}\r\n\r\n`
    ));
    buffers.push(file.buffer);
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(buffers);
}

async function runVerification() {
  console.log('=== STARTING RUNTIME VERIFICATION OF PHASE 14 ===\n');

  // 1. Get Service Type
  console.log('Step 1: Fetching available service types...');
  const servicesRes = await request('/api/v1/rides/services');
  if (servicesRes.status !== 200 || !servicesRes.data.length) {
    throw new Error(`Failed to fetch services: ${JSON.stringify(servicesRes.data)}`);
  }
  const serviceTypeId = servicesRes.data[0].id;
  console.log(`[PASS] Found service type: ${servicesRes.data[0].name} (${serviceTypeId})`);

  // 2. Captain Login
  const captainPhone = '+2223' + Math.floor(1000000 + Math.random() * 9000000);
  console.log(`\nStep 2: Authenticating Captain via OTP with phone ${captainPhone}...`);
  const captainAuth = await request('/api/v1/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: captainPhone, otp: '1234', role: 'DRIVER' }),
  });
  if (captainAuth.status !== 200) {
    throw new Error(`Captain auth failed: ${JSON.stringify(captainAuth.data)}`);
  }
  const captainToken = captainAuth.data.accessToken;
  console.log(`[PASS] Captain authenticated. Access Token obtained.`);

  // 3. Initial Status Check
  console.log('\nStep 3: Checking initial status on GET /api/v1/drivers/me...');
  const initialMe = await request('/api/v1/drivers/me', {
    headers: { 'Authorization': `Bearer ${captainToken}` },
  });
  if (initialMe.status !== 200) {
    throw new Error(`GET /drivers/me failed: ${JSON.stringify(initialMe.data)}`);
  }
  console.log(`[PASS] Initial registrationStatus: ${initialMe.data.registrationStatus}, driverStatus: ${initialMe.data.status}`);
  if (initialMe.data.registrationStatus !== 'REGISTRATION_INCOMPLETE') {
    throw new Error(`Expected REGISTRATION_INCOMPLETE but got ${initialMe.data.registrationStatus}`);
  }
  const driverId = initialMe.data.id;

  // 4. File Upload (Document & Vehicle)
  console.log('\nStep 4: Testing multipart file uploads...');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const dummyDoc = Buffer.from('FAKE_PDF_DOCUMENT_CONTENT_RIMWAY');
  const bodyDoc = createMultipartFormData(boundary, {}, [{
    field: 'file',
    filename: 'license.pdf',
    mime: 'application/pdf',
    buffer: dummyDoc,
  }]);

  const uploadDocRes = await request('/api/v1/drivers/upload?category=documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${captainToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyDoc.length,
    },
    body: bodyDoc,
  });

  if (uploadDocRes.status !== 201) {
    throw new Error(`Upload document failed: ${JSON.stringify(uploadDocRes.data)}`);
  }
  const docFileUrl = uploadDocRes.data.fileUrl;
  console.log(`[PASS] Document uploaded successfully: ${docFileUrl}`);

  // Test static access to uploaded document
  const checkDocStatic = await request(docFileUrl);
  if (checkDocStatic.status !== 200) {
    throw new Error(`Static access to uploaded doc failed: status ${checkDocStatic.status}`);
  }
  console.log(`[PASS] Static serving of document verified (HTTP 200).`);

  // Upload vehicle photo
  const dummyPhoto = Buffer.from('FAKE_IMAGE_CONTENT_RIMWAY');
  const bodyPhoto = createMultipartFormData(boundary, {}, [{
    field: 'file',
    filename: 'car_front.jpg',
    mime: 'image/jpeg',
    buffer: dummyPhoto,
  }]);

  const uploadPhotoRes = await request('/api/v1/drivers/upload?category=vehicle', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${captainToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyPhoto.length,
    },
    body: bodyPhoto,
  });

  if (uploadPhotoRes.status !== 201) {
    throw new Error(`Upload vehicle photo failed: ${JSON.stringify(uploadPhotoRes.data)}`);
  }
  const photoFileUrl = uploadPhotoRes.data.fileUrl;
  console.log(`[PASS] Vehicle photo uploaded successfully: ${photoFileUrl}`);

  // 5. Submit Registration
  console.log('\nStep 5: Submitting complete registration payload...');
  const regPayload = {
    name: 'كابتن التجربة الحية',
    vehicle: {
      brand: 'Toyota',
      model: 'Camry',
      year: 2023,
      color: 'Silver',
      plateNumber: '99' + Math.floor(1000 + Math.random() * 8999) + 'AA01',
      serviceTypeId: serviceTypeId,
    },
    documents: [
      { type: 'NATIONAL_ID', fileUrl: docFileUrl, fileName: 'nid.pdf', mimeType: 'application/pdf' },
      { type: 'DRIVING_LICENSE', fileUrl: docFileUrl, fileName: 'license.pdf', mimeType: 'application/pdf' },
      { type: 'VEHICLE_INSURANCE', fileUrl: docFileUrl, fileName: 'insurance.pdf', mimeType: 'application/pdf' },
      { type: 'VEHICLE_REGISTRATION', fileUrl: docFileUrl, fileName: 'registration.pdf', mimeType: 'application/pdf' },
    ],
    vehiclePhotos: [
      { type: 'VEHICLE_FRONT', fileUrl: photoFileUrl, fileName: 'front.jpg', mimeType: 'image/jpeg' },
      { type: 'VEHICLE_BACK', fileUrl: photoFileUrl, fileName: 'back.jpg', mimeType: 'image/jpeg' },
      { type: 'VEHICLE_RIGHT', fileUrl: photoFileUrl, fileName: 'right.jpg', mimeType: 'image/jpeg' },
      { type: 'VEHICLE_LEFT', fileUrl: photoFileUrl, fileName: 'left.jpg', mimeType: 'image/jpeg' },
    ],
  };

  const regRes = await request('/api/v1/drivers/register', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${captainToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(regPayload),
  });

  if (regRes.status !== 200 && regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }
  console.log(`[PASS] Registration submitted. Status: ${regRes.data.registrationStatus}`);
  if (regRes.data.registrationStatus !== 'PENDING_REVIEW') {
    throw new Error(`Expected PENDING_REVIEW but got ${regRes.data.registrationStatus}`);
  }

  // 6. Admin Authentication & Review
  console.log('\nStep 6: Authenticating Admin via OTP...');
  const adminAuth = await request('/api/v1/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+22240009988', otp: '1234', role: 'ADMIN' }),
  });
  if (adminAuth.status !== 200) {
    throw new Error(`Admin auth failed: ${JSON.stringify(adminAuth.data)}`);
  }
  const adminToken = adminAuth.data.accessToken;
  console.log(`[PASS] Admin authenticated. Access Token obtained.`);

  console.log('\nStep 7: Admin fetching pending captains list...');
  const pendingCaptainsRes = await request('/api/v1/admin/captains?status=PENDING', {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  if (pendingCaptainsRes.status !== 200) {
    throw new Error(`Failed to list pending captains: ${JSON.stringify(pendingCaptainsRes.data)}`);
  }
  const captainsList = Array.isArray(pendingCaptainsRes.data) ? pendingCaptainsRes.data : pendingCaptainsRes.data.data;
  const foundCaptain = captainsList.find(c => c.id === driverId);
  if (!foundCaptain) {
    throw new Error(`Newly registered captain ${driverId} not found in pending list!`);
  }
  console.log(`[PASS] Captain found in Admin pending list: ${foundCaptain.user?.phone}, status: ${foundCaptain.status}`);

  console.log('\nStep 8: Admin inspecting captain details...');
  const detailsRes = await request(`/api/v1/admin/captains/${driverId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  if (detailsRes.status !== 200) {
    throw new Error(`Failed to fetch captain details: ${JSON.stringify(detailsRes.data)}`);
  }
  console.log(`[PASS] Captain details fetched. Documents count: ${detailsRes.data.documents?.length}, Vehicle: ${detailsRes.data.vehicle?.brand} ${detailsRes.data.vehicle?.model}`);
  if (!detailsRes.data.documents || detailsRes.data.documents.length < 8) {
    throw new Error(`Expected at least 8 documents/photos, got ${detailsRes.data.documents?.length}`);
  }

  // 9. Admin Rejects with Reason
  const rejectReason = 'صورة رخصة السياقة غير واضحة وبحاجة إلى إعادة رفع بدقة أعلى';
  console.log(`\nStep 9: Admin rejecting captain with reason: "${rejectReason}"...`);
  const rejectRes = await request(`/api/v1/admin/captains/${driverId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: rejectReason }),
  });
  if (rejectRes.status !== 200 && rejectRes.status !== 201) {
    throw new Error(`Reject failed: ${JSON.stringify(rejectRes.data)}`);
  }
  console.log(`[PASS] Admin rejection confirmed. Status: ${rejectRes.data.status}, reason: ${rejectRes.data.rejectionReason}`);

  // 10. Captain checks /drivers/me after rejection
  console.log('\nStep 10: Captain verifying rejected status and reason...');
  const rejectedMe = await request('/api/v1/drivers/me', {
    headers: { 'Authorization': `Bearer ${captainToken}` },
  });
  if (rejectedMe.status !== 200) {
    throw new Error(`GET /drivers/me failed: ${JSON.stringify(rejectedMe.data)}`);
  }
  console.log(`[PASS] Captain sees registrationStatus: ${rejectedMe.data.registrationStatus}`);
  console.log(`[PASS] Captain sees rejectionReason: "${rejectedMe.data.rejectionReason}"`);
  if (rejectedMe.data.registrationStatus !== 'REJECTED' || rejectedMe.data.rejectionReason !== rejectReason) {
    throw new Error('Rejection status or reason does not match!');
  }

  // 11. Captain re-submits registration
  console.log('\nStep 11: Captain re-submitting registration with updated document...');
  const resubmitRes = await request('/api/v1/drivers/register', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${captainToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(regPayload),
  });
  if (resubmitRes.status !== 200 && resubmitRes.status !== 201) {
    throw new Error(`Resubmit failed: ${JSON.stringify(resubmitRes.data)}`);
  }
  console.log(`[PASS] Resubmission accepted. Status: ${resubmitRes.data.registrationStatus}`);

  const postResubmitMe = await request('/api/v1/drivers/me', {
    headers: { 'Authorization': `Bearer ${captainToken}` },
  });
  if (postResubmitMe.data.registrationStatus !== 'PENDING_REVIEW' || postResubmitMe.data.rejectionReason !== null) {
    throw new Error(`Expected PENDING_REVIEW and null rejectionReason, got ${postResubmitMe.data.registrationStatus} / ${postResubmitMe.data.rejectionReason}`);
  }
  console.log(`[PASS] Captain status is back to PENDING_REVIEW, rejectionReason cleared to null.`);

  // 12. Admin Approves Captain
  console.log('\nStep 12: Admin approving captain...');
  const approveRes = await request(`/api/v1/admin/captains/${driverId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (approveRes.status !== 200 && approveRes.status !== 201) {
    throw new Error(`Approve failed: ${JSON.stringify(approveRes.data)}`);
  }
  console.log(`[PASS] Admin approval confirmed. Status: ${approveRes.data.status}`);

  // 13. Captain checks /drivers/me after approval
  console.log('\nStep 13: Captain verifying approved status...');
  const approvedMe = await request('/api/v1/drivers/me', {
    headers: { 'Authorization': `Bearer ${captainToken}` },
  });
  if (approvedMe.status !== 200) {
    throw new Error(`GET /drivers/me failed: ${JSON.stringify(approvedMe.data)}`);
  }
  console.log(`[PASS] Final captain registrationStatus: ${approvedMe.data.registrationStatus}`);
  console.log(`[PASS] Final captain status: ${approvedMe.data.status}`);
  if (approvedMe.data.registrationStatus !== 'APPROVED' || approvedMe.data.status !== 'APPROVED') {
    throw new Error('Captain status is not APPROVED!');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 13 END-TO-END RUNTIME VERIFICATION STEPS PASSED!');
  console.log('======================================================\n');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
