<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData, useRoute } from 'vitepress'
import { computed, ref, watch } from 'vue'

const { Layout } = DefaultTheme

const { theme } = useData()
const route = useRoute()

const isCustomMenuOpen = ref(false)

const audioRef = ref(null)
const isMusicPlaying = ref(false)
const musicError = ref(false)
const isMusicExpanded = ref(false)

const currentIndex = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.7)

const tracks = computed(() => {
  const cfg = theme.value?.musicPlayer
  const list = Array.isArray(cfg?.tracks) ? cfg.tracks : []
  if (list.length) {
    return list
      .map((t) => ({
        title: t?.title || 'BGM',
        src: String(t?.src || '')
      }))
      .filter((t) => t.src)
  }

  const fallbackSrc = String(cfg?.src || '')
  if (!fallbackSrc) return []
  return [{ title: cfg?.title || 'BGM', src: fallbackSrc }]
})

const playerProvider = computed(() => {
  const p = theme.value?.musicPlayer?.provider
  if (p === 'netease' || p === 'local') return p
  return tracks.value.length ? 'local' : 'netease'
})

const neteaseEmbedUrl = computed(() => {
  const cfg = theme.value?.musicPlayer?.netease
  const id = String(cfg?.id || '').trim()
  if (!id) return ''
  const type = Number.isFinite(cfg?.type) ? cfg.type : 0
  const auto = cfg?.auto ? 1 : 0
  const height = Number.isFinite(cfg?.height) ? cfg.height : 430
  return `https://music.163.com/outchain/player?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&auto=${encodeURIComponent(auto)}&height=${encodeURIComponent(height)}`
})

const currentTrack = computed(() => tracks.value[currentIndex.value])

const formatTime = (seconds) => {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const applyVolume = (v) => {
  const a = audioRef.value
  const next = Math.min(1, Math.max(0, Number(v)))
  volume.value = Number.isFinite(next) ? next : 0.7
  if (a) a.volume = volume.value
}

const toggleMusic = async () => {
  const audio = audioRef.value
  if (!audio) return

  musicError.value = false

  if (audio.paused) {
    try {
      await audio.play()
      isMusicPlaying.value = true
    } catch {
      musicError.value = true
      isMusicPlaying.value = false
    }
  } else {
    audio.pause()
    isMusicPlaying.value = false
  }
}

const playTrack = async (index) => {
  if (!tracks.value.length) return

  const next = Math.min(tracks.value.length - 1, Math.max(0, index))
  const wasPlaying = isMusicPlaying.value

  currentIndex.value = next
  currentTime.value = 0
  duration.value = 0

  const a = audioRef.value
  if (!a) return

  a.load()
  if (wasPlaying) {
    try {
      await a.play()
      isMusicPlaying.value = true
    } catch {
      musicError.value = true
      isMusicPlaying.value = false
    }
  }
}

const nextTrack = async () => {
  if (!tracks.value.length) return
  const atEnd = currentIndex.value >= tracks.value.length - 1
  if (atEnd) {
    if (theme.value?.musicPlayer?.loop) return playTrack(0)
    const a = audioRef.value
    if (a) a.pause()
    isMusicPlaying.value = false
    return
  }
  return playTrack(currentIndex.value + 1)
}

const prevTrack = async () => {
  if (!tracks.value.length) return
  const atStart = currentIndex.value <= 0
  if (atStart) {
    if (theme.value?.musicPlayer?.loop) return playTrack(tracks.value.length - 1)
    return playTrack(0)
  }
  return playTrack(currentIndex.value - 1)
}

const onTimeUpdate = () => {
  const a = audioRef.value
  if (!a) return
  currentTime.value = a.currentTime || 0
}

const onLoadedMetadata = () => {
  const a = audioRef.value
  if (!a) return
  duration.value = a.duration || 0
}

const seekTo = (value) => {
  const a = audioRef.value
  if (!a) return
  const next = Math.min(duration.value || 0, Math.max(0, Number(value)))
  a.currentTime = Number.isFinite(next) ? next : 0
  currentTime.value = a.currentTime
}

watch(
  () => theme.value?.musicPlayer?.defaultVolume,
  (v) => {
    if (typeof v === 'number') applyVolume(v)
  },
  { immediate: true }
)

watch(
  () => currentTrack.value?.src,
  () => {
    musicError.value = false
    currentTime.value = 0
    duration.value = 0
  }
)

const closeCustomMenu = () => {
  isCustomMenuOpen.value = false
}

const toggleCustomMenu = () => {
  isCustomMenuOpen.value = !isCustomMenuOpen.value
}

const socialLabel = (socialLink) => {
  if (socialLink?.ariaLabel) return socialLink.ariaLabel

  const url = String(socialLink?.link || '')
  if (url.startsWith('mailto:')) return '邮箱'

  try {
    const { hostname } = new URL(url)
    const host = hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'github.com') return 'GitHub'
    if (host === 'x.com' || host === 'twitter.com') return 'X'
    if (host.endsWith('bilibili.com')) return 'B站'
    if (host === 'music.163.com' || host.endsWith('.163.com')) return '网易云音乐'

    const parts = host.split('.').filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2]
    return host || '链接'
  } catch {
    return 'Link'
  }
}

watch(
  () => route.path,
  () => {
    closeCustomMenu()
  }
)
</script>

<template>
  <!-- 视频背景容器 -->
  <div id="video-bg-container">
    <video id="video-bg" autoplay loop muted playsinline>
      <source src="/background.mp4" type="video/mp4">
    </video>
    <!-- 遮罩层，确保文字可读性 -->
    <div id="video-overlay"></div>
  </div>

  <Layout>
    <template #nav-bar-content-after>
      <button
        type="button"
        class="vp-custom-menu-button"
        aria-label="menu"
        :aria-expanded="isCustomMenuOpen"
        @click="toggleCustomMenu"
      >
        <span class="vp-custom-menu-icon" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>
    </template>
  </Layout>

  <div
    class="vp-music-player"
    v-if="theme.musicPlayer && (theme.musicPlayer.src || theme.musicPlayer.tracks?.length || theme.musicPlayer.netease?.id)"
  >
    <template v-if="playerProvider === 'netease'">
      <button
        type="button"
        class="vp-music-player-button"
        :aria-label="isMusicExpanded ? '收起歌单' : '展开歌单'"
        @click="isMusicExpanded = !isMusicExpanded"
      >
        <span class="vp-music-player-title">{{ theme.musicPlayer.title || '网易云歌单' }}</span>
        <span class="vp-music-player-state" aria-hidden="true">{{ isMusicExpanded ? '▾' : '▸' }}</span>
      </button>

      <div class="vp-music-player-panel" :class="{ 'is-collapsed': !isMusicExpanded }">
        <div class="vp-music-player-label">网易云外链播放器</div>
        <div class="vp-music-player-embed-wrap" :class="{ 'is-hidden': !isMusicExpanded }" aria-hidden="!isMusicExpanded">
          <iframe
            v-if="neteaseEmbedUrl"
            class="vp-music-player-embed"
            :src="neteaseEmbedUrl"
            width="100%"
            height="430"
            frameborder="0"
            marginwidth="0"
            marginheight="0"
            allow="autoplay; encrypted-media; fullscreen"
            referrerpolicy="no-referrer-when-downgrade"
            title="NetEase Music Player"
          />
        </div>
      </div>
    </template>

    <template v-else>
    <audio
      ref="audioRef"
      :src="currentTrack?.src || theme.musicPlayer.src"
      preload="none"
      @pause="isMusicPlaying = false"
      @play="isMusicPlaying = true"
      @error="musicError = true"
      @ended="nextTrack"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    />
    <button
      type="button"
      class="vp-music-player-button"
      :aria-label="isMusicPlaying ? '暂停音乐' : '播放音乐'"
      @click="toggleMusic"
    >
      <span class="vp-music-player-title">{{ currentTrack?.title || theme.musicPlayer.title || 'BGM' }}</span>
      <span class="vp-music-player-state" aria-hidden="true">{{ isMusicPlaying ? '⏸' : '▶' }}</span>
    </button>

    <button
      type="button"
      class="vp-music-player-expand"
      :aria-label="isMusicExpanded ? '收起播放器' : '展开播放器'"
      @click="isMusicExpanded = !isMusicExpanded"
    >
      {{ isMusicExpanded ? '收起' : '展开' }}
    </button>

    <div v-if="isMusicExpanded" class="vp-music-player-panel">
      <div class="vp-music-player-row">
        <button type="button" class="vp-music-player-ctl" aria-label="上一首" @click="prevTrack">上一首</button>
        <button type="button" class="vp-music-player-ctl" aria-label="下一首" @click="nextTrack">下一首</button>
      </div>

      <div class="vp-music-player-progress">
        <div class="vp-music-player-time">{{ formatTime(currentTime) }}</div>
        <input
          class="vp-music-player-range"
          type="range"
          min="0"
          :max="Math.max(0, duration || 0)"
          :value="currentTime"
          step="0.1"
          aria-label="播放进度"
          @input="seekTo($event.target.value)"
        />
        <div class="vp-music-player-time">{{ formatTime(duration) }}</div>
      </div>

      <div class="vp-music-player-volume">
        <div class="vp-music-player-label">音量</div>
        <input
          class="vp-music-player-range"
          type="range"
          min="0"
          max="1"
          :value="volume"
          step="0.01"
          aria-label="音量"
          @input="applyVolume($event.target.value)"
        />
      </div>

      <div v-if="tracks.length" class="vp-music-player-list">
        <div class="vp-music-player-label">歌单</div>
        <button
          v-for="(t, i) in tracks"
          :key="t.src"
          type="button"
          class="vp-music-player-track"
          :aria-current="i === currentIndex"
          @click="playTrack(i)"
        >
          <span class="vp-music-player-track-title">{{ t.title }}</span>
          <span class="vp-music-player-track-mark" aria-hidden="true">{{ i === currentIndex ? '正在播放' : '' }}</span>
        </button>
      </div>

      <div v-if="musicError" class="vp-music-player-hint">音频加载失败</div>
    </div>
    </template>
  </div>

  <div v-if="isCustomMenuOpen" class="vp-custom-menu-backdrop" @click="closeCustomMenu"></div>
  <div v-if="isCustomMenuOpen" class="vp-custom-menu-panel">
    <div v-if="theme.nav?.length" class="vp-custom-menu-section-title">导航</div>
    <nav v-if="theme.nav?.length">
      <template v-for="item in theme.nav" :key="JSON.stringify(item)">
        <a v-if="'link' in item" :href="item.link" @click="closeCustomMenu">{{ item.text }}</a>
        <template v-else-if="'items' in item">
          <div class="vp-custom-menu-section-title">{{ item.text }}</div>
          <a
            v-for="child in item.items"
            :key="JSON.stringify(child)"
            v-if="'link' in child"
            :href="child.link"
            @click="closeCustomMenu"
          >
            {{ child.text }}
          </a>
        </template>
      </template>
    </nav>

    <div v-if="theme.socialLinks?.length" class="vp-custom-menu-section-title">链接</div>
    <nav v-if="theme.socialLinks?.length">
      <a
        v-for="link in theme.socialLinks"
        :key="link.link"
        :href="link.link"
        target="_blank"
        rel="noreferrer"
        @click="closeCustomMenu"
      >
        {{ socialLabel(link) }}
      </a>
    </nav>
  </div>
</template>

<style>
/* 视频背景样式 */
#video-bg-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;
}

#video-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  transform: translate(-50%, -50%);
  object-fit: cover;
}

#video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 浅色模式遮罩：半透明白色，让视频变淡，适合黑色文字 */
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(2px);
}

.dark #video-overlay {
  /* 深色模式遮罩：半透明黑色，让视频变暗，适合白色文字 */
  background: rgba(0, 0, 0, 0.6);
}
</style>
