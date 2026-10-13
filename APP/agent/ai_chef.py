# ==================== 1. 模型初始化 ====================
# 加载环境变量并初始化阿里云百炼多模态大模型
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from typing import TypedDict, Annotated, Union, List
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.sqlite import SqliteSaver
import operator
from pathlib import Path

# 导入 OSS 工具
from oss_utils import upload_image_to_oss, get_oss_uploader

# 从 .env 文件加载 API Key 等配置
load_dotenv()

# ==================== LangSmith 追踪配置 ====================
# 确保 LangSmith 追踪环境变量已设置
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGSMITH_TRACING_V2", "true")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGSMITH_API_KEY", "")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGSMITH_PROJECT", "AI-SICHU")

# 打印 LangSmith 配置状态
if os.getenv("LANGSMITH_API_KEY"):
    print("✅ LangSmith 追踪已启用")
    print(f"📊 项目名称: {os.environ['LANGCHAIN_PROJECT']}")
    print(f"🔗 查看追踪: https://smith.langchain.com/o/default/projects/{os.environ['LANGCHAIN_PROJECT']}")
else:
    print("⚠️ LangSmith API Key 未配置，追踪功能未启用")

# 初始化多模态模型（通过 OpenAI 兼容接口调用阿里云百炼）
model = ChatOpenAI(
    model="qwen-max",
    openai_api_key=os.getenv("ALI_KEY"),
    openai_api_base=os.getenv("ali_URL"),
)

# ==================== 2. 工具配置 ====================
# 初始化 Tavily 智能搜索工具（每次最多返回 3 条结果）
from langchain_tavily import TavilySearch

tavily_search = TavilySearch(max_results=3)
tools = [tavily_search]

# 将工具绑定到模型，使模型能够调用工具
model_with_tools = model.bind_tools(tools)

# ==================== 3. 定义状态 ====================
class AgentState(TypedDict):
    """定义智能体状态，包含消息列表"""
    messages: Annotated[list, add_messages]  # 使用 add_messages 注解，自动处理消息追加

# ==================== 4. 定义节点函数 ====================
# --- 系统提示词：定义 Agent 的角色和行为规范 ---
system_prompt = """你是一个专业的私厨AI助手，名叫"私厨小助"。
你的专长包括：
1. 菜谱推荐：根据用户提供的食材、口味偏好、饮食禁忌推荐合适的菜谱
2. 食材搭配：提供科学的食材搭配建议，提升菜品营养和口感
3. 烹饪技巧：分享实用的烹饪方法、火候控制、调味技巧
4. 饮食健康：提供营养搭配建议，关注用户健康需求
5. 智能搜索：当需要最新信息时，主动使用搜索工具获取资料

回答要求：
- 用简洁友好的语气回答，像一位经验丰富的厨师朋友
- 回答尽量具体实用，包含可操作的步骤
- 如果用户的问题与烹饪无关，礼貌地引导回美食话题"""

def agent_node(state: AgentState):
    """智能体节点：调用模型进行推理和决策"""
    # 添加系统提示词
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = model_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState):
    """判断是否需要继续调用工具"""
    last_message = state["messages"][-1]
    # 如果模型返回了工具调用，则继续执行工具
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    # 否则结束对话
    return END

# ==================== 5. 构建 LangGraph 图 ====================
# 创建状态图
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("agent", agent_node)  # 智能体推理节点
workflow.add_node("tools", ToolNode(tools))  # 工具执行节点

# 添加边
workflow.add_edge(START, "agent")  # 从起点到智能体节点
workflow.add_conditional_edges(  # 条件边：根据是否需要调用工具决定下一步
    "agent",
    should_continue,
    {
        "tools": "tools",  # 如果需要调用工具，转到工具节点
        END: END,  # 否则结束
    }
)
workflow.add_edge("tools", "agent")  # 工具执行完成后返回智能体节点

# ==================== 5.5 记忆管理配置 ====================
# 使用 SQLite 数据库保存对话历史
import sqlite3
import atexit
memory_db_path = os.path.join(os.path.dirname(__file__), "chat_memory.db")
print(f" 记忆数据库路径: {memory_db_path}")

# 创建 SQLite 连接和记忆保存器
sqlite_conn = sqlite3.connect(memory_db_path, check_same_thread=False)
memory = SqliteSaver(sqlite_conn)
print("✅ 记忆管理已启用（SQLite 持久化）")

# 注册退出时关闭数据库连接
atexit.register(sqlite_conn.close)

# 编译图（启用记忆）
app = workflow.compile(checkpointer=memory)

# ==================== 6. 图片处理工具 ====================
def process_user_input(user_input: str) -> Union[str, List[dict]]:
    """
    处理用户输入，检测并上传图片到 OSS
    
    Args:
        user_input: 用户输入（可能是图片路径或文字）
        
    Returns:
        如果是纯文字，返回字符串
        如果包含图片，返回多模态消息格式 [{"type": "text", ...}, {"type": "image_url", ...}]
    """
    # 检查是否是图片文件路径
    uploader = get_oss_uploader()
    
    # 如果输入的是一个有效的文件路径且是图片
    if os.path.exists(user_input) and uploader.is_image_file(user_input):
        print(f"\n🖼️ 检测到图片文件: {user_input}")
        
        # 上传图片到 OSS
        image_url = upload_image_to_oss(user_input)
        
        # 构建多模态消息
        return [
            {
                "type": "text",
                "text": "请分析这张图片中的菜品，并提供相关的烹饪建议。"
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url
                }
            }
        ]
    
    # 检查是否包含图片路径（格式：图片路径 + 文字描述）
    # 支持格式："path/to/image.jpg 描述文字" 或 "描述文字 path/to/image.jpg"
    parts = user_input.split(maxsplit=1)
    if len(parts) >= 1:
        for i, part in enumerate(parts):
            if os.path.exists(part) and uploader.is_image_file(part):
                print(f"\n🖼️ 检测到图片文件: {part}")
                
                # 上传图片到 OSS
                image_url = upload_image_to_oss(part)
                
                # 提取文字描述
                text_parts = [p for j, p in enumerate(parts) if j != i]
                text = text_parts[0] if text_parts else "请分析这张图片中的菜品，并提供相关的烹饪建议。"
                
                # 构建多模态消息
                return [
                    {
                        "type": "text",
                        "text": text
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
    
    # 如果是纯文字，直接返回
    return user_input

# ==================== 7. 运行智能体 ====================
def run_agent(user_input: str, debug: bool = False, thread_id: str = "default"):
    """运行智能体并返回响应
    
    Args:
        user_input: 用户输入的问题（可以是文字或图片路径）
        debug: 是否启用调试模式，显示详细的执行过程
        thread_id: 对话线程 ID，用于区分不同的对话会话
    """
    # 处理用户输入（检测并上传图片）
    processed_input = process_user_input(user_input)
    
    # 构建消息
    if isinstance(processed_input, list):
        # 多模态消息（包含图片）
        print(f"\n📝 文字内容: {processed_input[0]['text']}")
        print(f"🔗 图片 URL: {processed_input[1]['image_url']['url']}")
        message = HumanMessage(content=processed_input)
    else:
        # 纯文字消息
        print(f"\n用户: {processed_input}")
        message = HumanMessage(content=processed_input)
    
    # 配置对话线程（用于记忆管理）
    config = {"configurable": {"thread_id": thread_id}}
    
    # 调用智能体（传入配置以启用记忆）
    result = app.invoke(
        {"messages": [message]},
        config=config
    )
    
    # 调试模式：显示完整的消息流
    if debug:
        print("\n" + "="*50)
        print("📋 执行过程详情：")
        print("="*50)
        for i, msg in enumerate(result["messages"], 1):
            msg_type = type(msg).__name__
            if hasattr(msg, "content"):
                print(f"\n[{i}] {msg_type}:")
                print(f"    内容: {msg.content[:200]}..." if len(msg.content) > 200 else f"    内容: {msg.content}")
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                print(f"    工具调用: {msg.tool_calls}")
            if hasattr(msg, "name") and msg.name:
                print(f"    工具名称: {msg.name}")
        print("="*50)
    
    # 获取最终回复
    response = result["messages"][-1]
    print(f"\n私厨小助: {response.content}")
    
    # 显示 LangSmith 追踪链接
    if os.getenv("LANGSMITH_API_KEY"):
        print(f"\n🔍 查看本次调用的详细追踪: https://smith.langchain.com/o/default/projects/{os.environ['LANGCHAIN_PROJECT']}")
    
    return response.content

# ==================== 8. 主程序入口 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("欢迎使用私厨小助！输入 'quit' 或 'exit' 退出")
    print("输入 'debug on' 开启调试模式，'debug off' 关闭调试模式")
    print("输入 'new' 开始新对话（清除上下文）")
    print("\n💡 提示：")
    print("  - 直接输入文字进行提问")
    print("  - 输入图片路径（如：D:/images/dish.jpg）上传图片")
    print("  - 输入 '图片路径 + 描述'（如：D:/images/dish.jpg 这是什么菜）")
    print("=" * 50)
    
    debug_mode = False  # 默认关闭调试模式
    thread_id = "main"  # 默认对话线程 ID
    
    while True:
        try:
            user_input = input("\n请输入你的问题: ").strip()
            
            if user_input.lower() in ['quit', 'exit', '退出']:
                print("感谢使用私厨小助，再见！")
                break
            
            # 切换调试模式
            if user_input.lower() == 'debug on':
                debug_mode = True
                print("✅ 调试模式已开启")
                continue
            elif user_input.lower() == 'debug off':
                debug_mode = False
                print("❌ 调试模式已关闭")
                continue
            
            # 开始新对话
            if user_input.lower() == 'new':
                thread_id = f"thread_{os.urandom(4).hex()}"
                print(f"✅ 开始新对话（线程 ID: {thread_id}）")
                continue
            
            if not user_input:
                continue
            
            run_agent(user_input, debug=debug_mode, thread_id=thread_id)
            
        except KeyboardInterrupt:
            print("\n\n程序被中断，感谢使用私厨小助！")
            break
        except Exception as e:
            print(f"\n发生错误: {e}")
            if debug_mode:
                import traceback
                traceback.print_exc()
            continue


