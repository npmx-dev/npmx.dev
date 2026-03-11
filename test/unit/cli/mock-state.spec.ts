import { describe, expect, it, beforeEach } from 'vitest'
import { MockConnectorStateManager, createMockConnectorState } from '../../../cli/src/mock-state.ts'

function createManager() {
  const data = createMockConnectorState({ token: 'test-token', npmUser: 'testuser' })
  return new MockConnectorStateManager(data)
}

describe('MockConnectorStateManager: executeOperations', () => {
  let manager: MockConnectorStateManager

  beforeEach(() => {
    manager = createManager()
    manager.connect('test-token')
  })

  it('returns authFailure when a configured result has authFailure', () => {
    const op = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    manager.approveOperation(op.id)

    const result = manager.executeOperations({
      results: {
        [op.id]: {
          exitCode: 1,
          stderr: 'auth failure',
          authFailure: true,
        },
      },
    })

    expect(result.authFailure).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]!.result.authFailure).toBe(true)
  })

  it('returns authFailure as undefined when no operations have auth failures', () => {
    const op = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    manager.approveOperation(op.id)

    const result = manager.executeOperations()

    // Default success path -- no auth failure
    expect(result.authFailure).toBeFalsy()
  })

  it('collects and deduplicates urls from operation results', () => {
    const op1 = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    const op2 = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'bob', role: 'developer' },
      description: 'Add bob',
      command: 'npm org set myorg bob developer',
    })
    manager.approveOperation(op1.id)
    manager.approveOperation(op2.id)

    const result = manager.executeOperations({
      results: {
        [op1.id]: {
          exitCode: 0,
          stdout: 'ok',
          urls: ['https://npmjs.com/auth/abc'],
        },
        [op2.id]: {
          exitCode: 0,
          stdout: 'ok',
          urls: ['https://npmjs.com/auth/abc', 'https://npmjs.com/auth/def'],
        },
      },
    })

    expect(result.urls).toBeDefined()
    // Should be deduplicated
    expect(result.urls).toEqual(['https://npmjs.com/auth/abc', 'https://npmjs.com/auth/def'])
  })

  it('returns urls as undefined when no operations have urls', () => {
    const op = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    manager.approveOperation(op.id)

    const result = manager.executeOperations()

    expect(result.urls).toBeUndefined()
  })

  it('returns otpRequired when a configured result requires OTP and none provided', () => {
    const op = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    manager.approveOperation(op.id)

    const result = manager.executeOperations({
      results: {
        [op.id]: {
          exitCode: 1,
          stderr: 'otp required',
          requiresOtp: true,
        },
      },
    })

    expect(result.otpRequired).toBe(true)
  })

  it('returns both authFailure and urls together', () => {
    const op1 = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'alice', role: 'developer' },
      description: 'Add alice',
      command: 'npm org set myorg alice developer',
    })
    const op2 = manager.addOperation({
      type: 'org:add-user',
      params: { org: 'myorg', user: 'bob', role: 'developer' },
      description: 'Add bob',
      command: 'npm org set myorg bob developer',
    })
    manager.approveOperation(op1.id)
    manager.approveOperation(op2.id)

    const result = manager.executeOperations({
      results: {
        [op1.id]: {
          exitCode: 1,
          stderr: 'auth failure',
          authFailure: true,
          urls: ['https://npmjs.com/login'],
        },
        [op2.id]: {
          exitCode: 0,
          stdout: 'ok',
        },
      },
    })

    expect(result.authFailure).toBe(true)
    expect(result.urls).toEqual(['https://npmjs.com/login'])
  })
})
