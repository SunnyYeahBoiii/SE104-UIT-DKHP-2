const ONES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']

function belowHundred(value: number): string {
  const tens = Math.floor(value / 10)
  const ones = value % 10
  if (tens === 0) return ONES[ones]!
  const ten = tens === 1 ? 'mười' : `${ONES[tens]} mươi`
  if (ones === 0) return ten
  const last =
    ones === 5
      ? 'lăm'
      : ones === 1 && tens > 1
        ? 'mốt'
        : ones === 4 && tens > 1
          ? 'tư'
          : ONES[ones]!
  return `${ten} ${last}`
}

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  if (hundreds === 0) return belowHundred(rest)
  const prefix = `${ONES[hundreds]} trăm`
  if (rest === 0) return prefix
  return `${prefix} ${belowHundred(rest)}`
}

/** BM6/B.4.7: whole VND in words, e.g. 15_000_000 -> "Mười lăm triệu đồng chẵn". */
export function amountInWords(amount: bigint): string {
  if (amount < 0n) throw new RangeError('amount must be non-negative')
  if (amount === 0n) return 'Không đồng'

  const parts: string[] = []
  let rest = amount
  let scale = 0
  while (rest > 0n) {
    const group = Number(rest % 1000n)
    if (group > 0) parts.unshift(`${belowThousand(group)} ${SCALES[scale] ?? 'tỷ'}`.trim())
    rest /= 1000n
    scale++
  }
  const words = parts.join(' ')
  return `${words[0]!.toUpperCase()}${words.slice(1)} đồng${amount % 1000n === 0n ? ' chẵn' : ''}`
}
