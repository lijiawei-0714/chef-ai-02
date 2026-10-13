# ==================== 私厨 AI 网页后端服务 ====================
# 启动方式: python server.py
# 访问地址: http://localhost:5000
import sys
import os
import uuid
from pathlib import Path

# 将 agent 目录加入 Python 路径
agent_dir = os.path.join(os.path.dirname(__file__), "agent")
sys.path.insert(0, agent_dir)

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# 导入 AI 私厨智能体
# noinspection PyUnresolvedReferences
from ai私厨 import run_agent  # noqa: F401

# ==================== Flask 应用配置 ====================
app = Flask(__name__, static_folder="cooking")
CORS(app)

# 存储用户会话（简单实现，生产环境应使用 Redis 等）
sessions = {}


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
def chat():
    """
    处理聊天请求

    请求体: {"message": "用户消息", "session_id": "会话ID(可选)"}
    返回: {"reply": "AI回复", "session_id": "会话ID"}
    """
    try:
        data = request.get_json()
        if not data or not data.get("message"):
            return jsonify({"error": "请提供消息内容"}), 400

        user_message = data["message"].strip()
        session_id = data.get("session_id", str(uuid.uuid4()))

        if not user_message:
            return jsonify({"error": "消息不能为空"}), 400

        # 调用 AI 智能体
        reply = run_agent(user_message, debug=False, thread_id=session_id)

        return jsonify({
            "reply": reply,
            "session_id": session_id
        })

    except Exception as e:
        print(f"聊天接口错误: {e}")
        return jsonify({"error": f"服务异常: {str(e)}"}), 500


# ==================== 健康检查 ====================
@app.route("/api/health")
def health():
    """健康检查接口"""
    return jsonify({"status": "ok", "message": "私厨 AI 服务运行中"})


# ==================== 启动服务 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("🍳 私厨 AI 网页服务启动中...")
    print("🌐 访问地址: http://localhost:5000")
    print("📁 静态文件目录:", app.static_folder)
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
