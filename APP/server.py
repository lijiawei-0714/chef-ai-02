# ==================== 私厨 AI 网页后端服务 ====================
# 启动方式: python server.py
# 访问地址: http://localhost:5000
import sys
import os
import uuid
import time
import json
import logging
import threading
from functools import wraps
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

# 将 agent 目录加入 Python 路径
agent_dir = os.path.join(os.path.dirname(__file__), "agent")
sys.path.insert(0, agent_dir)

from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context, render_template
from flask_cors import CORS

# 导入 AI 私厨智能体
# noinspection PyUnresolvedReferences
from ai_chef import run_agent  # noqa: F401

# ==================== 日志配置 ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ==================== Flask 应用配置 ====================
app = Flask(__name__, static_folder="cooking", template_folder="cooking")
CORS(app)

# ==================== 安全配置 ====================
MAX_MESSAGE_LENGTH = 2000  # 单条消息最大字符数
RATE_LIMIT_WINDOW = 60  # 速率限制窗口（秒）
RATE_LIMIT_MAX_REQUESTS = 30  # 窗口内最大请求数（每 IP）
AI_TIMEOUT_SECONDS = 120  # AI 请求超时时间（秒）

# 存储用户会话（简单实现，生产环境应使用 Redis 等）
# 格式: {session_id: {"created_at": timestamp, "thread_id": str}}
sessions = {}
SESSION_TTL = 3600  # 会话有效期 1 小时

# 速率限制存储：{ip: [timestamp1, timestamp2, ...]}
rate_limit_store = {}


def rate_limit(f):
    """简单的基于内存的 IP 速率限制装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = request.remote_addr or "unknown"
        now = time.time()
        # 清理过期记录
        rate_limit_store[ip] = [t for t in rate_limit_store.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
        if len(rate_limit_store.get(ip, [])) >= RATE_LIMIT_MAX_REQUESTS:
            logger.warning(f"⚠️ 速率限制触发: {ip} 在 {RATE_LIMIT_WINDOW}s 内请求 {len(rate_limit_store[ip])} 次")
            return jsonify({"error": "请求过于频繁，请稍后再试"}), 429
        rate_limit_store.setdefault(ip, []).append(now)
        return f(*args, **kwargs)
    return decorated


def _validate_chat_request(data):
    """验证聊天请求的公共逻辑，返回 (user_message, session_id, error_response)"""
    if not data or not data.get("message"):
        return None, None, (jsonify({"error": "请提供消息内容"}), 400)
    user_message = data["message"].strip()
    if len(user_message) > MAX_MESSAGE_LENGTH:
        return None, None, (jsonify({"error": f"消息过长，请控制在 {MAX_MESSAGE_LENGTH} 字以内"}), 400)
    session_id = data.get("session_id", "")
    if not session_id or session_id not in sessions:
        session_id = str(uuid.uuid4())
        sessions[session_id] = {"created_at": time.time()}
    else:
        sessions[session_id]["created_at"] = time.time()
    return user_message, session_id, None


def _cleanup_expired_sessions():
    """清理过期会话"""
    now = time.time()
    expired = [sid for sid, info in sessions.items() if now - info["created_at"] > SESSION_TTL]
    for sid in expired:
        del sessions[sid]
    if expired:
        logger.info(f"🧹 清理了 {len(expired)} 个过期会话")


def _periodic_session_cleanup():
    """后台线程：每 5 分钟清理过期会话"""
    while True:
        time.sleep(300)  # 5 分钟
        _cleanup_expired_sessions()


# 启动后台清理线程（守护线程，主进程退出时自动结束）
threading.Thread(target=_periodic_session_cleanup, daemon=True).start()


# ==================== 静态文件服务 ====================
@app.route("/")
def index():
    """返回主页"""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    """返回静态文件"""
    return send_from_directory(app.static_folder, filename)


# ==================== AI 聊天 API ====================
@app.route("/api/chat", methods=["POST"])
@rate_limit
def chat():
    """
    处理聊天请求

    请求体: {"message": "用户消息", "session_id": "会话ID(可选)"}
    返回: {"reply": "AI回复", "session_id": "会话ID"}
    """
    try:
        data = request.get_json()
        user_message, session_id, error = _validate_chat_request(data)
        if error:
            return error

        logger.info(f"📩 收到消息: session={session_id[:8]}... len={len(user_message)}")

        # 调用 AI 智能体（带超时控制）
        with ThreadPoolExecutor(max_workers=4) as executor:
            future = executor.submit(run_agent, user_message, False, session_id)
            try:
                reply = future.result(timeout=AI_TIMEOUT_SECONDS)
            except FuturesTimeoutError:
                logger.warning(f"⏰ AI 请求超时: session={session_id[:8]}... ({AI_TIMEOUT_SECONDS}s)")
                return jsonify({"error": "AI 响应超时，请稍后重试"}), 504

        logger.info(f"📤 回复成功: session={session_id[:8]}... len={len(reply)}")

        return jsonify({
            "reply": reply,
            "session_id": session_id
        })

    except Exception as e:
        logger.error(f"聊天接口错误: {e}", exc_info=True)
        # 错误信息脱敏：不暴露内部细节
        return jsonify({"error": "服务处理异常，请稍后重试"}), 500


# ==================== AI 聊天 API（SSE 流式） ====================
@app.route("/api/chat/stream", methods=["POST"])
@rate_limit
def chat_stream():
    """SSE 流式聊天接口"""
    try:
        data = request.get_json()
        user_message, session_id, error = _validate_chat_request(data)
        if error:
            return error

        logger.info(f"📩 收到流式消息: session={session_id[:8]}... len={len(user_message)}")

        def generate():
            yield f"data: {json.dumps({'session_id': session_id})}\n\n"
            try:
                reply = run_agent(user_message, False, session_id)
                chunk_size = 10
                for i in range(0, len(reply), chunk_size):
                    chunk = reply[i:i + chunk_size]
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                logger.error(f"流式聊天错误: {e}", exc_info=True)
                yield f"data: {json.dumps({'error': '服务处理异常'}, ensure_ascii=False)}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
        )
    except Exception as e:
        logger.error(f"流式聊天接口错误: {e}", exc_info=True)
        return jsonify({"error": "服务处理异常，请稍后重试"}), 500


# ==================== 健康检查 ====================
@app.route("/api/health")
def health():
    """健康检查接口"""
    return jsonify({"status": "ok", "message": "私厨 AI 服务运行中"})


# ==================== 404 错误处理 ====================
@app.errorhandler(404)
def page_not_found(e):
    """返回自定义 404 页面"""
    # 如果是 API 请求，返回 JSON
    if request.path.startswith('/api/'):
        return jsonify({"error": "接口不存在"}), 404
    # 否则返回 404 页面
    return render_template('404.html'), 404


# ==================== 启动服务 ====================
if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("🍳 私厨 AI 网页服务启动中...")
    logger.info("🌐 访问地址: http://localhost:5000")
    logger.info(f"📁 静态文件目录: {app.static_folder}")
    logger.info("=" * 50)
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)
