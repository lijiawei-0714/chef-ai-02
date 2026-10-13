# 🔄 重要更新：签名 URL 方案

## 📢 更新说明

由于阿里云安全策略调整，**不再允许创建公共读的 Bucket**。我们已经将代码更新为使用**签名 URL** 方案，这是更安全、更符合最佳实践的解决方案。

## ✅ 好消息

**你不需要设置公共读权限了！**

现在的方案：
- 🔒 Bucket 保持**私有**权限（默认即可）
- ⏰ 自动生成带签名的临时访问 URL
- 🛡️ 更安全，链接自动过期
- 💰 符合阿里云安全最佳实践

## 🎯 什么是签名 URL？

签名 URL 是阿里云 OSS 提供的一种安全访问方式：

```
https://bucket.oss-cn-hangzhou.aliyuncs.com/image.jpg?
  OSSAccessKeyId=LTAI5t...
  &Expires=1697123456
  &Signature=abc123...
```

**特点：**
- 包含临时访问凭证
- 有过期时间（默认 1 小时）
- 过期后无法访问
- 无需修改 Bucket 权限

## 📝 你需要做什么？

### 1. 创建 Bucket（保持默认私有权限）

在阿里云 OSS 控制台创建 Bucket 时：
- **读写权限**：选择 **私有**（默认选项）
- 其他配置保持不变

### 2. 配置 AccessKey

按照之前的步骤配置 AccessKey 即可。

### 3. 运行智能体

```bash
python D:\python-入门\PythonProject1\APP\agent\ai私厨.py
```

**就这么简单！不需要任何额外配置。**

## 🔧 技术细节

### 代码变更

**之前（公共读）：**
```python
# 生成永久公网 URL
image_url = f"https://{bucket}.{endpoint}/{object_name}"
# 需要 Bucket 设置为公共读
```

**现在（签名 URL）：**
```python
# 生成临时签名 URL
image_url = bucket.sign_url('GET', object_name, expire_seconds)
# 无需公共读，更安全
```

### 默认有效期

- **默认**：3600 秒（1 小时）
- **可自定义**：通过 `expire_seconds` 参数调整

## 💡 使用示例

### 自动上传并获取签名 URL

```python
# 默认 1 小时有效
image_url = upload_image_to_oss("D:/images/dish.jpg")
# => https://bucket.oss-cn-hangzhou.aliyuncs.com/dish.jpg?OSSAccessKeyId=...

# 自定义 2 小时
image_url = upload_image_to_oss("D:/images/dish.jpg", expire_seconds=7200)

# 自定义 24 小时
image_url = upload_image_to_oss("D:/images/dish.jpg", expire_seconds=86400)
```

## 🔒 安全性对比

| 方案 | 权限要求 | 安全性 | 有效期 | 推荐度 |
|------|---------|--------|--------|--------|
| 公共读 | 需要公共读权限 | ⚠️ 较低 | 永久 | ❌ 不推荐 |
| **签名 URL** | **私有权限** | **🔒 高** | **可控制** | **✅ 推荐** |

## ⚠️ 注意事项

### 1. URL 有效期

签名 URL 会在 1 小时后失效（默认）。如果需要更长时间：

```python
# 在 ai私厨.py 中修改默认值
image_url = upload_image_to_oss(image_path, expire_seconds=7200)  # 2小时
```

### 2. URL 长度

签名 URL 比普通 URL 长（包含签名信息），这是正常的。

### 3. 分享限制

签名 URL 过期后无法访问，如需重新访问需要重新上传。

## 🆘 常见问题

### Q: 为什么阿里云不允许公共读？
A: 为了防止数据泄露和滥用，阿里云默认禁止创建公共读的 Bucket，这是安全最佳实践。

### Q: 签名 URL 会影响 AI 识别吗？
A: 不会！AI 可以正常访问签名 URL，只要在有效期内即可。

### Q: 如果 URL 过期了怎么办？
A: 重新上传图片即可，会自动生成新的签名 URL。

### Q: 可以设置永久有效的 URL 吗？
A: 可以，但不推荐。如果确实需要，可以通过 RAM 策略配置，但建议使用签名 URL。

## 📚 相关文档

- [阿里云 OSS 签名 URL 文档](https://help.aliyun.com/document_detail/31952.html)
- [OSS配置说明.md](./OSS配置说明.md)
- [图片上传快速开始.md](./图片上传快速开始.md)

## ✨ 总结

**变更**：从公共读 → 签名 URL  
**影响**：无需设置公共读权限，更安全  
**操作**：无需任何额外配置，直接使用  

现在你可以放心使用了，Bucket 保持默认的私有权限即可！🎉
