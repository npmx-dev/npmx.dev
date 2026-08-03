export type KeytraceProfile = {
  name: string
  avatar: string
  banner?: string
  description: string
}

export type KeytraceVerificationStatus = 'verified' | 'unverified' | 'stale' | 'failed'

export type KeytraceProofMethod =
  | 'dns'
  | 'github'
  | 'npm'
  | 'mastodon'
  | 'pgp'
  | 'bluesky'
  | 'other'

export type KeytraceAccount = {
  platform: string
  username: string
  displayName?: string
  avatar?: string
  url?: string
  status: KeytraceVerificationStatus
  proofMethod: KeytraceProofMethod
  addedAt: string
  lastCheckedAt: string
  failureReason?: string
}

export type KeytraceResponse = {
  profile: KeytraceProfile
  accounts: KeytraceAccount[]
}

export type KeytraceReverifyRequest = {
  identity: string
  platform: string
  username: string
  url?: string
}

export type KeytraceReverifyResponse = {
  status: KeytraceVerificationStatus
  lastCheckedAt: string
  failureReason?: string
  retractedAt?: string
}
