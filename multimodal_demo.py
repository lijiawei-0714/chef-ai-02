"""
阿里云百炼平台 - 多模态大模型调用示例
模型: qwen-vl-max (通义千问视觉语言模型)
支持: 图片 + 文本输入
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# 加载 .env 中的环境变量
load_dotenv()

# 初始化多模态模型（通过 OpenAI 兼容接口）
model = ChatOpenAI(
    model="qwen-vl-max",
    openai_api_key=os.getenv("ALI_KEY"),
    openai_api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# ========== 示例1: 通过图片URL进行多模态对话 ==========
def chat_with_image_url(image_url: str, question: str):
    """通过图片URL进行多模态问答"""
    message = HumanMessage(
        content=[
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    )
    response = model.invoke([message])
    return response.content


# ========== 示例2: 通过本地图片路径进行多模态对话 ==========
def chat_with_local_image(image_path: str, question: str):
    """通过本地图片（Base64编码）进行多模态问答"""
    import base64

    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    message = HumanMessage(
        content=[
            {"type": "text", "text": question},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
            },
        ]
    )
    response = model.invoke([message])
    return response.content


# ========== 示例3: 纯文本对话（也支持） ==========
def chat(text: str):
    """纯文本对话"""
    message = HumanMessage(content=text)
    response = model.invoke([message])
    return response.content


if __name__ == "__main__":
    # --- 纯文本示例 ---
    print("=== 纯文本对话 ===")
    result = chat("你好，请用一句话介绍你自己")
    print(result)

    # --- 图片URL示例（取消注释即可使用） ---
    # print("\n=== 图片URL问答 ===")
    # result = chat_with_image_url(
    #     image_url="https://example.com/some-image.jpg",
    #     question="请描述这张图片的内容"
    # )
    # print(result)

    # --- 本地图片示例（取消注释即可使用） ---
    # print("\n=== 本地图片问答 ===")
    # result = chat_with_local_image(
    #     image_path="path/to/your/image.jpg",
    #     question="这张图片里有什么？"
    # )
    # print(result)
