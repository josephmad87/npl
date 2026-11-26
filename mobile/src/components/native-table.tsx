import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SiteLink } from './app-link'
import { colors } from '../theme'

export type TableRow = { id: string | number; cells: string[]; path?: string; detail?: string }

export function NativeTable({ columns, rows }: { columns: string[]; rows: TableRow[] }) {
  const { width, fontScale } = useWindowDimensions()
  const names = [...new Set([columns[0], ...rows.map(row => row.cells[0])])]
  return <MeasuredTable key={names.join('\n') + fontScale} columns={columns} rows={rows}
    names={names} fontScale={fontScale} initialWidth={Math.min(width - 36, 760)} />
}

function MeasuredTable({ columns, rows, names, fontScale, initialWidth }: {
  columns: string[]; rows: TableRow[]; names: string[]; fontScale: number; initialWidth: number
}) {
  const [nameWidth, setNameWidth] = useState(0)
  const [tableWidth, setTableWidth] = useState(initialWidth)
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({})
  const firstWidth = Math.min(Math.max(64, Math.ceil(nameWidth || Math.max(...names.map(name => name.length)) * 7 * fontScale) + 15),
    Math.floor(tableWidth * 0.53))
  const numberColumns = columns.slice(1)
  const widths = numberColumns.map((label, index) =>
    Math.max(28, Math.ceil((Math.max(label.length, ...rows.map(row => row.cells[index + 1]?.length || 0)) * 8 + 11) * fontScale)))
  const surplus = Math.max(0, tableWidth - firstWidth - widths.reduce((sum, value) => sum + value, 0) - 2)
  const headerHeight = Math.ceil(Math.max(36, 18 * fontScale + 14))
  const rowHeight = (row: TableRow) => Math.ceil(Math.max(42, (contentHeights[row.id] || (row.detail ? 32 : 17) * fontScale) + 14))

  return <View style={styles.shell} onLayout={event => setTableWidth(Math.floor(event.nativeEvent.layout.width))}>
    <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {names.map(name => <Text key={name} style={styles.name} onLayout={event => {
        const width = event.nativeEvent.layout.width
        setNameWidth(previous => Math.max(previous, width))
      }}>{name}</Text>)}
    </View>
    <View style={{ width: firstWidth }}>
      <View style={[styles.row, styles.header, styles.nameCell, { height: headerHeight }]}>
        <Text style={styles.headerText} accessibilityRole="header">{columns[0]}</Text>
      </View>
      {rows.map((row, index) => {
        const label = [row.cells[0], row.detail, ...row.cells.slice(1).map((value, i) => numberColumns[i] + ' ' + value)].filter(Boolean).join(', ')
        return <View key={row.id} style={[styles.row, styles.nameCell, index % 2 === 1 && styles.alternate, { minHeight: rowHeight(row) }]}>
          <View onLayout={event => {
            const height = Math.ceil(event.nativeEvent.layout.height)
            setContentHeights(previous => previous[row.id] === height ? previous : { ...previous, [row.id]: height })
          }}>
            {row.path ? <SiteLink path={row.path} style={[styles.name, styles.link]} accessibilityLabel={label}>{row.cells[0]}</SiteLink>
              : <Text style={styles.name} accessibilityLabel={label}>{row.cells[0]}</Text>}
            {row.detail ? <Text style={styles.detail} accessibilityElementsHidden importantForAccessibility="no">{row.detail}</Text> : null}
          </View>
        </View>
      })}
    </View>
    <ScrollView horizontal directionalLockEnabled keyboardShouldPersistTaps="handled" style={styles.numberPane}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View>
        <View style={[styles.row, styles.header, styles.numberRow, { height: headerHeight }]}>
          {numberColumns.map((label, i) => <Text key={label} style={[styles.headerText, styles.numberCell, i > 0 && styles.right,
            { width: widths[i] + surplus / numberColumns.length }]}>{label}</Text>)}
        </View>
        {rows.map((row, index) => <View key={row.id} style={[styles.row, styles.numberRow, index % 2 === 1 && styles.alternate, { height: rowHeight(row) }]}>
          {row.cells.slice(1).map((value, i) => <Text key={i} numberOfLines={1} style={[styles.number, styles.numberCell, i > 0 && styles.right,
            { width: widths[i] + surplus / numberColumns.length }]}>{value}</Text>)}
        </View>)}
      </View>
    </ScrollView>
  </View>
}

const styles = StyleSheet.create({
  shell: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  measure: { position: 'absolute', width: 2400, opacity: 0, alignItems: 'flex-start' },
  row: { justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  nameCell: { paddingHorizontal: 8, paddingVertical: 6 },
  numberPane: { flex: 1 },
  numberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  header: { backgroundColor: colors.brandTint },
  alternate: { backgroundColor: '#fcf8f5' },
  headerText: { fontSize: 12, color: colors.muted, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  link: { color: colors.accent },
  detail: { color: colors.muted, fontSize: 11 },
  number: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
  numberCell: { paddingHorizontal: 3 },
  right: { textAlign: 'right' },
})
