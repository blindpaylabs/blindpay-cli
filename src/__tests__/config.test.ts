import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getConfig, setConfig, clearConfig, getConfigPath, hasLiveConfig } from '../utils/config'

const TEST_DIR = path.join(os.tmpdir(), `blindpay-cli-test-${Date.now()}`)
const TEST_CONFIG_DIR = path.join(TEST_DIR, 'blindpay')

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = TEST_DIR
  delete process.env.BLINDPAY_API_KEY
  delete process.env.BLINDPAY_INSTANCE_ID
  delete process.env.BLINDPAY_API_URL
  if (fs.existsSync(TEST_CONFIG_DIR))
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true })
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
  if (fs.existsSync(TEST_DIR))
    fs.rmSync(TEST_DIR, { recursive: true })
})

describe('config', () => {
  test('getConfigPath returns path under XDG_CONFIG_HOME', () => {
    const p = getConfigPath()
    expect(p).toBe(path.join(TEST_CONFIG_DIR, 'config.json'))
  })

  test('getConfig returns defaults when no config file exists', () => {
    const config = getConfig()
    expect(config.api_key).toBeNull()
    expect(config.instance_id).toBeNull()
    expect(config.base_url).toBeNull()
  })

  test('setConfig writes and getConfig reads back', () => {
    setConfig({ api_key: 'sk_test_123', instance_id: 'inst_abc' })
    const config = getConfig()
    expect(config.api_key).toBe('sk_test_123')
    expect(config.instance_id).toBe('inst_abc')
    expect(config.base_url).toBeNull()
  })

  test('setConfig merges with existing config', () => {
    setConfig({ api_key: 'sk_test_123' })
    setConfig({ instance_id: 'inst_abc' })
    const config = getConfig()
    expect(config.api_key).toBe('sk_test_123')
    expect(config.instance_id).toBe('inst_abc')
  })

  test('env vars override file config', () => {
    setConfig({ api_key: 'file_key', instance_id: 'file_id' })
    process.env.BLINDPAY_API_KEY = 'env_key'
    process.env.BLINDPAY_INSTANCE_ID = 'env_id'
    const config = getConfig()
    expect(config.api_key).toBe('env_key')
    expect(config.instance_id).toBe('env_id')
  })

  test('BLINDPAY_API_URL env var overrides base_url', () => {
    setConfig({ base_url: 'https://file.example.com' })
    process.env.BLINDPAY_API_URL = 'https://env.example.com'
    const config = getConfig()
    expect(config.base_url).toBe('https://env.example.com')
  })

  test('clearConfig removes config file', () => {
    setConfig({ api_key: 'sk_test_123' })
    expect(fs.existsSync(getConfigPath())).toBe(true)
    const result = clearConfig()
    expect(result).toBe(true)
    expect(fs.existsSync(getConfigPath())).toBe(false)
  })

  test('clearConfig returns false when no file exists', () => {
    const result = clearConfig()
    expect(result).toBe(false)
  })

  test('hasLiveConfig returns false with no config', () => {
    expect(hasLiveConfig()).toBe(false)
  })

  test('hasLiveConfig returns true with api_key and instance_id', () => {
    setConfig({ api_key: 'sk_test_123', instance_id: 'inst_abc' })
    expect(hasLiveConfig()).toBe(true)
  })

  test('hasLiveConfig returns false with only api_key', () => {
    setConfig({ api_key: 'sk_test_123' })
    expect(hasLiveConfig()).toBe(false)
  })

  test('config file has restricted permissions', () => {
    setConfig({ api_key: 'sk_test_123' })
    const stat = fs.statSync(getConfigPath())
    const mode = stat.mode & 0o777
    expect(mode).toBe(0o600)
  })
})
