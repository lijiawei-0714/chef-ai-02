// ===== AI 私厨侧边栏聊天逻辑 =====

// 配置
const API_BASE = window.location.origin; // 同源部署
let sessionId = localStorage.getItem("chat_session_id") || crypto.randomUUID();
let isSidebarOpen = false;
let isLoading = false;

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

// ===== 发送消息 =====
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
        const response = await fetch(`${API_BASE}/api/chat`, {
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

        const data = await response.json();
        sessionId = data.session_id;
        localStorage.setItem("chat_session_id", sessionId);

        // 显示 AI 回复
        appendMessage("ai", data.reply);

    } catch (error) {
        loadingEl.remove();
        appendMessage("ai", `抱歉，出现了一些问题：${error.message}\n\n请确保后端服务已启动（运行 server.py）。`);
    } finally {
        isLoading = false;
        updateSendButton();
        input.focus();
    }
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

// ===== 格式化消息内容 =====
function formatMessage(text) {
    // 转义 HTML
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 代码块 ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#f5f5f5;padding:8px 12px;border-radius:6px;overflow-x:auto;font-size:0.9em;"><code>$1</code></pre>');
    // 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>');
    // 粗体 **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // 斜体 *text*
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // 有序列表 1. text
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:20px;">$1</li>');
    // 无序列表 - text
    html = html.replace(/^-\s+(.+)$/gm, '<li style="margin-left:20px;list-style-type:disc;">$1</li>');
    // 换行（保留代码块内的换行）
    html = html.replace(/\n/g, "<br>");

    // 包裹在段落中
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
});
