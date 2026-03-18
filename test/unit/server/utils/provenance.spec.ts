import { describe, expect, it } from 'vitest'
import { parseAttestationToProvenanceDetails } from '../../../../server/utils/provenance'

const SLSA_PROVENANCE_V1 = 'https://slsa.dev/provenance/v1'
const SLSA_PROVENANCE_V0_2 = 'https://slsa.dev/provenance/v0.2'
const SIGSTORE_SEARCH_BASE = 'https://search.sigstore.dev'

function encodePayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

describe('parseAttestationToProvenanceDetails', () => {
  it('returns null for non-object input', () => {
    expect(parseAttestationToProvenanceDetails(null)).toBeNull()
    expect(parseAttestationToProvenanceDetails(undefined)).toBeNull()
    expect(parseAttestationToProvenanceDetails('string')).toBeNull()
  })

  it('returns null when attestations is not an array', () => {
    expect(parseAttestationToProvenanceDetails({})).toBeNull()
    expect(parseAttestationToProvenanceDetails({ attestations: 'not-array' })).toBeNull()
    expect(parseAttestationToProvenanceDetails({ attestations: null })).toBeNull()
  })

  it('returns null when no SLSA attestation is found', () => {
    expect(parseAttestationToProvenanceDetails({ attestations: [] })).toBeNull()
    expect(
      parseAttestationToProvenanceDetails({
        attestations: [{ predicateType: 'https://other.predicate/v1' }],
      }),
    ).toBeNull()
  })

  it('returns null when attestation has no dsseEnvelope', () => {
    expect(
      parseAttestationToProvenanceDetails({
        attestations: [{ predicateType: SLSA_PROVENANCE_V1 }],
      }),
    ).toBeNull()
    expect(
      parseAttestationToProvenanceDetails({
        attestations: [{ predicateType: SLSA_PROVENANCE_V1, bundle: {} }],
      }),
    ).toBeNull()
  })

  it('returns null when payload cannot be decoded', () => {
    expect(
      parseAttestationToProvenanceDetails({
        attestations: [
          {
            predicateType: SLSA_PROVENANCE_V1,
            bundle: { dsseEnvelope: { payload: 'totally-not-base64' } },
          },
        ],
      }),
    ).toBeNull()
  })

  it('returns null when payload has no predicate', () => {
    expect(
      parseAttestationToProvenanceDetails({
        attestations: [
          {
            predicateType: SLSA_PROVENANCE_V1,
            bundle: { dsseEnvelope: { payload: encodePayload({}) } },
          },
        ],
      }),
    ).toBeNull()
  })

  it('parses GitHub Actions v1 attestation', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  buildDefinition: {
                    externalParameters: {
                      workflow: {
                        repository: 'https://github.com/owner/repo',
                        path: '.github/workflows/publish.yml',
                        ref: 'refs/heads/main',
                      },
                    },
                    resolvedDependencies: [
                      {
                        uri: 'git+https://github.com/owner/repo',
                        digest: { gitCommit: 'abc123def456' },
                      },
                    ],
                  },
                  runDetails: {
                    builder: { id: 'https://github.com/actions/runner/github-hosted' },
                    metadata: { invocationId: 'https://github.com/owner/repo/actions/runs/12345' },
                  },
                },
              }),
            },
            verificationMaterial: {
              tlogEntries: [{ logIndex: '98765' }],
            },
          },
        },
      ],
    })

    expect(result).toEqual({
      provider: 'github',
      providerLabel: 'GitHub Actions',
      buildSummaryUrl: 'https://github.com/owner/repo/actions/runs/12345',
      sourceCommitUrl: 'https://github.com/owner/repo/commit/abc123def456',
      sourceCommitSha: 'abc123def456',
      buildFileUrl: 'https://github.com/owner/repo/blob/main/.github/workflows/publish.yml',
      buildFilePath: '.github/workflows/publish.yml',
      publicLedgerUrl: `${SIGSTORE_SEARCH_BASE}/?logIndex=98765`,
    })
  })

  it('parses GitLab CI attestation with project-specific runner', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  buildDefinition: {
                    externalParameters: {
                      workflow: {
                        repository: 'https://gitlab.com/group/project',
                        path: '.gitlab-ci.yml',
                        ref: 'refs/tags/v1.0.0',
                      },
                    },
                    resolvedDependencies: [
                      {
                        digest: { gitCommit: 'f00f00' },
                      },
                    ],
                  },
                  runDetails: {
                    builder: { id: 'https://gitlab.com/group/project/-/runners/12345' },
                    metadata: { invocationId: 'https://gitlab.com/group/project/-/jobs/999' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result).toEqual({
      provider: 'gitlab',
      providerLabel: 'GitLab CI',
      buildSummaryUrl: 'https://gitlab.com/group/project/-/jobs/999',
      sourceCommitUrl: 'https://gitlab.com/group/project/-/commit/f00f00',
      sourceCommitSha: 'f00f00',
      buildFileUrl: 'https://gitlab.com/group/project/-/blob/v1.0.0/.gitlab-ci.yml',
      buildFilePath: '.gitlab-ci.yml',
      publicLedgerUrl: undefined,
    })
  })

  it('falls back to v0.2 attestation when v1 is not available', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V0_2,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  builder: { id: 'https://github.com/actions/runner' },
                  metadata: { buildInvocationId: 'https://github.com/owner/repo/actions/runs/555' },
                },
              }),
            },
            verificationMaterial: {
              tlogEntries: [{ logIndex: '11111' }],
            },
          },
        },
      ],
    })

    expect(result).toEqual({
      provider: 'github',
      providerLabel: 'GitHub Actions',
      buildSummaryUrl: 'https://github.com/owner/repo/actions/runs/555',
      sourceCommitUrl: undefined,
      sourceCommitSha: undefined,
      buildFileUrl: undefined,
      buildFilePath: undefined,
      publicLedgerUrl: `${SIGSTORE_SEARCH_BASE}/?logIndex=11111`,
    })
  })

  it('prefers v1 attestation over v0.2', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V0_2,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  builder: { id: 'https://github.com/actions/runner' },
                },
              }),
            },
          },
        },
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  runDetails: {
                    builder: { id: 'https://gitlab.com/group/project/-/runners/1' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'gitlab',
        providerLabel: 'GitLab CI',
      }),
    )
  })

  it('returns unknown provider for unrecognized builder ID', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  runDetails: {
                    builder: { id: 'https://james-crazy-fake-ci.43081j.com/builder' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'unknown',
        providerLabel: 'CI',
      }),
    )
  })

  it('returns Unknown label when builder ID is empty', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {},
              }),
            },
          },
        },
      ],
    })

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'unknown',
        providerLabel: 'Unknown',
      }),
    )
  })

  it('normalizes repository URL by removing trailing slash and .git', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  buildDefinition: {
                    externalParameters: {
                      workflow: {
                        repository: 'https://github.com/owner/repo.git/',
                        path: 'workflow.yml',
                      },
                    },
                    resolvedDependencies: [
                      {
                        digest: { gitCommit: 'abc123' },
                      },
                    ],
                  },
                  runDetails: {
                    builder: { id: 'https://github.com/actions/runner' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result?.sourceCommitUrl).toBe('https://github.com/owner/repo/commit/abc123')
    expect(result?.buildFileUrl).toBe('https://github.com/owner/repo/blob/main/workflow.yml')
  })

  it('uses ref from workflow for build file URL', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  buildDefinition: {
                    externalParameters: {
                      workflow: {
                        repository: 'https://github.com/owner/repo',
                        path: 'ci.yml',
                        ref: 'refs/tags/v2.0.0',
                      },
                    },
                  },
                  runDetails: {
                    builder: { id: 'https://github.com/actions/runner' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result?.buildFileUrl).toBe('https://github.com/owner/repo/blob/v2.0.0/ci.yml')
  })

  it('does not set buildSummaryUrl for non-URL invocation IDs', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  runDetails: {
                    builder: { id: 'https://github.com/actions/runner' },
                    metadata: { invocationId: 'not-a-url-just-an-id' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result?.buildSummaryUrl).toBeUndefined()
  })

  it('generates generic commit URL for non-GitHub/GitLab repositories', () => {
    const result = parseAttestationToProvenanceDetails({
      attestations: [
        {
          predicateType: SLSA_PROVENANCE_V1,
          bundle: {
            dsseEnvelope: {
              payload: encodePayload({
                predicate: {
                  buildDefinition: {
                    externalParameters: {
                      workflow: {
                        repository: 'https://bitbucket.org/owner/repo',
                        path: 'pipeline.yml',
                      },
                    },
                    resolvedDependencies: [
                      {
                        digest: { gitCommit: 'abc123' },
                      },
                    ],
                  },
                  runDetails: {
                    builder: { id: 'https://bitbucket.org/pipelines' },
                  },
                },
              }),
            },
          },
        },
      ],
    })

    expect(result?.sourceCommitUrl).toBe('https://bitbucket.org/owner/repo/commit/abc123')
    expect(result?.buildFileUrl).toBe('https://bitbucket.org/owner/repo/blob/main/pipeline.yml')
  })
})
