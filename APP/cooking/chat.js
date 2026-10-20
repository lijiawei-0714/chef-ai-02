// ===== AI 私厨侧边栏聊天逻辑 =====

// 配置
const API_BASE = window.location.origin; // 同源部署

// 欢迎消息模板
const WELCOME_MESSAGE = `
    <div class="chat-message ai">
        <div class="message-avatar">🤖</div>
        <div class="message-body">
            <p>你好！我是<strong>私厨小助</strong>，你的 AI 烹饪助手。</p>
            <p>新对话已开始，有什么可以帮你的？</p>
        </div>
    </div>
`;

// 生成 UUID（兼容不支持 crypto.randomUUID 的环境）
function generateUUID() {
    if (crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let sessionId = localStorage.getItem("chat_session_id") || generateUUID();
let isSidebarOpen = false;
let isLoading = false;

// ===== 历史对话存储 =====
const HISTORY_KEY = "chat_history_sessions";  // {sessionId: {id, title, createdAt, lastActiveAt, messages}}
const ORDER_KEY = "chat_history_order";       // [sessionId, ...] 按时间倒序
const MAX_HISTORY = 50;  // 最多保存 50 条历史

// 获取所有历史会话
function getHistorySessions() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
    } catch { return {}; }
}
// 获取会话 ID 排序列表
function getHistoryOrder() {
    try {
        return JSON.parse(localStorage.getItem(ORDER_KEY)) || [];
    } catch { return []; }
}
// 保存历史会话
function saveHistorySessions(sessions) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
}
function saveHistoryOrder(order) {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

// 保存当前对话到历史
function saveCurrentChat() {
    const container = document.getElementById("chatMessages");
    const msgEls = container.querySelectorAll(".chat-message");
    if (msgEls.length === 0) return;

    // 从 DOM 提取消息（跳过欢迎消息）
    const messages = [];
    msgEls.forEach(el => {
        const role = el.classList.contains("user") ? "user" : "ai";
        const bodyEl = el.querySelector(".message-body");
        if (bodyEl) {
            messages.push({ role, content: bodyEl.innerText });
        }
    });

    // 跳过只有欢迎消息的会话
    if (messages.length <= 1 && messages[0]?.role === "ai") return;

    const sessions = getHistorySessions();
    const order = getHistoryOrder();

    // 生成标题（取第一条用户消息的前 20 字）
    const firstUserMsg = messages.find(m => m.role === "user");
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? "..." : "") : "新对话";

    sessions[sessionId] = {
        id: sessionId,
        title: title,
        createdAt: sessions[sessionId]?.createdAt || Date.now(),
        lastActiveAt: Date.now(),
        messages: messages
    };

    // 更新排序（移到最前）
    const newOrder = [sessionId, ...order.filter(id => id !== sessionId)];
    // 限制数量
    let finalOrder = newOrder;
    if (finalOrder.length > MAX_HISTORY) {
        finalOrder.slice(MAX_HISTORY).forEach(id => delete sessions[id]);
        finalOrder = finalOrder.slice(0, MAX_HISTORY);
    }
    saveHistorySessions(sessions);
    saveHistoryOrder(finalOrder);

    renderHistoryList();
}

// 加载历史对话到聊天区域
function loadChat(sessionIdToLoad) {
    const sessions = getHistorySessions();
    const session = sessions[sessionIdToLoad];
    if (!session) return;

    // 先保存当前对话
    saveCurrentChat();

    sessionId = sessionIdToLoad;
    localStorage.setItem("chat_session_id", sessionId);

    const container = document.getElementById("chatMessages");
    container.innerHTML = "";

    session.messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
    });

    renderHistoryList();
}

// 渲染历史列表
function renderHistoryList() {
    const listEl = document.getElementById("historyList");
    const order = getHistoryOrder();
    const sessions = getHistorySessions();

    if (order.length === 0) {
        listEl.innerHTML = '<div class="history-empty">暂无历史对话</div>';
        return;
    }

    listEl.innerHTML = order.map(id => {
        const s = sessions[id];
        if (!s) return "";
        const isActive = id === sessionId ? " active" : "";
        const time = formatTime(s.lastActiveAt);
        return `<div class="history-item${isActive}" onclick="loadChat('${id}')">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(s.title)}</span>
            <span class="history-item-time">${time}</span>
        </div>`;
    }).join("");
}

// 格式化时间
function formatTime(ts) {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// HTML 转义（用于历史标题）
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// 清空所有历史
function clearAllHistory() {
    if (!confirm("确定要清空所有历史对话吗？")) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(ORDER_KEY);
    renderHistoryList();
}

// ===== 侧边栏切换 =====
function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    const overlay = document.getElementById("sidebarOverlay");

    sidebar.classList.toggle("open", isSidebarOpen);
    toggle.classList.toggle("active", isSidebarOpen);
    overlay.classList.toggle("show", isSidebarOpen);

    if (isSidebarOpen) {
        document.getElementById("chatInput").focus();
    }
}

// ===== 新建对话 =====
function startNewChat() {
    // 先保存当前对话
    saveCurrentChat();

    // 生成新的会话 ID
    sessionId = generateUUID();
    localStorage.setItem("chat_session_id", sessionId);

    // 清空聊天记录（保留欢迎消息）
    const container = document.getElementById("chatMessages");
    container.innerHTML = WELCOME_MESSAGE;
    renderHistoryList();
}

// ===== 发送消息（SSE 流式） =====
async function sendMessage() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();

    if (!message || isLoading) return;

    // 显示用户消息
    appendMessage("user", message);
    input.value = "";
    input.style.height = "auto";

    // 显示加载状态
    isLoading = true;
    updateSendButton();
    const loadingEl = showLoading();

    try {
        const response = await fetch(`${API_BASE}/api/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                session_id: sessionId
            })
        });

        // 移除加载动画
        loadingEl.remove();

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `服务器错误 (${response.status})`);
        }

        // 创建 AI 消息容器（用于流式填充）
        const aiMsgEl = createStreamingMessage();
        const bodyEl = aiMsgEl.querySelector(".message-body");
        let fullContent = "";

        // 读取 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // 解析 SSE 事件
            const lines = buffer.split("\n");
            buffer = lines.pop(); // 保留不完整的行

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.session_id) {
                            sessionId = data.session_id;
                            localStorage.setItem("chat_session_id", sessionId);
                        }

                        if (data.content) {
                            fullContent += data.content;
                            bodyEl.innerHTML = formatMessage(fullContent);
                            scrollToBottom();
                        }

                        if (data.error) {
                            throw new Error(data.error);
                        }

                        if (data.done) {
                            // 流式完成
                            break;
                        }
                    } catch (e) {
                        if (e.message !== "Unexpected end of JSON input") {
                            throw e;
                        }
                    }
                }
            }
        }

        // 流式完成，自动保存到历史
        saveCurrentChat();

    } catch (error) {
        loadingEl.remove();
        showToast(`发送失败：${error.message}`, 'error', 5000);
        appendMessage("ai", "抱歉，消息发送失败，请确认后端服务已启动后重试。");
    } finally {
        isLoading = false;
        updateSendButton();
        input.focus();
    }
}

// ===== 创建流式消息容器 =====
function createStreamingMessage() {
    const container = document.getElementById("chatMessages");
    const msg = document.createElement("div");
    msg.className = "chat-message ai";
    msg.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-body"><span class="streaming-cursor">|</span></div>
    `;
    container.appendChild(msg);
    scrollToBottom();
    return msg;
}

// ===== 添加消息到聊天区域 =====
function appendMessage(role, content) {
    const container = document.getElementById("chatMessages");
    const msg = document.createElement("div");
    msg.className = `chat-message ${role}`;

    const avatar = role === "ai" ? "🤖" : "👤";
    const formattedContent = formatMessage(content);

    msg.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-body">${formattedContent}</div>
    `;

    container.appendChild(msg);
    scrollToBottom();
}

// ===== 格式化消息内容（安全 Markdown 渲染） =====
function formatMessage(text) {
    // 1. 先转义 HTML，防止 XSS
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // 2. 代码块 ```code```（先处理，避免内部被其他正则破坏）
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#f5f5f5;padding:8px 12px;border-radius:6px;overflow-x:auto;font-size:0.9em;"><code>$1</code></pre>');
    // 3. 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>');
    // 4. 表格支持（Markdown 表格格式）
    html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, function(match, headerRow, separatorRow, bodyRows) {
        const headers = headerRow.split('|').filter(c => c.trim() !== '');
        const headerHtml = headers.map(h => `<th style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;font-weight:600;">${h.trim()}</th>`).join('');
        const rows = bodyRows.trim().split('\n').map(row => {
            const cells = row.split('|').filter(c => c.trim() !== '');
            return '<tr>' + cells.map(c => `<td style="padding:6px 12px;border:1px solid #ddd;">${c.trim()}</td>`).join('') + '</tr>';
        }).join('');
        return `<table style="border-collapse:collapse;margin:8px 0;font-size:0.9em;width:100%;"><thead><tr>${headerHtml}</tr></thead><tbody>${rows}</tbody></table>`;
    });
    // 5. 粗体 **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // 6. 斜体 *text*（避免匹配已处理的粗体残留）
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");
    // 7. 有序列表 1. text
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:20px;">$1</li>');
    // 8. 无序列表 - text
    html = html.replace(/^-\s+(.+)$/gm, '<li style="margin-left:20px;list-style-type:disc;">$1</li>');
    // 9. 换行（保留代码块内的换行）
    html = html.replace(/\n/g, "<br>");

    // 10. 包裹在段落中
    if (!html.startsWith("<")) {
        html = `<p>${html}</p>`;
    }

    return html;
}

// ===== 显示加载动画 =====
function showLoading() {
    const container = document.getElementById("chatMessages");
    const loading = document.createElement("div");
    loading.className = "chat-message ai";
    loading.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-body">
            <div class="chat-loading">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(loading);
    scrollToBottom();
    return loading;
}

// ===== 滚动到底部 =====
function scrollToBottom() {
    const container = document.getElementById("chatMessages");
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

// ===== 更新发送按钮状态 =====
function updateSendButton() {
    const btn = document.getElementById("chatSend");
    btn.disabled = isLoading;
}

// ===== 处理输入框按键 =====
function handleChatKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ===== 自动调整输入框高度 =====
document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("chatInput");
    if (textarea) {
        textarea.addEventListener("input", function() {
            this.style.height = "auto";
            this.style.height = Math.min(this.scrollHeight, 100) + "px";
        });
    }
    // 初始化渲染历史列表
    renderHistoryList();
});
