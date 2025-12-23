<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

type Props = {
  label?: string
  /**
   * 计数 key。
   * - local 模式：作为 localStorage 的 key
   * - shared 模式：作为远端计数的 key
   */
  storageKey?: string
  /** 是否启用“全站共享计数”（第三方 CountAPI） */
  shared?: boolean
  /** shared 模式下的命名空间（不填则用当前域名） */
  namespace?: string
  /** 共享计数 API 基地址（推荐用你自己的 Cloudflare Worker URL） */
  apiBase?: string
}

const props = defineProps<Props>()

const route = useRoute()

const count = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const localKey = computed(() => {
  const explicit = String(props.storageKey || '').trim()
  if (explicit) return explicit
  return `counter:${route.path}`
})

const sharedKey = computed(() => {
  const explicit = String(props.storageKey || '').trim()
  if (explicit) return explicit
  // shared 默认也按页面隔离；想全站一个就传 storageKey，例如 "global:push"
  return `page:${route.path}`
})

const normalize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const sharedNamespace = computed(() => {
  const explicit = String(props.namespace || '').trim()
  if (explicit) return normalize(explicit)
  if (typeof window === 'undefined') return 'site'
  return normalize(window.location.hostname || 'site')
})

const fetchWithTimeout = async (url: string, ms: number) => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

const apiBase = computed(() => String(props.apiBase || '').trim().replace(/\/$/, ''))

const workerGet = async () => {
  const base = apiBase.value
  if (!base) throw new Error('No apiBase')
  const k = encodeURIComponent(sharedKey.value)
  const url = `${base}/api/get/${k}`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as any
  const v = Number(data?.value)
  if (!Number.isFinite(v)) throw new Error('Invalid response')
  return v
}

const workerHit = async () => {
  const base = apiBase.value
  if (!base) throw new Error('No apiBase')
  const k = encodeURIComponent(sharedKey.value)
  const url = `${base}/api/hit/${k}`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as any
  const v = Number(data?.value)
  if (!Number.isFinite(v)) throw new Error('Invalid response')
  return v
}

const countApiGet = async () => {
  const ns = sharedNamespace.value
  const k = normalize(sharedKey.value) || 'global'
  const url = `https://api.countapi.xyz/get/${encodeURIComponent(ns)}/${encodeURIComponent(k)}`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as any
  const v = Number(data?.value)
  if (!Number.isFinite(v)) throw new Error('Invalid response')
  return v
}

const countApiHit = async () => {
  const ns = sharedNamespace.value
  const k = normalize(sharedKey.value) || 'global'
  const url = `https://api.countapi.xyz/hit/${encodeURIComponent(ns)}/${encodeURIComponent(k)}`
  const res = await fetchWithTimeout(url, 8000)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as any
  const v = Number(data?.value)
  if (!Number.isFinite(v)) throw new Error('Invalid response')
  return v
}

const readLocalCount = (k: string) => {
  try {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(k)
    const n = raw == null ? 0 : Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

const writeLocalCount = (k: string, value: number) => {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(k, String(value))
  } catch {
    // ignore
  }
}

const isShared = computed(() => Boolean(props.shared))

const refresh = async () => {
  error.value = null
  if (!isShared.value) {
    count.value = readLocalCount(localKey.value)
    return
  }

  loading.value = true
  try {
    count.value = apiBase.value ? await workerGet() : await countApiGet()
  } catch (e: any) {
    // 第一次使用 key 可能还没创建；这里保持 0，等首次点击 hit
    error.value = e?.message || 'Failed'
    count.value = count.value || 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})

watch(
  () => route.path,
  () => {
    void refresh()
  }
)

watch(
  localKey,
  () => {
    if (!isShared.value) count.value = readLocalCount(localKey.value)
  },
  { flush: 'post' }
)

watch(
  count,
  (v) => {
    if (!isShared.value) writeLocalCount(localKey.value, v)
  },
  { flush: 'post' }
)

const onClick = async () => {
  if (loading.value) return
  error.value = null

  if (!isShared.value) {
    count.value += 1
    return
  }

  loading.value = true
  try {
    count.value = apiBase.value ? await workerHit() : await countApiHit()
  } catch (e: any) {
    error.value = e?.message || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <button type="button" class="VPButton brand" :disabled="loading" @click="onClick">
    {{ props.label ?? 'Push' }} ({{ count }})
  </button>
  <span v-if="error" style="margin-left: 8px; font-size: 12px; opacity: 0.7;">
    {{ error }}
  </span>
</template>
