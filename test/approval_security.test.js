/**
 * Burstpoint Human Creative Approval Security & Token Validation Test Suite
 * 
 * Verifies strict governance invariants:
 * - Missing tokens strictly retain HUMAN_REVIEW_PENDING.
 * - Arbitrary non-empty strings are rejected (INVALID_APPROVAL_TOKEN).
 * - Invalid/tampered cryptographic signatures are rejected (INVALID_SIGNATURE).
 * - Valid tokens matching trusted configuration are authorized.
 * - Valid HMAC signed approval records are authorized.
 * - Security invariant: Unapproved clips are strictly blocked from entering the publishing queue.
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { ProductionOrchestrator } = require('../orchestrator/pipeline');

console.log('======================================================================');
console.log('🛡️ BURSTPOINT HUMAN APPROVAL SECURITY & TOKEN VALIDATION SUITE');
console.log('======================================================================\n');

const TRUSTED_SECRET = 'TEST_TRUSTED_CREATIVE_SIGN_OFF_SECRET_TOKEN_9999';

const createMockArchivedClips = () => {
  const realMediaPath = path.resolve('output/underdog_slow_composed.mp4');
  return [
    {
      clipId: 'test_clip_01_approval_check',
      videoPath: realMediaPath,
      durationSeconds: 20,
      exactFrameCount: 1200,
      reviewStatus: 'HUMAN_REVIEW_PENDING',
      approvalStatus: 'PENDING_HUMAN_REVIEW',
      candidate: {
        title: 'Test Scenario 1',
        hookText: 'Hook 1',
        config: { id: 'test_cfg_1' },
        simOutcome: { seed: 101, narrativeRole: 'UNDERDOG_EXPONENTIAL_WIN' }
      }
    },
    {
      clipId: 'test_clip_02_approval_check',
      videoPath: realMediaPath,
      durationSeconds: 20,
      exactFrameCount: 1200,
      reviewStatus: 'HUMAN_REVIEW_PENDING',
      approvalStatus: 'PENDING_HUMAN_REVIEW',
      candidate: {
        title: 'Test Scenario 2',
        hookText: 'Hook 2',
        config: { id: 'test_cfg_2' },
        simOutcome: { seed: 202, narrativeRole: 'COMEBACK_REVERSAL' }
      }
    }
  ];
};

// 1. Missing Token Tests
console.log('▶ [1/5] Testing Missing Approval Tokens...');
{
  const orchestrator = new ProductionOrchestrator({
    trustedApprovalToken: TRUSTED_SECRET,
    unattendedApproval: false
  });

  // Test with undefined
  const authUndefined = orchestrator.validateApprovalAuthorization(undefined, null);
  assert.strictEqual(authUndefined.authorized, false);
  assert.strictEqual(authUndefined.reason, 'MISSING_APPROVAL_CREDENTIALS');

  // Test with null
  const authNull = orchestrator.validateApprovalAuthorization(null, null);
  assert.strictEqual(authNull.authorized, false);
  assert.strictEqual(authNull.reason, 'MISSING_APPROVAL_CREDENTIALS');

  // Test with empty string
  const authEmpty = orchestrator.validateApprovalAuthorization('', null);
  assert.strictEqual(authEmpty.authorized, false);
  assert.strictEqual(authEmpty.reason, 'EMPTY_TOKEN');

  // Test with whitespace string
  const authWhitespace = orchestrator.validateApprovalAuthorization('   ', null);
  assert.strictEqual(authWhitespace.authorized, false);
  assert.strictEqual(authWhitespace.reason, 'EMPTY_TOKEN');

  // Execute reviewAndApproveClips
  const clips = createMockArchivedClips();
  const reviewed = orchestrator.reviewAndApproveClips(clips, null, null);
  assert.strictEqual(reviewed.length, 2);
  for (const c of reviewed) {
    assert.strictEqual(c.approvalStatus, 'PENDING_HUMAN_REVIEW');
    assert.strictEqual(c.reviewStatus, 'HUMAN_REVIEW_PENDING');
    assert.strictEqual(c.approvalRecord, null);
  }

  // Security invariant: Publishing queue must reject unapproved clips
  const queued = orchestrator.scheduleApprovedClips(reviewed);
  assert.strictEqual(queued.length, 0, 'Zero unapproved clips may enter publishing queue!');

  console.log('  ✓ Undefined, null, and empty tokens rejected as MISSING_APPROVAL_CREDENTIALS / EMPTY_TOKEN.');
  console.log('  ✓ Clips remain in PENDING_HUMAN_REVIEW with null approval record.');
  console.log('  ✓ Publishing queue strictly blocked unapproved clips (0 queued).\n');
}

// 2. Arbitrary Non-Empty String Tests
console.log('▶ [2/5] Testing Arbitrary Non-Empty String Tokens (Rejection of Non-Validated Strings)...');
{
  const orchestrator = new ProductionOrchestrator({
    trustedApprovalToken: TRUSTED_SECRET,
    unattendedApproval: false
  });

  const arbitraryTokens = [
    'arbitrary_string_123',
    'true',
    'APPROVED',
    'some-random-uuid-49021',
    'admin',
    'SECRET_TOKEN_BUT_WRONG'
  ];

  for (const token of arbitraryTokens) {
    const auth = orchestrator.validateApprovalAuthorization(token, null);
    assert.strictEqual(auth.authorized, false, `Arbitrary token "${token}" must not authorize!`);
    assert.strictEqual(auth.reason, 'INVALID_APPROVAL_TOKEN');

    const clips = createMockArchivedClips();
    const reviewed = orchestrator.reviewAndApproveClips(clips, null, token);
    for (const c of reviewed) {
      assert.strictEqual(c.approvalStatus, 'PENDING_HUMAN_REVIEW');
      assert.strictEqual(c.approvalRecord, null);
    }
    const queued = orchestrator.scheduleApprovedClips(reviewed);
    assert.strictEqual(queued.length, 0);
  }

  console.log('  ✓ All arbitrary strings rejected as INVALID_APPROVAL_TOKEN.');
  console.log('  ✓ Non-empty string loophole strictly eliminated.\n');
}

// 3. Cryptographically Signed Approval Records (HMAC) & Invalid Signature Tests
console.log('▶ [3/5] Testing Cryptographic HMAC Signatures & Tampered Rejection...');
{
  const orchestrator = new ProductionOrchestrator({
    trustedApprovalToken: TRUSTED_SECRET,
    unattendedApproval: false
  });

  const approver = {
    name: 'Alice Director',
    role: 'Executive Creative Director',
    signedApproval: true
  };

  // Missing signature
  const authMissingSig = orchestrator.validateApprovalAuthorization(null, approver);
  assert.strictEqual(authMissingSig.authorized, false);
  assert.strictEqual(authMissingSig.reason, 'MISSING_SIGNATURE');

  // Invalid / Tampered signature
  const authBadSig = orchestrator.validateApprovalAuthorization(null, {
    ...approver,
    signature: 'badc0ffeedeadbeef0123456789abcdef0123456789abcdef0123456789abcdef'
  });
  assert.strictEqual(authBadSig.authorized, false);
  assert.strictEqual(authBadSig.reason, 'INVALID_SIGNATURE');

  // Valid HMAC signature
  const validHmac = crypto
    .createHmac('sha256', TRUSTED_SECRET)
    .update(`${approver.name}:${approver.role}`)
    .digest('hex');

  const authValidSig = orchestrator.validateApprovalAuthorization(null, {
    ...approver,
    signature: validHmac
  });
  assert.strictEqual(authValidSig.authorized, true);
  assert.strictEqual(authValidSig.mode, 'SIGNED_RECORD');
  assert.strictEqual(authValidSig.approver, 'Alice Director');

  const clips = createMockArchivedClips();
  const reviewed = orchestrator.reviewAndApproveClips(clips, { ...approver, signature: validHmac }, null);
  for (const c of reviewed) {
    assert.strictEqual(c.approvalStatus, 'APPROVED');
    assert.strictEqual(c.reviewStatus, 'APPROVED_FOR_PUBLISHING');
    assert.strictEqual(c.approvalRecord.approver, 'Alice Director');
    assert.strictEqual(c.approvalRecord.approvalMode, 'SIGNED_RECORD');
  }

  console.log('  ✓ Missing signature rejected as MISSING_SIGNATURE.');
  console.log('  ✓ Tampered signature rejected as INVALID_SIGNATURE.');
  console.log('  ✓ Valid HMAC signature verified and authorized with mode SIGNED_RECORD.\n');
}

// 4. Valid Trusted Approval Token Tests
console.log('▶ [4/5] Testing Valid Trusted Configured Approval Tokens...');
{
  const orchestrator = new ProductionOrchestrator({
    trustedApprovalToken: TRUSTED_SECRET,
    unattendedApproval: false
  });

  const auth = orchestrator.validateApprovalAuthorization(TRUSTED_SECRET, {
    name: 'Bob QA Director',
    role: 'Principal QA Architect'
  });

  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.mode, 'TOKEN');
  assert.strictEqual(auth.approver, 'Bob QA Director');
  assert.strictEqual(auth.token, TRUSTED_SECRET);

  const clips = createMockArchivedClips();
  const reviewed = orchestrator.reviewAndApproveClips(clips, { name: 'Bob QA Director' }, TRUSTED_SECRET);
  for (const c of reviewed) {
    assert.strictEqual(c.approvalStatus, 'APPROVED');
    assert.strictEqual(c.reviewStatus, 'APPROVED_FOR_PUBLISHING');
    assert.strictEqual(c.approvalRecord.approver, 'Bob QA Director');
    assert.strictEqual(c.approvalRecord.approvalMode, 'TOKEN');
  }

  // Valid clips successfully pass into publishing queue
  const queued = orchestrator.scheduleApprovedClips(reviewed);
  assert.strictEqual(queued.length, 2, 'Authorized clips must enter queue');

  console.log('  ✓ Valid token matching trusted configuration successfully authorized.');
  console.log('  ✓ Approval record cleanly stamped with approver identity and timestamp.');
  console.log('  ✓ Authorized clips permitted into authoritative publishing queue.\n');
}

// 5. Unattended Policy Explicit Override Tests
console.log('▶ [5/5] Testing Unattended CI/CD Automated Policy...');
{
  const orchestrator = new ProductionOrchestrator({
    trustedApprovalToken: TRUSTED_SECRET,
    unattendedApproval: true
  });

  const auth = orchestrator.validateApprovalAuthorization(null, null);
  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.mode, 'UNATTENDED');
  assert.strictEqual(auth.approver, 'AUTOMATED_UNATTENDED_POLICY');

  const clips = createMockArchivedClips();
  const reviewed = orchestrator.reviewAndApproveClips(clips, null, null);
  for (const c of reviewed) {
    assert.strictEqual(c.approvalStatus, 'APPROVED');
    assert.strictEqual(c.approvalRecord.approver, 'AUTOMATED_UNATTENDED_POLICY');
  }

  console.log('  ✓ Unattended policy operates only when explicitly configured (unattendedApproval: true).');
  console.log('  ✓ Approval records truthfully record AUTOMATED_UNATTENDED_POLICY.\n');
}

console.log('======================================================================');
console.log('🎉 ALL 5 APPROVAL SECURITY & TOKEN VALIDATION TESTS PASSED (100%)!');
console.log('======================================================================');
