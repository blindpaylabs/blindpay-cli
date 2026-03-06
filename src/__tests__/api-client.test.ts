import { describe, test, expect } from 'bun:test'
import { resolveContext } from '../utils/api-client'

function saveEnv(...keys: string[]) {
  const saved = new Map<string, string | undefined>()
  for (const key of keys)
    saved.set(key, process.env[key])
  return {
    restore() {
      for (const [key, val] of saved) {
        if (val !== undefined) process.env[key] = val
        else delete process.env[key]
      }
    },
  }
}

describe('api-client', () => {
  test('resolveContext throws when no config is set', () => {
    const env = saveEnv('BLINDPAY_API_KEY', 'BLINDPAY_INSTANCE_ID', 'XDG_CONFIG_HOME')
    delete process.env.BLINDPAY_API_KEY
    delete process.env.BLINDPAY_INSTANCE_ID
    process.env.XDG_CONFIG_HOME = '/tmp/blindpay-cli-test-no-config-' + Date.now()

    try {
      expect(() => resolveContext()).toThrow('No API key configured')
    }
    finally {
      env.restore()
    }
  })

  test('resolveContext uses env vars', () => {
    const env = saveEnv('BLINDPAY_API_KEY', 'BLINDPAY_INSTANCE_ID', 'BLINDPAY_API_URL')
    process.env.BLINDPAY_API_KEY = 'sk_test_key'
    process.env.BLINDPAY_INSTANCE_ID = 'inst_test'
    delete process.env.BLINDPAY_API_URL

    try {
      const ctx = resolveContext()
      expect(ctx.instanceId).toBe('inst_test')
      expect(ctx.headers.Authorization).toBe('Bearer sk_test_key')
      expect(ctx.baseUrl).toBe('https://api.blindpay.com')
    }
    finally {
      env.restore()
    }
  })

  test('resolveContext uses custom base URL from env', () => {
    const env = saveEnv('BLINDPAY_API_KEY', 'BLINDPAY_INSTANCE_ID', 'BLINDPAY_API_URL')
    process.env.BLINDPAY_API_KEY = 'sk_test_key'
    process.env.BLINDPAY_INSTANCE_ID = 'inst_test'
    process.env.BLINDPAY_API_URL = 'https://custom.example.com/'

    try {
      const ctx = resolveContext()
      expect(ctx.baseUrl).toBe('https://custom.example.com')
    }
    finally {
      env.restore()
    }
  })

  test('resolveContext includes User-Agent and X-Blindpay-Client headers', () => {
    const env = saveEnv('BLINDPAY_API_KEY', 'BLINDPAY_INSTANCE_ID')
    process.env.BLINDPAY_API_KEY = 'sk_test_key'
    process.env.BLINDPAY_INSTANCE_ID = 'inst_test'

    try {
      const ctx = resolveContext()
      expect(ctx.headers['User-Agent']).toMatch(/^blindpay-cli\//)
      expect(ctx.headers['X-Blindpay-Client']).toBe('cli')
    }
    finally {
      env.restore()
    }
  })
})
