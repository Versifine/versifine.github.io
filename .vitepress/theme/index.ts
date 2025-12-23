// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './style.css'
import Playlist from './components/Playlist.vue'
import CounterButton from './components/CounterButton.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('Playlist', Playlist)
    app.component('CounterButton', CounterButton)
  }
}
