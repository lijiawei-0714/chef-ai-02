# 阿里云 OSS 配置说明

## 📋 配置步骤

### 1️⃣ 开通阿里云 OSS 服务

1. 访问 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 开通 OSS 服务（首次使用需要开通）
3. 创建一个 Bucket（存储空间）
   - **Bucket 名称**：自定义，例如 `sichu-ai-images`
   - **地域**：选择离你最近的地域（如：华东1-杭州）
   - **读写权限**：公共读（需要让 AI 能访问图片）
   - **存储类型**：标准存储

### 2️⃣ 获取 AccessKey

1. 访问 [阿里云 AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
2. 创建 AccessKey（建议使用 RAM 用户，更安全）
3. 记录以下信息：
   - **AccessKey ID**
   - **AccessKey Secret**

### 3️⃣ 配置环境变量

在项目的 `.env` 文件中添加以下配置：

```env
# 阿里云 OSS 配置
OSS_ACCESS_KEY_ID=你的AccessKeyID
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET_NAME=你的Bucket名称（如：sichu-ai-images）
OSS_ENDPOINT=你的Bucket所在地域的Endpoint（如：oss-cn-hangzhou.aliyuncs.com）
```

### 4️⃣ 安装依赖

```bash
# 使用 uv 安装（推荐）
uv sync

# 或使用 pip
pip install oss2
```

## 🔧 Endpoint 说明

Endpoint 是 OSS 服务的地域访问域名，格式为：`oss-{地域}.aliyuncs.com`

常用 Endpoint 示例：
- 华东1（杭州）：`oss-cn-hangzhou.aliyuncs.com`
- 华东2（上海）：`oss-cn-shanghai.aliyuncs.com`
- 华北1（青岛）：`oss-cn-qingdao.aliyuncs.com`
- 华南1（深圳）：`oss-cn-shenzhen.aliyuncs.com`

完整列表：https://help.aliyun.com/document_detail/31837.html

## 💡 使用方式

### 方式1：直接输入图片路径

```
请输入你的问题: D:/images/dish.jpg
```

系统会自动：
1. 检测图片文件
2. 上传到 OSS
3. 获取 URL
4. 发送给 AI 分析

### 方式2：图片路径 + 文字描述

```
请输入你的问题: D:/images/dish.jpg 这是什么菜？
```

系统会将图片和问题一起发送给 AI。

## 🔒 安全建议

1. **不要将 AccessKey 提交到代码仓库**
   - `.env` 文件已在 `.gitignore` 中
   - 使用环境变量管理敏感信息

2. **使用 RAM 子账号**
   - 创建专门的 RAM 用户
   - 只授予 OSS 读写权限
   - 避免使用主账号 AccessKey

3. **设置 Bucket 生命周期**
   - 可以设置自动删除过期文件
   - 节省存储成本

## 🌐 图片访问权限（重要更新）

### ✅ 使用签名 URL（推荐）

**现在代码已经更新为使用签名 URL，不需要设置公共读权限！**

签名 URL 的优势：
- 🔒 **更安全**：临时访问权限，自动过期
- ⏰ **可控时效**：默认 1 小时，可自定义
- 🛡️ **无需公共读**：Bucket 保持私有，更安全
- 💰 **防止盗链**：链接过期后无法访问

代码会自动生成签名 URL，你不需要做任何额外配置！

### 自定义签名有效期

如果需要修改有效期，可以在调用时指定：

```python
# 默认 1 小时（3600 秒）
image_url = upload_image_to_oss("path/to/image.jpg")

# 自定义 2 小时
image_url = upload_image_to_oss("path/to/image.jpg", expire_seconds=7200)

# 自定义 24 小时
image_url = upload_image_to_oss("path/to/image.jpg", expire_seconds=86400)
```

### 📝 旧方案：公共读（不推荐）

如果你仍然想使用公共读（不推荐），需要：
1. 在 OSS 控制台手动修改 Bucket 权限
2. 可能需要通过 RAM 策略授权
3. 存在安全风险

**建议使用签名 URL 方案！**

## 📊 费用说明

阿里云 OSS 按量计费，主要包括：
- 存储费用：约 0.12 元/GB/月
- 流量费用：约 0.5 元/GB（外网流出）
- 请求费用：约 0.01 元/万次

对于个人使用，费用非常低。

## ❓ 常见问题

### Q: 上传失败怎么办？
A: 检查以下几点：
- AccessKey 是否正确
- Bucket 名称是否正确
- Endpoint 是否与 Bucket 地域匹配
- 网络连接是否正常

### Q: 图片 URL 无法访问？
A: 检查 Bucket 的读写权限是否设置为"公共读"

### Q: 如何查看已上传的图片？
A: 登录 [OSS 控制台](https://oss.console.aliyun.com/)，进入对应的 Bucket 查看文件列表
