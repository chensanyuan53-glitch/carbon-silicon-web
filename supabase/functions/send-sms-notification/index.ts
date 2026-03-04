import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 阿里云短信配置 - 需要在环境变量中配置
const ALIYUN_ACCESS_KEY_ID = Deno.env.get('ALIYUN_ACCESS_KEY_ID') || ''
const ALIYUN_ACCESS_KEY_SECRET = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') || ''
const ALIYUN_SMS_SIGN_NAME = Deno.env.get('ALIYUN_SMS_SIGN_NAME') || '碳硅科技'
const ALIYUN_SMS_TEMPLATE_CODE = Deno.env.get('ALIYUN_SMS_TEMPLATE_CODE') || 'SMS_123456789'

interface RequestBody {
  phoneNumber: string
  productName: string
  buyerContact: string
  buyerMessage?: string
}

interface AliyunSMSRequest {
  PhoneNumbers: string
  SignName: string
  TemplateCode: string
  TemplateParam: string
}

// 阿里云短信发送函数
async function sendSMS(phoneNumber: string, productName: string, buyerContact: string, buyerMessage?: string): Promise<boolean> {
  try {
    // 构造请求参数
    const templateParam = JSON.stringify({
      product: productName,
      contact: buyerContact,
      message: buyerMessage || '无'
    })

    // 注意：这里使用简化的请求方式
    // 实际生产环境需要实现阿里云的签名算法（RPC风格）
    // 建议使用官方SDK或第三方库
    console.log('发送短信:', {
      phoneNumber,
      productName,
      buyerContact,
      buyerMessage
    })

    // 模拟发送成功
    return true
  } catch (error) {
    console.error('发送短信失败:', error)
    return false
  }
}

serve(async (req) => {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { phoneNumber, productName, buyerContact, buyerMessage }: RequestBody = await req.json()

    // 验证必需参数
    if (!phoneNumber || !productName || !buyerContact) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      return new Response(
        JSON.stringify({ error: '手机号格式不正确' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 发送短信
    const success = await sendSMS(phoneNumber, productName, buyerContact, buyerMessage)

    if (success) {
      return new Response(
        JSON.stringify({ success: true, message: '短信发送成功' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ error: '短信发送失败' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('处理请求失败:', error)
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
