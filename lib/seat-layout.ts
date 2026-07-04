export type SeatRow = {
  rowNumber: number
  left: string[]
  right: string[]
}

export type SeatLayout = {
  isSprinter: boolean
  rows: SeatRow[]
  rearSeatIds: string[]
  seatIds: string[]
  seatIdSet: Set<string>
}

export type TourBus = {
  id: string
  name: string
  capacity: number
  seats: string[]
}

export function normalizeSeatIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((seat) => String(seat).trim().toUpperCase()).filter(Boolean))]
}

function createSprinterSeatIds(capacity: number): string[] {
  const seatOrder: string[] = []

  for (const row of [1, 2, 3, 4, 5]) {
    seatOrder.push(`${row}A`, `${row}B`)
    if (row > 1) {
      seatOrder.push(`${row}C`)
    }
  }

  seatOrder.push('6A', '6B', '6C', '6D')

  const normalizedCapacity = Math.max(0, Math.floor(capacity))
  return seatOrder.slice(0, normalizedCapacity)
}

function createSprinterRows(seatIds: string[]): { rows: SeatRow[]; rearSeatIds: string[] } {
  const seatSet = new Set(seatIds)
  const rows: SeatRow[] = [1, 2, 3, 4, 5].map((rowNumber) => ({
    rowNumber,
    left: [`${rowNumber}A`, `${rowNumber}B`]
      .filter((id) => seatSet.has(id))
      .map((id) => id.slice(-1)),
    right: [rowNumber > 1 ? `${rowNumber}C` : '']
      .filter((id) => seatSet.has(id))
      .map((id) => id.slice(-1)),
  }))

  const rearSeatIds = ['6A', '6B', '6C', '6D'].filter((id) => seatSet.has(id))

  return {
    rows,
    rearSeatIds,
  }
}

function createBusRows(capacity: number): { rows: SeatRow[]; rearSeatIds: string[] } {
  const rearSeats = 6
  const bodyCapacity = Math.max(0, Math.floor(capacity) - rearSeats)
  const rows: SeatRow[] = []
  let remaining = bodyCapacity
  let rowNumber = 1

  while (remaining > 0) {
    const left: string[] = []
    const right: string[] = []

    if (remaining >= 1) left.push('A')
    if (remaining >= 2) left.push('B')
    if (remaining >= 3) right.push('D')
    if (remaining >= 4) right.push('E')

    rows.push({ rowNumber, left, right })
    remaining -= left.length + right.length
    rowNumber += 1
  }

  const rearCount = Math.min(rearSeats, Math.max(0, Math.floor(capacity) - bodyCapacity))
  const rearSeatIds = Array.from({ length: rearCount }, (_, index) => `R${index + 1}`)

  return {
    rows,
    rearSeatIds,
  }
}

export function createSeatLayout(capacity: number): SeatLayout {
  const normalizedCapacity = Math.max(0, Math.floor(capacity))
  const isSprinter = normalizedCapacity <= 20

  if (isSprinter) {
    const seatIds = createSprinterSeatIds(normalizedCapacity)
    const { rows, rearSeatIds } = createSprinterRows(seatIds)

    return {
      isSprinter,
      rows,
      rearSeatIds,
      seatIds,
      seatIdSet: new Set(seatIds),
    }
  }

  const { rows, rearSeatIds } = createBusRows(normalizedCapacity)
  const rowSeatIds = rows.flatMap(({ rowNumber, left, right }) => [
    ...left.map((letter) => `${rowNumber}${letter}`),
    ...right.map((letter) => `${rowNumber}${letter}`),
  ])

  const seatIds = [...rowSeatIds, ...rearSeatIds]

  return {
    isSprinter,
    rows,
    rearSeatIds,
    seatIds,
    seatIdSet: new Set(seatIds),
  }
}

export function sortSeatIdsByLayout(seatIds: string[], layoutSeatIds: string[]): string[] {
  const order = new Map(layoutSeatIds.map((seatId, index) => [seatId, index]))
  return [...seatIds].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER))
}

export function createBusId(index: number): string {
  return `bus_${Math.max(1, Math.floor(index))}`
}

export function createTourBus(index: number, capacity: number): TourBus {
  const normalizedCapacity = Math.max(1, Math.floor(capacity))
  return {
    id: createBusId(index),
    name: `Avtobus ${Math.max(1, Math.floor(index))}`,
    capacity: normalizedCapacity,
    seats: [],
  }
}

export function normalizeTourBuses(value: unknown, fallbackCapacity: number, fallbackSeats: unknown): TourBus[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        id: createBusId(1),
        name: 'Avtobus 1',
        capacity: Math.max(1, Math.floor(fallbackCapacity || 20)),
        seats: normalizeSeatIds(fallbackSeats),
      },
    ]
  }

  const normalized = value
    .map((item, index) => {
      const raw = (item ?? {}) as Partial<TourBus>
      const capacity = Math.max(1, Number(raw.capacity ?? fallbackCapacity ?? 20))
      const layout = createSeatLayout(capacity)
      const seats = sortSeatIdsByLayout(
        normalizeSeatIds(raw.seats).filter((seat) => layout.seatIdSet.has(seat)),
        layout.seatIds,
      )

      return {
        id: String(raw.id ?? createBusId(index + 1)),
        name: String(raw.name ?? `Avtobus ${index + 1}`),
        capacity,
        seats,
      } satisfies TourBus
    })
    .filter((bus) => bus.capacity > 0)

  return normalized.length > 0
    ? normalized
    : [
        {
          id: createBusId(1),
          name: 'Avtobus 1',
          capacity: Math.max(1, Math.floor(fallbackCapacity || 20)),
          seats: normalizeSeatIds(fallbackSeats),
        },
      ]
}
