<script setup>
import { computed, ref, shallowReactive } from 'vue'
import { useData } from 'vitepress'

const { theme } = useData()

const links = computed(() => {
  const list = theme.value?.friendLinks
  return Array.isArray(list) ? list.filter((x) => x && x.link) : []
})

const isOpen = ref(false)

const toggleOpen = () => {
  isOpen.value = !isOpen.value
}

const onToggleKeydown = (e) => {
  if (e?.key === 'Enter' || e?.key === ' ') {
    e.preventDefault()
    toggleOpen()
  }
}

// key: link -> current icon url
const iconSrcByLink = shallowReactive({})
// key: link -> fallback stage
// -1: using custom avatar
//  0: origin /favicon.ico
//  1: DuckDuckGo icon service
//  2: icon.horse service
//  3: Google s2 favicon service
const iconStageByLink = shallowReactive({})

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const primaryIcon = (url) => {
  try {
    const u = new URL(url)
    return `${u.origin}/favicon.ico`
  } catch {
    return ''
  }
}

const ddgIcon = (url) => {
  const host = getHostname(url)
  if (!host) return ''
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

const iconHorse = (url) => {
  const host = getHostname(url)
  if (!host) return ''
  return `https://icon.horse/icon/${encodeURIComponent(host)}`
}

const fallbackIcon = (url) => {
  const host = getHostname(url)
  if (!host) return ''
  // 备用 favicon 服务（部分站点不提供 /favicon.ico 时兜底）
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

const iconByStage = (url, stage) => {
  if (stage === 0) return primaryIcon(url)
  if (stage === 1) return ddgIcon(url)
  if (stage === 2) return iconHorse(url)
  if (stage === 3) return fallbackIcon(url)
  return ''
}

const iconSrc = (item) => {
  const key = String(item?.link || '')
  if (!key) return ''

  if (!iconSrcByLink[key]) {
    if (item?.avatar) {
      iconStageByLink[key] = -1
      iconSrcByLink[key] = String(item.avatar)
    } else {
      iconStageByLink[key] = 0
      iconSrcByLink[key] = iconByStage(key, 0)
    }
  }
  return iconSrcByLink[key]
}

const onIconError = (item) => {
  const key = String(item?.link || '')
  if (!key) return

  const stage = Number.isFinite(iconStageByLink[key]) ? iconStageByLink[key] : 0

  // avatar 失败：回退到站点 favicon
  if (stage === -1) {
    iconStageByLink[key] = 0
    iconSrcByLink[key] = iconByStage(key, 0)
    return
  }

  const nextStage = stage + 1
  const next = iconByStage(key, nextStage)
  if (!next) return
  if (iconSrcByLink[key] === next) return
  iconStageByLink[key] = nextStage
  iconSrcByLink[key] = next
}
</script>

<template>
  <aside v-if="links.length" class="vp-friends" :class="{ 'is-open': isOpen }" aria-label="友链">
    <div class="vp-friends-drawer" :aria-hidden="!isOpen">
      <div class="vp-friends-panel">
        <div
          class="vp-friends-title"
          role="button"
          tabindex="0"
          :aria-expanded="isOpen"
          aria-label="友链"
          @click="toggleOpen"
          @keydown="onToggleKeydown"
        >
          <span class="vp-friends-title-text">友链</span>
        </div>
        <nav class="vp-friends-list">
          <a
            v-for="item in links"
            :key="item.link"
            class="vp-friend-link"
            :href="item.link"
            target="_blank"
            rel="noreferrer"
          >
            <img
              class="vp-friend-avatar"
              :src="iconSrc(item)"
              :alt="item.name || getHostname(item.link) || 'link'"
              loading="lazy"
              @error="onIconError(item)"
            />
            <span class="vp-friend-name">{{ item.name || getHostname(item.link) || item.link }}</span>
          </a>
        </nav>
      </div>
    </div>
  </aside>
</template>
