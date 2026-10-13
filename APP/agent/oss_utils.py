"""
阿里云 OSS 工具模块
用于上传图片并获取 URL
"""
import os
import oss2
from dotenv import load_dotenv
from typing import Optional
from pathlib import Path

# 加载环境变量
load_dotenv()


class OSSUploader:
    """阿里云 OSS 上传器"""
    
    def __init__(self):
        """初始化 OSS 客户端"""
        self.access_key_id = os.getenv("OSS_ACCESS_KEY_ID")
        self.access_key_secret = os.getenv("OSS_ACCESS_KEY_SECRET")
        self.bucket_name = os.getenv("OSS_BUCKET_NAME")
        self.endpoint = os.getenv("OSS_ENDPOINT")
        
        # 验证配置
        if not all([self.access_key_id, self.access_key_secret, self.bucket_name, self.endpoint]):
            raise ValueError(
                "OSS 配置不完整，请在 .env 文件中配置以下环境变量：\n"
                "OSS_ACCESS_KEY_ID\n"
                "OSS_ACCESS_KEY_SECRET\n"
                "OSS_BUCKET_NAME\n"
                "OSS_ENDPOINT"
            )
        
        # 创建认证对象
        self.auth = oss2.Auth(self.access_key_id, self.access_key_secret)
        # 创建 Bucket 对象
        self.bucket = oss2.Bucket(self.auth, self.endpoint, self.bucket_name)
        
        print(f"✅ OSS 初始化成功，Bucket: {self.bucket_name}")
    
    def upload_image(self, image_path: str, object_name: Optional[str] = None, expire_seconds: int = 3600) -> str:
        """
        上传图片到 OSS 并返回签名 URL
        
        Args:
            image_path: 本地图片文件路径
            object_name: OSS 中的对象名称（文件名），如果为 None 则使用原文件名
            expire_seconds: 签名 URL 的有效期（秒），默认 3600 秒（1 小时）
            
        Returns:
            图片的签名访问 URL（临时有效）
            
        Raises:
            FileNotFoundError: 图片文件不存在
            Exception: 上传失败
        """
        # 检查文件是否存在
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"图片文件不存在: {image_path}")
        
        # 如果没有指定对象名称，使用原文件名
        if object_name is None:
            object_name = Path(image_path).name
        
        try:
            # 上传文件
            print(f"📤 正在上传图片: {image_path}")
            result = self.bucket.put_object_from_file(object_name, image_path)
            
            # 检查上传状态
            if result.status != 200:
                raise Exception(f"上传失败，状态码: {result.status}")
            
            # 生成签名 URL（临时访问链接）
            # 这样不需要 Bucket 设置为公共读
            image_url = self.bucket.sign_url('GET', object_name, expire_seconds)
            
            print(f"✅ 图片上传成功（签名 URL，{expire_seconds}秒后过期）")
            print(f"🔗 URL: {image_url[:100]}..." if len(image_url) > 100 else f"🔗 URL: {image_url}")
            return image_url
            
        except Exception as e:
            print(f"❌ 图片上传失败: {e}")
            raise
    
    def is_image_file(self, file_path: str) -> bool:
        """
        判断文件是否为图片
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否为图片文件
        """
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
        file_ext = Path(file_path).suffix.lower()
        return file_ext in image_extensions


# 创建全局上传器实例（延迟初始化）
_oss_uploader: Optional[OSSUploader] = None


def get_oss_uploader() -> OSSUploader:
    """获取 OSS 上传器实例（单例模式）"""
    global _oss_uploader
    if _oss_uploader is None:
        _oss_uploader = OSSUploader()
    return _oss_uploader


def upload_image_to_oss(image_path: str) -> str:
    """
    便捷函数：上传图片到 OSS 并返回 URL
    
    Args:
        image_path: 本地图片文件路径
        
    Returns:
        图片的公网访问 URL
    """
    uploader = get_oss_uploader()
    return uploader.upload_image(image_path)
