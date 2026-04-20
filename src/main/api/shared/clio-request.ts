/** Shape of ClioAPIClient.makeRequest for use by endpoint modules. */
export type ClioRequestFn = (
  endpoint: string,
  options?: RequestInit
) => Promise<{ data: unknown; error?: string }>
