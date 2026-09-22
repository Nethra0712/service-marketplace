/** Tooling that changes data by hand must never run against production. */
export function assertDevelopmentOnly(nodeEnv: string, what: string): void {
  if (nodeEnv === 'production') {
    throw new Error(`Refusing to run ${what} with NODE_ENV=production.`);
  }
}
