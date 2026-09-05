export type TossDecision = 'bat' | 'bowl'

export type TossSummary = {
  teamName: string
  decision: TossDecision
}

export declare function formatTossSummary(value: string | null | undefined): string
export declare function parseTossSummary(value: string | null | undefined): TossSummary | null
