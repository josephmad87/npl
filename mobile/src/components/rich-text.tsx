import { useMemo, type ReactNode } from 'react'
import { DomUtils, parseDocument } from 'htmlparser2'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { SiteLink } from './app-link'
import { NativeTable } from './native-table'
import { MediaImage, NativeMedia, youtubeVideoId } from './native-media'
import { nplPath } from '../lib/native-path'
import { ui } from './native-ui'
import { colors } from '../theme'

const skippedTags = new Set(['script', 'style', 'noscript', 'object', 'form', 'input'])
const blockTags = new Set(['p', 'div', 'section', 'sectionbreak', 'blockquote', 'figure', 'figcaption', 'pre', 'ul', 'ol', 'table', 'img', 'iframe', 'video', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'])
const { isTag, isText } = DomUtils
type AnyNode = ReturnType<typeof parseDocument>['children'][number]
type Element = Extract<AnyNode, { attribs: Record<string, string> }>

function textOf(node: AnyNode): string {
  return isText(node) ? node.data : isTag(node) && !skippedTags.has(node.name)
    ? node.children.map(textOf).join('') : ''
}

export function plainText(value?: string | null): string {
  return value ? parseDocument(value).children.map(textOf).join(' ').replace(/\s+/g, ' ').trim() : ''
}

function renderLink(node: Element, key: string, children: ReactNode, basePath: string) {
  const href = node.attribs.href?.trim()
  if (!href) return <Text key={key}>{children}</Text>
  if (/^(mailto:|tel:)/i.test(href)) return <Text key={key} accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(href).catch(() => undefined)}>{children}</Text>
  if (href.startsWith('//')) return <Text key={key}>{children}</Text>
  let target = href
  const base = 'https://npl.co.zw' + (href.startsWith('/') ? '' : basePath)
  if (!/^[a-z][\w+.-]*:/i.test(href)) {
    if (href[0] === '#' || href[0] === '?') target = base + href
    else {
      const folder = href.startsWith('/') ? base : base.slice(0, base.lastIndexOf('/') + 1)
      try { target = new URL(href, folder).href } catch { /* Keep the link label. */ }
    }
  }
  const path = nplPath(target)
  if (path) return <SiteLink key={key} path={path} style={styles.link}>{children}</SiteLink>
  return <Text key={key}>{children}</Text>
}

function inline(node: AnyNode, key: string, basePath: string): ReactNode {
  if (isText(node)) return node.data
  if (!isTag(node) || skippedTags.has(node.name)) return null
  if (node.name === 'br') return '\n'
  const content = node.children.map((child, index) => inline(child, key + '-' + index, basePath))
  if (node.name === 'a') return renderLink(node, key, content, basePath)
  if (node.name === 'strong' || node.name === 'b') return <Text key={key} style={styles.bold}>{content}</Text>
  if (node.name === 'em' || node.name === 'i') return <Text key={key} style={styles.italic}>{content}</Text>
  if (node.name === 'u') return <Text key={key} style={styles.underline}>{content}</Text>
  return <Text key={key}>{content}</Text>
}

function tableRows(element: Element): string[][] {
  return element.children.flatMap(child => {
    if (!isTag(child)) return []
    if (child.name === 'tr') return [child.children.filter(node => isTag(node) && (node.name === 'td' || node.name === 'th')).map(textOf)]
    return ['thead', 'tbody', 'tfoot'].includes(child.name) ? tableRows(child) : []
  })
}

function blocks(nodes: AnyNode[], prefix: string, basePath: string): ReactNode[] {
  const views: ReactNode[] = []
  let buffer: AnyNode[] = []
  function flush() {
    if (buffer.some(node => isText(node) ? Boolean(node.data.trim()) : isTag(node))) {
      const key = prefix + '-text-' + views.length
      views.push(<Text key={key} style={ui.text}>{buffer.map((node, index) => inline(node, key + '-' + index, basePath))}</Text>)
    }
    buffer = []
  }
  for (const node of nodes) {
    if (!isTag(node) || !blockTags.has(node.name)) {
      buffer.push(node)
      continue
    }
    flush()
    const key = prefix + '-block-' + views.length
    const tag = node.name
    if (tag === 'img') {
      views.push(<MediaImage key={key} source={node.attribs.src} label={node.attribs.alt} />)
    } else if (tag === 'iframe' || tag === 'video') {
      const childSource = node.children.find(child => isTag(child) && child.name === 'source') as Element | undefined
      const source = node.attribs.src || childSource?.attribs.src
      if (source && (tag === 'video' || youtubeVideoId(source))) views.push(<NativeMedia key={key} source={source} />)
    } else if (tag === 'ul' || tag === 'ol') {
      views.push(<View key={key} style={styles.list}>{node.children.filter(child => isTag(child) && child.name === 'li').map((child, index) =>
        <View key={index} style={styles.bulletRow}>
          <Text accessible={false} style={ui.text}>{tag === 'ol' ? String(index + 1) + '.' : '•'}</Text>
          <View style={styles.flex}>{blocks((child as Element).children, key + '-' + index, basePath)}</View>
        </View>)}</View>)
    } else if (tag === 'table') {
      const [header, ...rows] = tableRows(node)
      if (header?.length) views.push(<NativeTable key={key} columns={header.map((value, index) => value || 'Column ' + (index + 1))}
        rows={rows.map((cells, id) => ({ id, cells: header.map((_, index) => cells[index] || '') }))} />)
    } else if (/^h[1-6]$/.test(tag)) {
      views.push(<Text key={key} accessibilityRole="header" style={ui.heading}>{node.children.map((child, index) => inline(child, key + '-' + index, basePath))}</Text>)
    } else if (tag === 'figcaption') {
      views.push(<Text key={key} style={ui.muted}>{textOf(node)}</Text>)
    } else if (tag === 'hr') {
      views.push(<View key={key} style={ui.divider} />)
    } else {
      views.push(<View key={key} style={tag === 'blockquote' ? [ui.panel, ui.soft] : styles.stack}>{blocks(node.children, key, basePath)}</View>)
    }
  }
  flush()
  return views
}

export function RichText({ content, basePath = '/' }: { content?: string | null; basePath?: string }) {
  const parsed = useMemo(() => content ? parseDocument(content).children : [], [content])
  if (!parsed.length) return null
  return <View style={styles.stack}>{blocks(parsed, 'rich', basePath)}</View>
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  link: { color: colors.accent, textDecorationLine: 'underline', fontWeight: '600' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  list: { gap: 7, paddingLeft: 8 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
})
