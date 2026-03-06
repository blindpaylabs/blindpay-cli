import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CONFIG_DIR_NAME = 'blindpay'
const CONFIG_FILE_NAME = 'config.json'
const CONFIG_FILE_MODE = 0o600

export interface ConfigData {
  api_key: string | null
  instance_id: string | null
  base_url: string | null
}

const defaultConfig: ConfigData = {
  api_key: null,
  instance_id: null,
  base_url: null,
}

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg)
    return path.join(xdg, CONFIG_DIR_NAME)
  const home = os.homedir()
  return path.join(home, '.config', CONFIG_DIR_NAME)
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME)
}

function readConfigFile(): Partial<ConfigData> {
  const filePath = getConfigPath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw) as Partial<ConfigData>
    return {
      api_key: data.api_key ?? null,
      instance_id: data.instance_id ?? null,
      base_url: data.base_url ?? null,
    }
  }
  catch {
    return {}
  }
}

function writeConfigFile(data: ConfigData): void {
  const dir = getConfigDir()
  const filePath = getConfigPath()
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: CONFIG_FILE_MODE })
}

/**
 * Returns merged config: file defaults with env var overrides.
 * Env: BLINDPAY_API_KEY, BLINDPAY_INSTANCE_ID, BLINDPAY_API_URL
 */
export function getConfig(): ConfigData {
  const fromFile = readConfigFile()
  return {
    api_key: process.env.BLINDPAY_API_KEY ?? fromFile.api_key ?? null,
    instance_id: process.env.BLINDPAY_INSTANCE_ID ?? fromFile.instance_id ?? null,
    base_url: process.env.BLINDPAY_API_URL ?? fromFile.base_url ?? null,
  }
}

/**
 * Update config file with provided values (only set keys that are defined).
 * Env vars override at read time; this only persists to file.
 */
export function setConfig(updates: Partial<ConfigData>): void {
  const current = readConfigFile()
  const next: ConfigData = {
    api_key: updates.api_key !== undefined ? updates.api_key : (current.api_key ?? defaultConfig.api_key),
    instance_id: updates.instance_id !== undefined ? updates.instance_id : (current.instance_id ?? defaultConfig.instance_id),
    base_url: updates.base_url !== undefined ? updates.base_url : (current.base_url ?? defaultConfig.base_url),
  }
  writeConfigFile(next)
}

/**
 * Remove config file and directory if empty.
 */
export function clearConfig(): boolean {
  const filePath = getConfigPath()
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      const dir = getConfigDir()
      try {
        if (fs.readdirSync(dir).length === 0)
          fs.rmdirSync(dir)
      }
      catch {
        // ignore
      }
      return true
    }
  }
  catch {
    // ignore
  }
  return false
}

/**
 * Whether the config has enough to call the live API (api_key and instance_id).
 */
export function hasLiveConfig(): boolean {
  const c = getConfig()
  return Boolean(c.api_key && c.instance_id)
}
