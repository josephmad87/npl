/** Simulated network delay for TanStack Query demos before the FastAPI backend exists. */
export function mockDelay<T>(data: T, ms = 320): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), ms)
  })
}
