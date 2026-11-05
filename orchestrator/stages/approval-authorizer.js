// Canonical Production Orchestrator - Stage 8: Approval Authorizer
// Enforces explicit human review governance, constant-time HMAC validation, fail-closed security, and zero leakage.

const crypto = require('crypto');
const { LIFECYCLE_STATES } = require('../../core/contracts/lifecycle-schema');

function validateApprovalAuthorization(authConfig, approvalToken = null, reviewer = null) {
  const unattendedApproval = authConfig.unattendedApproval || false;
  const trustedApprovalToken = authConfig.trustedApprovalToken || null;
  const trustedApprovalTokens = authConfig.trustedApprovalTokens || new Set();

  if (unattendedApproval) {
    return {
      authorized: true,
      mode: 'UNATTENDED',
      approver: 'AUTOMATED_UNATTENDED_POLICY',
      approverRole: 'Automated CI/CD Pipeline Policy',
      token: null,
      notes: 'Automated unattended policy explicitly enabled via configuration.'
    };
  }

  // Strict security: Fail closed if no external trusted secret is configured
  if (!trustedApprovalToken && trustedApprovalTokens.size === 0) {
    return {
      authorized: false,
      reason: 'NO_TRUSTED_SECRET_CONFIGURED',
      notes: 'Human approval failed closed: no trusted approval secret is configured externally.'
    };
  }

  // 1. Check for token passed directly or in reviewer object
  const rawToken = approvalToken !== undefined && approvalToken !== null
    ? String(approvalToken).trim()
    : (reviewer?.token !== undefined && reviewer?.token !== null ? String(reviewer.token).trim() : null);

  if (rawToken !== null) {
    if (rawToken.length === 0) {
      return { authorized: false, reason: 'EMPTY_TOKEN' };
    }

    let tokenMatched = false;
    for (const trusted of trustedApprovalTokens) {
      const bufA = Buffer.from(rawToken);
      const bufB = Buffer.from(trusted);
      if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
        tokenMatched = true;
        break;
      }
    }

    if (tokenMatched) {
      return {
        authorized: true,
        mode: 'TOKEN',
        approver: reviewer?.name || 'Human Creative Director',
        approverRole: reviewer?.role || 'Human QA Architect & Release Auditor',
        token: true,
        notes: reviewer?.notes || 'Explicit human creative sign-off verified with trusted approval token.'
      };
    } else {
      return { authorized: false, reason: 'INVALID_APPROVAL_TOKEN' };
    }
  }

  // 2. Check for signed approval record with cryptographic HMAC
  if (reviewer && (reviewer.signature || reviewer.signedApproval)) {
    if (!reviewer.signature) {
      return { authorized: false, reason: 'MISSING_SIGNATURE' };
    }
    if (!trustedApprovalToken) {
      return { authorized: false, reason: 'NO_TRUSTED_SECRET_CONFIGURED' };
    }
    const approverName = reviewer.name || 'Human Creative Director';
    const approverRole = reviewer.role || 'Human QA Architect & Release Auditor';
    const expectedSig = crypto
      .createHmac('sha256', trustedApprovalToken)
      .update(`${approverName}:${approverRole}`)
      .digest('hex');

    const sigBufA = Buffer.from(String(reviewer.signature).trim());
    const sigBufB = Buffer.from(expectedSig);
    if (sigBufA.length === sigBufB.length && crypto.timingSafeEqual(sigBufA, sigBufB)) {
      return {
        authorized: true,
        mode: 'SIGNED_RECORD',
        approver: approverName,
        approverRole,
        token: true,
        signatureVerified: true,
        notes: reviewer.notes || 'Explicit cryptographically signed human approval record verified.'
      };
    } else {
      return { authorized: false, reason: 'INVALID_SIGNATURE' };
    }
  }

  return { authorized: false, reason: 'MISSING_APPROVAL_CREDENTIALS' };
}

function reviewAndApproveClips(vault, archivedClips, reviewer, approvalToken, authConfig) {
  const approved = [];
  const auth = validateApprovalAuthorization(authConfig, approvalToken, reviewer);

  for (const clip of archivedClips) {
    if (auth.authorized) {
      const approvalRecord = {
        approver: auth.approver,
        approverRole: auth.approverRole || 'Human Creative Auditor',
        approvalMode: auth.mode,
        timestamp: new Date().toISOString(),
        policyVersion: 'BURSTPOINT_HUMAN_CREATIVE_POLICY_V1',
        creativeVerdict: 'APPROVED_FOR_PUBLISHING',
        notes: auth.notes || `Explicit human creative sign-off verified for ${clip.clipId}.`
      };

      vault.updateVideo(clip.clipId, {
        reviewStatus: 'APPROVED_FOR_PUBLISHING',
        approvalStatus: 'APPROVED',
        approvalRecord
      });

      approved.push({
        ...clip,
        approvalRecord,
        reviewStatus: 'APPROVED_FOR_PUBLISHING',
        approvalStatus: 'APPROVED',
        lifecycleState: LIFECYCLE_STATES.APPROVED
      });
    } else {
      vault.updateVideo(clip.clipId, {
        reviewStatus: 'HUMAN_REVIEW_PENDING',
        approvalStatus: 'PENDING_HUMAN_REVIEW',
        approvalRecord: null
      });

      approved.push({
        ...clip,
        approvalRecord: null,
        reviewStatus: 'HUMAN_REVIEW_PENDING',
        approvalStatus: 'PENDING_HUMAN_REVIEW',
        lifecycleState: LIFECYCLE_STATES.VALIDATED
      });
    }
  }
  return approved;
}

module.exports = {
  validateApprovalAuthorization,
  reviewAndApproveClips
};
