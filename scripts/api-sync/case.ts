/** snake_case -> camelCase, matching commander's own flag->property casing. */
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/gi, (_, c: string) => c.toUpperCase())
}

/** snake_case -> kebab-case, for `--flag-name` option strings. */
export function snakeToKebab(s: string): string {
  return s.replace(/_/g, '-')
}

/** snake_case -> "Title Case Words", for auto-generated help text / descriptions. */
export function snakeToTitle(s: string): string {
  return s
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
