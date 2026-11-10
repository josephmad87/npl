import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { colors } from '../theme'

// App navigation replaces the website chrome; detail titles and content remain visible.
const APP_CHROME = `(function(){
  if(document.getElementById('npl-app-chrome'))return true;
  var style=document.createElement('style');style.id='npl-app-chrome';
  style.textContent='.site-header,.site-footer{display:none!important}.ui-page-hero{min-height:0!important;height:auto!important;background:#fcfbfb!important;padding:20px!important}.ui-page-hero>picture,.ui-page-hero>img,.ui-page-hero__brand-mark{display:none!important}.ui-page-hero-overlay{position:static!important;background:none!important;padding:0!important}.ui-page-hero h1{font-size:26px!important;line-height:1.2!important;color:#200001!important}.ui-page-hero p{font-size:14px!important;color:#564d4d!important}.app-layout-content{min-height:100vh!important}.match-centre-scorecard-table{font-size:.88rem!important;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}.match-centre-scorecard-table th,.match-centre-scorecard-table td,.innings-scorecard-panels__player-link{font-size:inherit!important;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}';
  style.textContent += '.bowling-scorecard-table{table-layout:auto!important;width:max-content!important;min-width:0!important}.bowling-scorecard-table col{width:auto!important}.bowling-scorecard-table th,.bowling-scorecard-table td{min-width:0!important;white-space:nowrap!important;padding-left:.5rem!important;padding-right:.5rem!important}.bowling-scorecard-table th:first-child,.bowling-scorecard-table td:first-child{padding-right:.25rem!important}';
  (document.head||document.documentElement).appendChild(style);return true;
})();`

export function sitePath(value: string) {
  // Only permit relative NPL routes; no protocol-relative or external URLs.
  try { const url = new URL(value, 'https://npl.co.zw'); return url.origin === 'https://npl.co.zw' ? url.pathname + url.search + url.hash : '/' } catch { return '/' }
}
export function SiteScreen({ path }: { path: string }) {
  const web = useRef<WebView<object>>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [failed, setFailed] = useState(false)
  const [uri, setUri] = useState(() => `https://npl.co.zw${sitePath(path)}`)
  const mainPage = useRef(uri)
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      web.current?.goBack(); return true
    })
    return () => listener.remove()
  }, [canGoBack])
  return <View style={styles.fill}>
    {failed ? <View style={styles.error}><Text style={styles.message} accessibilityRole="alert">This page could not load. Check your connection.</Text><Text accessibilityRole="button" style={styles.retry} onPress={() => { setFailed(false); web.current?.reload() }}>Try again</Text></View> : null}
    <WebView<object> ref={web} source={{ uri }} style={styles.fill}
      injectedJavaScript={APP_CHROME} onMessage={() => undefined}
      startInLoadingState renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.brand} accessibilityLabel="Loading NPL page" />}
      allowsBackForwardNavigationGestures setSupportMultipleWindows={false}
      onOpenWindow={event => {
        try {
          const next = new URL(event.nativeEvent.targetUrl)
          if (next.protocol === 'https:' && ['npl.co.zw', 'www.npl.co.zw'].includes(next.hostname)) setUri(next.href)
          else if (next.protocol === 'https:') void Linking.openURL(next.href).catch(() => undefined)
        } catch { /* Ignore malformed popup destinations. */ }
      }}
      onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
      onLoadStart={event => { mainPage.current = event.nativeEvent.url; setFailed(false) }} onError={() => setFailed(true)}
      onHttpError={event => { if (event.nativeEvent.statusCode >= 400 && event.nativeEvent.url === mainPage.current) setFailed(true) }}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank') return true
        let url: URL
        try { url = new URL(request.url) } catch { return false }
        if (url.protocol === 'https:' && ['npl.co.zw', 'www.npl.co.zw'].includes(url.hostname)) return true
        if (!request.isTopFrame && url.protocol === 'https:') return true
        if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) void Linking.openURL(request.url).catch(() => undefined)
        return false
      }} />
  </View>
}
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.background }, error: { padding: 24, gap: 8 }, message: { color: colors.ink }, retry: { color: colors.brand, fontSize: 17, paddingVertical: 12 } })
