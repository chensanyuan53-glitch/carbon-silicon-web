# 阿里云短信通知配置指南

本指南说明如何配置阿里云短信服务，在用户提交购买咨询时发送短信通知卖家。

## 前置条件

1. 已拥有阿里云账号
2. 已开通阿里云短信服务
3. Supabase 项目已配置好

## 步骤一：申请阿里云短信服务

### 1.1 开通短信服务

1. 登录 [阿里云控制台](https://console.aliyun.com/)
2. 搜索"短信服务"并开通
3. 实名认证（如果未完成）

### 1.2 添加短信签名

1. 进入短信服务控制台
2. 点击"国内消息" → "签名管理"
3. 添加签名，例如：
   - 签名名称：`碳硅科技`
   - 签名来源：验证码或通用
   - 适用场景：验证码或通知短信

### 1.3 创建短信模板

1. 点击"模板管理"
2. 创建模板，例如：
   - 模板类型：验证码或通知短信
   - 模板名称：购买咨询通知
   - 模板内容示例：
     ```
     您好，有人对您的商品【${product}】发起购买咨询，联系方式：${contact}，留言：${message}，请尽快联系。
     ```
   - 申请说明：用于通知卖家有新的购买咨询

**注意：** 模板中的变量名必须与代码中一致：
- `${product}` - 商品名称
- `${contact}` - 买家联系方式
- `${message}` - 买家留言

### 1.4 获取 AccessKey

1. 访问 [访问控制控制台](https://ram.console.aliyun.com/manage/ak)
2. 创建 AccessKey（或使用已有的）
3. 记录 `AccessKey ID` 和 `AccessKey Secret`

**安全提示：** 请妥善保管 AccessKey Secret，不要泄露给他人。

## 步骤二：配置 Supabase Edge Function

### 2.1 部署 Edge Function

在项目根目录执行：

```bash
supabase functions deploy send-sms-notification
```

### 2.2 配置环境变量

在 Supabase 控制台配置环境变量：

1. 进入你的 Supabase 项目
2. 点击左侧菜单 "Edge Functions" → "Settings"
3. 添加以下环境变量：

| 环境变量名 | 说明 | 示例值 |
|-----------|------|--------|
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID | `LTAI5txxxxxxxxxxxxx` |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `ALIYUN_SMS_SIGN_NAME` | 短信签名名称 | `碳硅科技` |
| `ALIYUN_SMS_TEMPLATE_CODE` | 短信模板代码 | `SMS_123456789` |

### 2.3 测试 Edge Function

使用 curl 测试：

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/send-sms-notification \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "phoneNumber": "13800138000",
    "productName": "智能客服助手",
    "buyerContact": "微信：testuser",
    "buyerMessage": "想了解一下具体功能"
  }'
```

## 步骤三：配置数据库

### 3.1 执行数据库迁移

```bash
supabase db push
```

或在 Supabase 控制台的 SQL Editor 中执行：
`supabase/migrations/20250125000007_sms_notification_trigger.sql`

### 3.2 配置卖家手机号

为每个商品配置卖家手机号：

```sql
-- 更新商品的卖家手机号
UPDATE market_products
SET seller_phone = '13800138000'
WHERE id = 1;

-- 查看配置结果
SELECT id, title, seller_phone FROM market_products;
```

## 步骤四：测试短信功能

1. 在前端提交一个购买咨询
2. 检查卖家手机号是否收到短信
3. 查看 Edge Function 日志确认发送状态

## 费用说明

阿里云短信服务按量计费，价格参考（具体以阿里云官方为准）：

| 短信类型 | 价格 |
|---------|------|
| 国内短信 | 约 ¥0.045/条 |
| 国际短信 | 价格根据国家/地区不同 |

## 常见问题

### Q1: 短信发送失败怎么办？

**A:**
1. 检查 AccessKey 是否正确配置
2. 确认短信签名和模板已审核通过
3. 查看手机号格式是否正确（需为 11 位国内手机号）
4. 查看 Edge Function 日志获取详细错误信息

### Q2: 如何查看发送记录？

**A:**
- 在阿里云短信服务控制台的"发送记录"中查看
- 在 Supabase Edge Function 日志中查看调用记录

### Q3: 可以支持国际短信吗？

**A:**
可以，但需要：
1. 在阿里云开通国际短信服务
2. 修改短信模板（需支持国际化）
3. 调整手机号格式验证逻辑

### Q4: 测试时不想发真实短信怎么办？

**A:**
在 `send-sms-notification/index.ts` 中修改 `sendSMS` 函数，直接返回 `true`，模拟发送成功。

```typescript
async function sendSMS(phoneNumber: string, productName: string, buyerContact: string, buyerMessage?: string): Promise<boolean> {
  // 测试模式：只记录日志，不发送真实短信
  console.log('[测试模式] 短信发送:', {
    phoneNumber,
    productName,
    buyerContact,
    buyerMessage
  });
  return true;
}
```

### Q5: 如何限制短信发送频率？

**A:**
可以在前端添加节流，或使用 Supabase 的 Rate Limiting 功能。建议：
- 同一买家对同一商品，1 分钟内只能发送 1 次
- 同一卖家，1 分钟内最多接收 5 条短信

## 安全建议

1. **使用 Service Role Key**：Edge Function 内部调用使用 Service Role Key，而不是匿名 Key
2. **验证权限**：确保只有经过验证的用户才能发送咨询
3. **数据加密**：敏感信息（如手机号）在数据库中应考虑加密存储
4. **日志审计**：记录所有短信发送操作，便于审计

## 后续优化

- [ ] 添加短信发送记录表，记录每条短信的发送状态
- [ ] 实现短信发送失败的重试机制
- [ ] 添加短信余额提醒
- [ ] 支持批量发送（如给多个卖家发送）
- [ ] 添加短信模板管理功能

## 技术支持

如有问题，请联系：
- Supabase 文档：https://supabase.com/docs
- 阿里云短信文档：https://help.aliyun.com/product/44282.html
