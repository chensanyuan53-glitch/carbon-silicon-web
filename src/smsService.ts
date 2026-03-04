import { supabase } from './supabaseClient';

interface SMSPayload {
  phoneNumber: string;
  productName: string;
  buyerContact: string;
  buyerMessage?: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 发送短信通知
 * @param payload 短信内容
 * @returns Promise<SMSResponse>
 */
export async function sendSMSNotification(payload: SMSPayload): Promise<SMSResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-sms-notification', {
      body: payload,
    });

    if (error) {
      console.error('短信发送失败:', error);
      return { success: false, error: error.message };
    }

    return data as SMSResponse;
  } catch (err) {
    console.error('短信发送异常:', err);
    return { success: false, error: '网络错误，请稍后重试' };
  }
}

/**
 * 发送购买咨询短信通知
 * @param sellerPhoneNumber 卖家手机号
 * @param productName 商品名称
 * @param buyerContact 买家联系方式
 * @param buyerMessage 买家留言
 * @returns Promise<SMSResponse>
 */
export async function sendPurchaseInquirySMS(
  sellerPhoneNumber: string,
  productName: string,
  buyerContact: string,
  buyerMessage?: string
): Promise<SMSResponse> {
  return sendSMSNotification({
    phoneNumber: sellerPhoneNumber,
    productName,
    buyerContact,
    buyerMessage,
  });
}
