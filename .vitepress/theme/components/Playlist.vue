<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { theme } = useData()

const playlist = computed(() => theme.value?.musicPlaylist)

const playlistUrl = computed(() => {
  const id = playlist.value?.id
  return id ? `https://music.163.com/m/playlist?id=${encodeURIComponent(id)}` : 'https://music.163.com/'
})

const songUrl = (id) => `https://music.163.com/#/song?id=${encodeURIComponent(id)}`
</script>

<template>
  <div class="vp-playlist">
    <div class="vp-playlist-head">
      <div class="vp-playlist-title">
        {{ playlist?.name || '歌单' }}
      </div>
      <a class="vp-playlist-open" :href="playlistUrl" target="_blank" rel="noreferrer">在网易云打开</a>
    </div>

    <div v-if="playlist?.tracks?.length" class="vp-playlist-list">
      <a
        v-for="(t, i) in playlist.tracks"
        :key="t.id"
        class="vp-playlist-item"
        :href="songUrl(t.id)"
        target="_blank"
        rel="noreferrer"
      >
        <span class="vp-playlist-index">{{ i + 1 }}</span>
        <span class="vp-playlist-main">
          <span class="vp-playlist-song">{{ t.title }}</span>
          <span class="vp-playlist-meta">{{ t.artists }}<span v-if="t.album"> · {{ t.album }}</span></span>
        </span>
        <span class="vp-playlist-dur">{{ t.duration }}</span>
      </a>
    </div>

    <div v-else class="vp-playlist-empty">
      歌单列表暂时加载失败（不影响站点浏览）。
    </div>
  </div>
</template>
