export class ZerionLimitReachedError extends Error {
  constructor(
    readonly current: number,
    readonly limit: number,
  ) {
    super(`Zerion limit reached | current: ${current} | limit: ${limit}`);
  }
}
