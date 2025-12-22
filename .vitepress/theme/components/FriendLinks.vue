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

const fallbackIcon = (url) => {
  const host = getHostname(url)
  if (!host) return ''
  // 备用 favicon 服务（部分站点不提供 /favicon.ico 时兜底）
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

const iconSrc = (item) => {
  if (item?.avatar) return String(item.avatar)
  const key = String(item?.link || '')
  if (!key) return ''
  if (!iconSrcByLink[key]) iconSrcByLink[key] = primaryIcon(key)
  return iconSrcByLink[key]
}

const onIconError = (item) => {
  const key = String(item?.link || '')
  if (!key) return
  const next = fallbackIcon(key)
  if (next && iconSrcByLink[key] !== next) iconSrcByLink[key] = next
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
