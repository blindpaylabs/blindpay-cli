/** Structured events extracted from the changelog produced by blindpay-v2's
 * `scripts/spec-diff.ts`. Every event kind maps 1:1 to a bullet format
 * that script emits — see parse-changelog.ts for the exact patterns. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string

export interface FieldChangeEvent {
  kind: 'field-added' | 'field-removed'
  path: string
  method: HttpMethod
  section: 'request' | 'response'
  field: string
  type?: string
  required?: boolean
}

export interface EnumChangeEvent {
  kind: 'enum-changed'
  path: string
  method: HttpMethod
  section: 'request' | 'response'
  field: string
  added: string[]
  removed: string[]
}

export interface GlobalEnumChangeEvent {
  kind: 'global-enum-changed'
  field: string
  added: string[]
  removed: string[]
}

export interface EndpointChangeEvent {
  kind: 'endpoint-added' | 'endpoint-removed' | 'method-added' | 'method-removed'
  path: string
  method: HttpMethod
}

export interface SchemaChangeEvent {
  kind: 'schema-added' | 'schema-removed'
  name: string
}

export interface OtherFieldChangeEvent {
  kind: 'type-changed' | 'required-changed'
  path: string
  method: HttpMethod
  section: 'request' | 'response'
  field: string
  detail: string
}

export type ChangelogEvent =
  | FieldChangeEvent
  | EnumChangeEvent
  | GlobalEnumChangeEvent
  | EndpointChangeEvent
  | SchemaChangeEvent
  | OtherFieldChangeEvent
