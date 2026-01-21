// .vitepress/config.mts
import { defineConfig, type DefaultTheme } from 'vitepress'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

type ThemeConfig = DefaultTheme.Config & {
  musicPlayer?: unknown
  musicPlaylist?: unknown
  friendLinks?: Array<{ name: string; link: string; avatar?: string }>
}

const NETEASE_PLAYLIST_ID = '4992471414'
const PLAYLIST_CACHE_TTL_MS = 12 * 60 * 60 * 1000

const CACHE_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'cache',
  'musicPlaylist.json'
)

const fetchJson = async (url: string) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 避免被当成“空 UA”的请求
        'User-Agent': 'Mozilla/5.0'
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const loadNeteasePlaylist = async (playlistId: string) => {
  try {
    // Prefer cache to make builds stable and fast.
    try {
      const raw = await readFile(CACHE_FILE_PATH, 'utf-8')
      const cached = JSON.parse(raw)
      const updatedAt = Number(cached?.updatedAt || 0)
      if (cached?.data && Number.isFinite(updatedAt) && Date.now() - updatedAt < PLAYLIST_CACHE_TTL_MS) {
        return cached.data
      }
    } catch {
      // ignore cache errors
    }

    const detail = await fetchJson(
      `https://music.163.com/api/v6/playlist/detail?id=${encodeURIComponent(playlistId)}`
    )

    const playlist = detail?.playlist
    const name = String(playlist?.name || '歌单')
    const trackIds: number[] = Array.isArray(playlist?.trackIds)
      ? playlist.trackIds.map((x: any) => Number(x?.id)).filter((n: number) => Number.isFinite(n))
      : []

    // 站内展示只需要前 50 首，避免构建慢/请求多
    const limitedTrackIds = trackIds.slice(0, 50)

    const songsById = new Map<number, any>()
    if (Array.isArray(playlist?.tracks)) {
      for (const s of playlist.tracks) {
        const id = Number(s?.id)
        if (Number.isFinite(id)) songsById.set(id, s)
      }
    }

    const missing = limitedTrackIds.filter((id) => !songsById.has(id))
    for (const group of chunk(missing, 100)) {
      const url = `https://music.163.com/api/song/detail?ids=[${group.join(',')}]`
      const data = await fetchJson(url)
      if (Array.isArray(data?.songs)) {
        for (const s of data.songs) {
          const id = Number(s?.id)
          if (Number.isFinite(id)) songsById.set(id, s)
        }
      }
    }

    const tracks = limitedTrackIds
      .map((id) => {
        const s = songsById.get(id)
        if (!s) return null
        const artists = Array.isArray(s?.ar) ? s.ar.map((a: any) => a?.name).filter(Boolean).join(' / ') : ''
        const album = String(s?.al?.name || '')
        return {
          id,
          title: String(s?.name || ''),
          artists,
          album,
          duration: formatDuration(Number(s?.dt || 0))
        }
      })
      .filter(Boolean)

    return {
      id: playlistId,
      name,
      tracks
    }
  } catch {
    return {
      id: playlistId,
      name: '歌单',
      tracks: []
    }
  }
}

const musicPlaylist = await loadNeteasePlaylist(NETEASE_PLAYLIST_ID)
// Write cache best-effort (kept here to avoid duplicating data assembly)
try {
  const dir = dirname(CACHE_FILE_PATH)
  await mkdir(dir, { recursive: true })
  await writeFile(
    CACHE_FILE_PATH,
    JSON.stringify({ updatedAt: Date.now(), data: musicPlaylist }, null, 2),
    'utf-8'
  )
} catch {
  // ignore
}

export default defineConfig({
  title: "VerSite",
  description: "Versifine的学习路径与知识库",
  markdown: {
    math: true
  },
  base: (() => {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
    if (!repo) return '/'
    // User/Org pages repo: <name>.github.io should be served at root.
    if (repo.toLowerCase().endsWith('.github.io')) return '/'
    // Project pages: served under /<repo>/
    return `/${repo}/`
  })(),
  appearance: 'force-dark', // 强制开启深色模式
  head: [
    ['link', { rel: 'icon', type: 'image/jpeg', href: '/logo.jpg' }],
    ['link', { rel: 'shortcut icon', type: 'image/jpeg', href: '/logo.jpg' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.jpg' }],
    [
      'script',
      {
        async: '',
        src: 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
      }
    ]
  ],

  // 网页头部配置
  themeConfig: ({
  // 网站 Logo（如果有图片放在 public 目录下，这里填路径，如 '/logo.png'）
  logo: '/logo.jpg',

    // 顶部导航栏 (Nav)
    nav: [
      { text: '首页', link: '/' },
      { text: 'Golang', link: '/golang/index' },
      { text: 'CS DIY', link: '/csdiy/index' },
      { text: '前端/全栈', link: '/frontend/index' },
      { text: '音乐', link: '/music' },
      { text: '关于我', link: '/about' }
    ],

    // 侧边栏 (Sidebar) - 不同路径显示不同侧边栏
    sidebar: {
      '/golang/': [
        {
          text: 'Golang 学习',
          items: [
            { text: '基础语法', link: '/golang/basics' },
            { 
              text: '并发编程', 
              link: '/golang/concurrency',
              items: [
                { text: 'Mutex 深入解析', link: '/golang/mutex-deep-dive' },
                { text: 'Channel 死锁实战', link: '/golang/channel-deadlock' },
                { text: 'Goroutine 泄漏避坑', link: '/golang/goroutine-leak' },
                { text: 'Runtime 死锁检测', link: '/golang/runtime-deadlock' },
              ]
            },
            { text: 'Web 开发', link: '/golang/web' },
          ]
        }
      ],
      '/csdiy/': [
        {
          text: 'CS DIY 路线',
          items: [
            { 
              text: '计算机组成原理', 
              link: '/csdiy/arch',
              items: [
                { text: 'CMU 15-213', link: '/csdiy/cmu-15-213' },
              ]
            },
            { text: '操作系统', link: '/csdiy/os' },
            { text: '计算机网络', link: '/csdiy/network' },
            { text: '分布式系统', link: '/csdiy/distributed' }
          ]
        }
      ],
      '/frontend/': [
        {
          text: '前端基础',
          items: [
            { text: 'HTML & CSS', link: '/frontend/html-css' },
            { text: 'JavaScript', link: '/frontend/javascript' }
          ]
        },
        {
          text: '框架学习',
          items: [
            { text: 'Vue.js', link: '/frontend/vue' },
            { text: 'React', link: '/frontend/react' }
          ]
        }
      ],
      '/backend/': [
        {
          text: '后端技术',
          items: [
            { text: 'Node.js', link: '/backend/nodejs' },
            { text: 'Database', link: '/backend/database' }
          ]
        }
      ]
    },

    // 社交链接 (显示在右上角)
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Versifine' },
      { icon: 'x', link: 'https://x.com/Versifine_' },
      { 
        icon: { 
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.813 4.653h.854q2.266.08 3.773 1.574Q23.946 7.72 24 9.987v7.36q-.054 2.266-1.56 3.773c-1.506 1.507-2.262 1.524-3.773 1.56H5.333q-2.266-.054-3.773-1.56C.053 19.614.036 18.858 0 17.347v-7.36q.054-2.267 1.56-3.76t3.773-1.574h.774l-1.174-1.12a1.23 1.23 0 0 1-.373-.906q0-.534.373-.907l.027-.027q.4-.373.92-.373t.92.373L9.653 4.44q.107.106.187.213h4.267a.8.8 0 0 1 .16-.213l2.853-2.747q.4-.373.92-.373c.347 0 .662.151.929.4s.391.551.391.907q0 .532-.373.906zM5.333 7.24q-1.12.027-1.88.773q-.76.748-.786 1.894v7.52q.026 1.146.786 1.893t1.88.773h13.334q1.12-.026 1.88-.773t.786-1.893v-7.52q-.026-1.147-.786-1.894t-1.88-.773zM8 11.107q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.37 -.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q0-.56.386-.947q.387-.386.947-.386m8 0q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.37 -.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q.025-.586.4-.96q.373-.373.933-.373"/></svg>' 
        }, 
        link: 'https://space.bilibili.com/413435933',
        ariaLabel: 'Bilibili'
      },
      { 
        icon: { 
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13.046 9.388a4 4 0 0 0-.66.19c-.809.312-1.447.991-1.666 1.775a2.3 2.3 0 0 0-.074.81a1.85 1.85 0 0 0 .764 1.35a1.483 1.483 0 0 0 2.01-.286c.406-.531.355-1.183.24-1.636c-.098-.387-.22-.816-.345-1.249a65 65 0 0 1-.269-.954m-.82 10.07c-3.984 0-7.224-3.24-7.224-7.223c0-.98.226-3.02 1.884-4.822A7.2 7.2 0 0 1 9.502 5.6a.792.792 0 1 1 .587 1.472a5.62 5.62 0 0 0-2.795 2.462a5.54 5.54 0 0 0-.707 2.7a5.645 5.645 0 0 0 5.638 5.638c1.844 0 3.627-.953 4.542-2.428c1.042-1.68.772-3.931-.627-5.238a3.3 3.3 0 0 0-1.437-.777c.172.589.334 1.18.494 1.772c.284 1.12.1 2.181-.519 2.989c-.39.51-.956.888-1.592 1.064a3.04 3.04 0 0 1-2.58-.44a3.45 3.45 0 0 1-1.44-2.514c-.04-.467.002-.93.128-1.376c.35-1.256 1.356-2.339 2.622-2.826a5.5 5.5 0 0 1 .823-.246l-.134-.505c-.37-1.371.25-2.579 1.547-3.007a2.4 2.4 0 0 1 1.025-.105c.792.09 1.476.592 1.709 1.023c.258.507-.096 1.153-.706 1.153a.8.8 0 0 1-.54-.213c-.088-.08-.163-.174-.259-.247a.83.83 0 0 0-.632-.166a.81.81 0 0 0-.634.551c-.056.191-.031.406.02.595c.07.256.159.597.217.82c1.11.098 2.162.54 2.97 1.296c1.974 1.844 2.35 4.886.892 7.233c-1.197 1.93-3.509 3.177-5.889 3.177zM0 12c0 6.627 5.373 12 12 12s12-5.373 12-12S18.627 0 12 0S0 5.373 0 12"/></svg>' 
        }, 
        link: 'https://music.163.com/#/user/home?id=3312091208',
        ariaLabel: 'NetEase Music'
      },
      { 
        icon: { 
          svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/></svg>' 
        }, 
        link: 'mailto:versifine@163.com',
        ariaLabel: 'Email'
      }
    ],

    // 悬浮音乐播放器（网易云外链播放器）
    musicPlayer: {
      provider: 'netease',
      title: '博客音乐分享',
      netease: {
        // 歌单：https://music.163.com/playlist?id=4992471414
        type: 0,
        id: '4992471414',
        auto: 0,
        height: 430
      }
    },

    // 用于站内展示的“完整歌单列表”（点击跳转网易云播放）
    musicPlaylist,

    // 首页友链（用于右侧小侧栏展示）
    friendLinks: [
      { name: 'zincs.art', link: 'https://zincs.art' },
      { name: 'anontokyo114.top', link: 'https://anontokyo114.top' },
      { name: 'hez2z.github.io', link: 'https://hez2z.github.io' },
      { name: 'qingke12138.top', link: 'https://www.qingke12138.top' }
    ],

    // 页脚
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Versifine'
    },

    // 开启本地搜索 (非常实用)
    search: {
      provider: 'local'
    }
  } as ThemeConfig)
})
