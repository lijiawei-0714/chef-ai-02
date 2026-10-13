import json

with open("私厨ai.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

# Cell 0: Markdown - 标题说明
nb["cells"][0]["source"] = [
    "# 私厨 AI 助手\n",
    "基于阿里云百炼 qwen3-vl 多模态大模型 + LangGraph Agent 框架\n",
    "支持: 图片理解 + 文本对话 + 智能搜索 + 对话记忆\n"
]

# Cell 1: Code - 模型初始化
nb["cells"][1]["source"] = [
    "# ==================== 1. 模型初始化 ====================\n",
    "# 加载环境变量并初始化阿里云百炼多模态大模型\n",
    "import os\n",
    "import base64\n",
    "import sqlite3\n",
    "from dotenv import load_dotenv\n",
    "from langchain_openai import ChatOpenAI\n",
    "from langchain_core.messages import HumanMessage\n",
    "\n",
    "# 从 .env 文件加载 API Key 等配置\n",
    "load_dotenv()\n",
    "\n",
    "# 初始化多模态模型（通过 OpenAI 兼容接口调用阿里云百炼）\n",
    "model = ChatOpenAI(\n",
    "    model=\"qwen3-vl-235b-a22b-thinking\",\n",
    "    openai_api_key=os.getenv(\"ALI_KEY\"),\n",
    "    openai_api_base=os.getenv(\"ali_URL\"),\n",
    ")\n"
]

# Cell 2: Markdown - 工具标题
nb["cells"][2]["source"] = [
    "# ==================== 2. 工具配置 ====================\n",
    "## TavilySearch 智能搜索工具\n",
    "Agent 可通过此工具联网搜索最新信息\n"
]

# Cell 3: Code - 搜索工具初始化
nb["cells"][3]["source"] = [
    "# 初始化 Tavily 智能搜索工具（每次最多返回 3 条结果）\n",
    "from langchain_tavily import TavilySearch\n",
    "\n",
    "tavily_search = TavilySearch(max_results=3)\n"
]

# Cell 4: Markdown - 记忆管理标题
nb["cells"][4]["source"] = [
    "# ==================== 3. Agent 构建 ====================\n",
    "## 系统提示词 + SQLite 记忆持久化 + Agent 创建\n",
    "- 系统提示词：定义 Agent 的私厨助手角色\n",
    "- SQLite 记忆：对话历史持久化到本地，重启不丢失\n",
    "- Agent：整合模型、工具、记忆、提示词\n"
]

# Cell 5: Code - Agent 创建（核心）
nb["cells"][5]["source"] = [
    "from langgraph.checkpoint.sqlite import SqliteSaver\n",
    "from langchain.agents import create_agent\n",
    "\n",
    "# --- 系统提示词：定义 Agent 的角色和行为规范 ---\n",
    "system_prompt = \"\"\"你是一个专业的私厨AI助手，名叫\"私厨小助\"。\n",
    "你的专长包括：\n",
    "1. 菜谱推荐：根据用户提供的食材、口味偏好、饮食禁忌推荐合适的菜谱\n",
    "2. 食材搭配：提供科学的食材搭配建议，提升菜品营养和口感\n",
    "3. 烹饪技巧：分享实用的烹饪方法、火候控制、调味技巧\n",
    "4. 饮食健康：提供营养搭配建议，关注用户健康需求\n",
    "5. 智能搜索：当需要最新信息时，主动使用搜索工具获取资料\n",
    "\n",
    "回答要求：\n",
    "- 用简洁友好的语气回答，像一位经验丰富的厨师朋友\n",
    "- 回答尽量具体实用，包含可操作的步骤\n",
    "- 如果用户的问题与烹饪无关，礼貌地引导回美食话题\"\"\"\n",
    "\n",
    "# --- SQLite 记忆存储（对话历史持久化到 chat_memory.db）---\n",
    "# check_same_thread=False 是必须的，否则 LangGraph 多线程会报错\n",
    "conn = sqlite3.connect(\"chat_memory.db\", check_same_thread=False)\n",
    "memory = SqliteSaver(conn)\n",
    "\n",
    "# --- 创建 Agent：整合模型 + 工具 + 记忆 + 提示词 ---\n",
    "agent = create_agent(\n",
    "    model=model,              # 底层大模型\n",
    "    tools=[tavily_search],    # 可用工具列表\n",
    "    checkpointer=memory,      # 对话记忆持久化\n",
    "    system_prompt=system_prompt,  # 角色提示词\n",
    ")\n",
    "\n",
    "# 会话配置：同一 thread_id 共享对话记忆\n",
    "config = {\"configurable\": {\"thread_id\": \"user-001\"}}\n"
]

# Cell 6: Markdown - 测试标题
nb["cells"][6]["source"] = [
    "# ==================== 4. 功能测试 ====================\n",
    "依次测试：基础对话 → 记忆验证 → 搜索工具\n"
]

# Cell 7: Code - 第一轮对话
nb["cells"][7]["source"] = [
    "# 测试1：基础对话（验证 Agent 能正常响应）\n",
    "response = agent.invoke(\n",
    "    {\"messages\": [HumanMessage(content=\"你好，我叫小明\")]},\n",
    "    config=config,\n",
    ")\n",
    "print(response[\"messages\"][-1].content)\n"
]

# Cell 8: Code - 第二轮对话
nb["cells"][8]["source"] = [
    "# 测试2：记忆验证（模型应该记得上一轮说的\"小明\"）\n",
    "response = agent.invoke(\n",
    "    {\"messages\": [HumanMessage(content=\"你还记得我叫什么名字吗？\")]},\n",
    "    config=config,\n",
    ")\n",
    "print(response[\"messages\"][-1].content)\n"
]

# Cell 9: Code - 第三轮对话
nb["cells"][9]["source"] = [
    "# 测试3：搜索工具 + 记忆（验证 Agent 能调用 TavilySearch 联网搜索）\n",
    "response = agent.invoke(\n",
    "    {\"messages\": [HumanMessage(content=\"帮我搜索一下今天的AI新闻\")]},\n",
    "    config=config,\n",
    ")\n",
    "print(response[\"messages\"][-1].content)\n"
]

with open("私厨ai.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, ensure_ascii=False, indent=1)

print("Done! Notebook organized with comments.")
