import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DIR = join(homedir(), '.blindpay')
const FILE = join(DIR, 'server.json')

export interface ServerState {
  pid: number
  port: number
}

export function getServerStatePath(): string {
  return FILE
}

export function readServerState(): ServerState | null {
  try {
    if (!existsSync(FILE)) return null
    const raw = readFileSync(FILE, 'utf-8')
    const data = JSON.parse(raw) as { pid?: number; port?: number }
    if (typeof data.pid === 'number' && typeof data.port === 'number') return { pid: data.pid, port: data.port }
    return null
  } catch {
    return null
  }
}

export function writeServerState(state: ServerState): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(state), 'utf-8')
}

export function removeServerState(): void {
  try {
    if (existsSync(FILE)) rmSync(FILE)
  } catch {
    // ignore
  }
}
