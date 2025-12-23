// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './style.css'
import Playlist from './components/Playlist.vue'
import CounterButton from './components/CounterButton.vue'

const BUSUANZI_SRC = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'

const refreshBusuanzi = () => {
  if (typeof window === 'undefined') return

  const w = window as any
  const busuanzi = w.Busuanzi || w.busuanzi
  if (busuanzi && typeof busuanzi.fetch === 'function') {
    busuanzi.fetch()
    return
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src^="${BUSUANZI_SRC}"]`)
  if (existing) existing.remove()

  const script = document.createElement('script')
  script.async = true
  script.src = `${BUSUANZI_SRC}?_=${Date.now()}`
  document.head.appendChild(script)
}

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp?.(ctx)

    const { app, router } = ctx
    app.component('Playlist', Playlist)
    app.component('CounterButton', CounterButton)

    if (typeof window !== 'undefined') {
      const prev = router.onAfterRouteChanged
      router.onAfterRouteChanged = (to) => {
        prev?.(to)
        // Wait for DOM update then refresh counters.
        setTimeout(refreshBusuanzi, 0)
      }
    }
  }
}
