# 避坑指南：Go 并发中的隐形杀手——Goroutine 泄漏

> **日期**: 2026-01-22  
> **标签**: Go, Concurrency, Select, Memory Leak  
> **分类**: Go 避坑

在 `select` 多路复用场景下，一个微小的 Channel 缓冲设置失误，如何导致服务内存溢出？本文以 API 竞速模式为例，剖析 Goroutine 泄漏的成因与解法。

---

## 引言

Go 语言开启一个 Goroutine 极其廉价（初始栈仅 2KB），但这并不意味着我们可以随意挥霍。

在 Web 服务等长期运行的进程中，**Goroutine 泄漏（Goroutine Leak）** 是导致 OOM（内存溢出）的头号杀手。最可怕的是，这种泄漏通常是静默的，Go Runtime 不会报错，但你的内存监控曲线会缓慢而坚定地上升，直到服务器崩溃。

## 场景复现：API 竞速 (The API Racer)

我们需要实现一个"对冲请求"模式：同时请求 Google 和 Bing，谁先返回结果就用谁的，超时的那个直接丢弃。

### 初版代码（存在泄漏）

```go
func main() {
    // ⚠️ 致命错误：无缓冲 Channel
    ch := make(chan string)

    go func() { ch <- request("Google") }()
    go func() { ch <- request("Bing") }()

    // 谁先回来就返回谁
    return <-ch
}
```

## 泄漏分析

假设 Google 响应很快（200ms），Bing 响应很慢（2s）。

```
时间线：
├── 0ms     启动两个 Goroutine
├── 200ms   Google 完成，结果写入 ch
├── 200ms   Main 收到结果，函数返回退出
├── 2000ms  Bing 完成，尝试写入 ch...
└── ∞       Bing Goroutine 永久阻塞 💀
```

### 详细流程

1. **Google 完成**：将结果写入 `ch`
2. **Main 接收**：`<-ch` 读到了 Google 的结果，函数返回，退出
3. **Bing 的命运**：
   - 1.8秒后，Bing 请求完成
   - 它试图执行 `ch <- "Bing Result"`
   - 由于 `ch` 是**无缓冲的**，发送方必须等到接收方准备好才能继续
   - 但是！Main 函数已经退出了，**再也没有人会来读这个 `ch` 了**

### 结果

负责 Bing 的那个 Goroutine 会**永远阻塞**在发送操作上。它无法退出，无法释放栈内存，成为一个"僵尸协程"。

```
如果有 1000 QPS，每秒就会泄漏 1000 个 Goroutine。
几分钟后，服务必挂。
```

## 解决方案：Buffered Channel

修复方法惊人地简单：给 Channel 加缓冲。

```go
func main() {
    // ✅ 修复：给每个并发任务留一个缓冲区
    ch := make(chan string, 2)

    go func() { ch <- request("Google") }()
    go func() { ch <- request("Bing") }()

    return <-ch
}
```

### 为什么有效？

即使 Main 函数取走 Google 的结果后就跑路了，Bing 的 Goroutine 在 2秒后醒来时，依然可以将结果扔进缓冲区。

| 步骤 | 行为 |
|------|------|
| 1 | 对于 Buffered Channel，只要缓冲区没满，发送操作就是**非阻塞的** |
| 2 | 写入缓冲区后，Bing 的 Goroutine 任务完成，正常退出（return） |
| 3 | 虽然那个结果永远不会被读取，但它占用的仅仅是 Channel 缓冲区里的一点点内存 |
| 4 | 昂贵的 Goroutine 资源被成功回收 ✅ |

## 其他解决方案

### 方案二：使用 Context 取消

```go
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    ch := make(chan string, 1)

    go func() {
        result := request("Google")
        select {
        case ch <- result:
        case <-ctx.Done():
            return // 被取消，优雅退出
        }
    }()

    go func() {
        result := request("Bing")
        select {
        case ch <- result:
        case <-ctx.Done():
            return // 被取消，优雅退出
        }
    }()

    result := <-ch
    cancel() // 通知落选者退出
    return result
}
```

### 方案三：使用 Select + Default（非阻塞发送）

```go
go func() {
    result := request("Bing")
    select {
    case ch <- result:
        // 成功发送
    default:
        // Channel 已满或无人接收，丢弃结果
    }
}()
```

## 总结

在使用 `select` 或任何"多选一"的并发模式时，**必须关注那些落选的 Goroutine 去哪了**。

### 黄金法则

> 如果你启动了一个 Goroutine，你必须清楚地知道它将在**何时、何种条件下退出**。
> 
> 如果它依赖 Channel 发送才能退出，请务必确保该 Channel 即使在极端情况下也不会阻塞。

### 检测工具

```bash
# 使用 pprof 检查 Goroutine 数量
go tool pprof http://localhost:6060/debug/pprof/goroutine

# 或者在代码中打印
fmt.Println("Goroutine count:", runtime.NumGoroutine())
```

### 常见泄漏场景

| 场景 | 原因 | 解法 |
|------|------|------|
| 无缓冲 Channel 发送 | 无人接收 | 加缓冲 / Context 取消 |
| for-range Channel | Channel 未关闭 | 确保 close(ch) |
| select 竞速 | 落选者无退出路径 | Context / 非阻塞发送 |
| 无限循环 | 缺少退出条件 | 添加 done channel |
