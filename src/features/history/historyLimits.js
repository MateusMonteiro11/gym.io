export const HISTORY_LIMITS = Object.freeze({
  sessions: 5000,
  sets: 50000,
  sessionSets: 1000,
  cacheEntries: 8,
  evolutionPoints: 120,
  tablePageSize: 25,
  trendBuckets: 120,
})

export class HistoryVolumeLimitError extends Error {
  constructor(limit) {
    super('History exceeds the supported viewing limit')
    this.name = 'HistoryVolumeLimitError'
    this.code = 'HISTORY_VOLUME_LIMIT'
    this.limit = limit
  }
}

export const isHistoryVolumeLimit = (error) => error?.code === 'HISTORY_VOLUME_LIMIT'
